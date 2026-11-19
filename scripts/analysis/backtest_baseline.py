"""Back-test of the Predictions baseline against what actually happened. Read-only (Databricks Connect).

Every regular-season game a player played from 2021-22 on (after his first 10) is predicted ONLY from his earlier games
(backtest_features.py). Blend weights are chosen on targets up to 2024-25 and every score is on 2025-26 and 2026-27, which the
weights never saw. Predictions are of the stat GIVEN that he plays (availability is a separate question).
Run: <databricks-connect venv>/bin/python scripts/analysis/backtest_baseline.py [results.json]
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from databricks.connect import DatabricksSession  # noqa: E402

import backtest_features as bf  # noqa: E402

TRAIN_MAX_SEASON = 2025   # season 2025 = 2024-25
TEST_SEASONS = (2026, 2027)
ROTATION_MINUTES = 20.0    # average minutes over his previous 10 games
WEIGHTS = [round(i / 10, 1) for i in range(11)]


def load():
    spark = DatabricksSession.builder.profile("DEFAULT").serverless(True).getOrCreate()
    cols = ", ".join(bf.STATS)
    rows = spark.sql(f"""SELECT person_id, season, CAST(game_date AS STRING) AS date, game_id, opponent_team_id AS opp, {cols}
        FROM workspace.nba_v2_gold.player_season_games WHERE played AND game_type = 'regular-season'
        ORDER BY person_id, game_date, game_id""").collect()
    f = lambda v: None if v is None else float(v)
    players = {}
    for r in rows:
        players.setdefault(r["person_id"], []).append({"season": int(r["season"]), "date": r["date"], "game_id": r["game_id"], "opp": r["opp"],
                                                        **{s: f(r[s]) for s in bf.STATS}})
    return players


def evaluate(rows, label_to_fn, stat, subset=lambda r: True):
    out = {}
    for name, fn in label_to_fn.items():
        pairs = [(fn(r["stats"][stat]), r["stats"][stat]["actual"]) for r in rows if stat in r["stats"] and subset(r)]
        out[name] = {"mae": bf.mae(pairs), "rmse": bf.rmse(pairs), "n": sum(1 for p, _ in pairs if p is not None),
                     "bias": (sum(p - a for p, a in pairs if p is not None) / max(1, sum(1 for p, _ in pairs if p is not None)))}
    return out


def main(out_path=None):
    players = load()
    rows = [r for games in players.values() for r in bf.build_rows(games)]
    train = [r for r in rows if r["season"] <= TRAIN_MAX_SEASON]
    test = [r for r in rows if r["season"] in TEST_SEASONS]
    rot = lambda r: (r["prior_minutes"] or 0) >= ROTATION_MINUTES
    print(f"players {len(players):,} | target games {len(rows):,} | train (to 2024-25) {len(train):,} | test (2025-26 and 2026-27) {len(test):,} | test rotation {sum(1 for r in test if rot(r)):,}")
    res = {"counts": {"players": len(players), "targets": len(rows), "train": len(train), "test": len(test), "test_rotation": sum(1 for r in test if rot(r))}, "stats": {}}

    print("\n1) BLEND WEIGHT (share on last-10; the rest on the season mean). Train-set MAE by weight; chosen = lowest.")
    chosen = {}
    for s in bf.STATS:
        curve = {w: evaluate(train, {"b": lambda x, w=w: bf.blend(x["last10"], x["season"], w)}, s)["b"]["mae"] for w in WEIGHTS}
        chosen[s] = min(curve, key=curve.get)
        print(f"  {s:8s} chosen w={chosen[s]:.1f} | " + " ".join(f"{w:.1f}:{curve[w]:.3f}" for w in WEIGHTS[::2]))
    res["chosen_weight"] = chosen

    print("\n2) TEST SET, all players: MAE (RMSE) by predictor. 'blend50' is what the page shows; 'chosen' uses the train-chosen weight.")
    for label, subset in (("ALL players", lambda r: True), ("ROTATION players (prior 10-game minutes >= 20)", rot)):
        print(f"\n  {label}")
        names = None
        res["stats"].setdefault(label, {})
        for s in bf.STATS:
            fns = {
                "blend50": lambda x: bf.blend(x["last10"], x["season"], 0.5),
                "chosen": lambda x, w=chosen[s]: bf.blend(x["last10"], x["season"], w),
                "season": lambda x: x["season"] if x["season"] is not None else x["last10"],
                "last10": lambda x: x["last10"], "last5": lambda x: x["last5"], "ewma10": lambda x: x["ewma10"], "career": lambda x: x["career"],
            }
            ev = evaluate(test, fns, s, subset)
            res["stats"][label][s] = ev
            if names is None:
                names = list(fns)
                print(f"  {'stat':8s} " + " ".join(f"{n:>13s}" for n in names) + f" {'n':>8s}")
            print(f"  {s:8s} " + " ".join(f"{ev[n]['mae']:6.3f}({ev[n]['rmse']:5.2f})" for n in names) + f" {ev['blend50']['n']:8,d}")

    print("\n3) BIAS of the 50/50 blend on the test set (prediction minus actual, all players): near 0 means no systematic over- or under-shoot")
    print("  " + " ".join(f"{s}:{res['stats']['ALL players'][s]['blend50']['bias']:+.3f}" for s in bf.STATS))

    print("\n4) SAME BLEND, EACH TEST SEASON SEPARATELY (all players), MAE blend50 / season / last10")
    for season in TEST_SEASONS:
        part = [r for r in test if r["season"] == season]
        line = []
        for s in ("pts", "reb", "ast", "minutes"):
            ev = evaluate(part, {"b": lambda x: bf.blend(x["last10"], x["season"], 0.5), "s": lambda x: x["season"] if x["season"] is not None else x["last10"], "l": lambda x: x["last10"]}, s)
            line.append(f"{s} {ev['b']['mae']:.3f}/{ev['s']['mae']:.3f}/{ev['l']['mae']:.3f}")
        print(f"  {season} ({len(part):,} games): " + " | ".join(line))

    print("\n5) OPPONENT VIEW: blend50 mixed with his last-10-meetings mean, share v on the opponent. Test MAE, all players, games with >= N meetings before")
    res["opponent"] = {}
    for min_meet in (1, 5):
        sub = lambda r, m=min_meet: r["stats"].get("pts", {}).get("n_opp", 0) >= m
        print(f"  at least {min_meet} earlier meeting(s):")
        for s in bf.STATS:
            fns = {f"v={v}": (lambda x, v=v: (1 - v) * bf.blend(x["last10"], x["season"], 0.5) + v * x["opp10"] if x["opp10"] is not None else None) for v in (0.0, 0.1, 0.2, 0.3, 0.5, 1.0)}
            ev = evaluate(test, fns, s, lambda r, m=min_meet, s=s: s in r["stats"] and r["stats"][s]["n_opp"] >= m)
            res["opponent"].setdefault(str(min_meet), {})[s] = ev
            print(f"    {s:8s} " + " ".join(f"{k}:{ev[k]['mae']:.3f}" for k in fns) + f"  (n {ev['v=0.0']['n']:,})")

    print("\n6) THE PAGE'S MIN-TO-MAX RANGE: how often the actual game lands inside it, and how wide it is (test, all players)")
    res["coverage"] = {}
    for s in bf.STATS:
        c10 = bf.coverage([(r["stats"][s]["lo10"], r["stats"][s]["hi10"], r["stats"][s]["actual"]) for r in test if s in r["stats"]])
        cS = bf.coverage([(r["stats"][s]["loS"], r["stats"][s]["hiS"], r["stats"][s]["actual"]) for r in test if s in r["stats"]])
        cR = bf.coverage([(r["stats"][s]["lo10"], r["stats"][s]["hi10"], r["stats"][s]["actual"]) for r in test if s in r["stats"] and rot(r)])
        res["coverage"][s] = {"last10": c10, "season": cS, "last10_rotation": cR}
        print(f"  {s:8s} last-10 range: inside {c10[0]*100:5.1f}% (width {c10[1]:5.1f}) | season range: {cS[0]*100:5.1f}% (width {cS[1]:5.1f}) | last-10 range, rotation: {cR[0]*100:5.1f}% (width {cR[1]:5.1f})")
    if out_path:
        Path(out_path).write_text(json.dumps(res, indent=1, default=str))


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else None)
