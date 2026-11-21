"""Back-test of a smoother for MINUTES against the 50/50 blend. Read-only (Databricks Connect).

The Predictions baseline for minutes was half his last-10 average and half his season average. Result 2 of docs/predictions-backtest.md
found a weighted mean (recent games count more) about 1.6% better for minutes. This script tests the version the page uses, on the same
games and the same honest split as backtest_baseline.py: the decay rate is chosen on targets up to 2024-25 and every score is on 2025-26
and 2026-27 so far, which the choice never saw.

The candidate ("hybrid"): once he has played at least 5 games THIS season, an exponentially weighted mean (weight (1 - ALPHA) per game
back) over the page's own games (his last 10 games, or all of this season's games if there are more than 10); before that, the old 50/50 blend.
Run: <databricks-connect venv>/bin/python scripts/analysis/backtest_minutes.py [results.json]
"""
import json
import statistics as st
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import backtest_baseline as bb  # noqa: E402
import backtest_features as bf  # noqa: E402

ALPHAS = [0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.5]
ALPHA = 0.25            # lowest error on the train seasons (see the printout below); 0.30 is within 0.002 of it
MIN_SEASON_GAMES = 5    # games this season before the smoother takes over from the blend


def ew(newest_first, a):
    w = [(1 - a) ** k for k in range(len(newest_first))]
    return sum(x * y for x, y in zip(newest_first, w)) / sum(w)


def targets(players):
    """One row per target game: season, prior 10-game average minutes (for the band), actual, games this season so far, and each prediction."""
    rows = []
    for games in players.values():
        for i in range(bf.MIN_HISTORY, len(games)):
            g = games[i]
            if g["minutes"] is None:
                continue
            same = [x["minutes"] for x in games[:i] if x["season"] == g["season"] and x["minutes"] is not None]
            last10 = [x["minutes"] for x in games[i - 10:i] if x["minutes"] is not None]
            if not last10:
                continue
            l10 = sum(last10) / len(last10)
            season = sum(same) / len(same) if same else None
            blend = (l10 + season) / 2 if season is not None else l10
            n = max(10, len(same))  # the page's games: his last 10, or this season's if that is more
            pool = [x["minutes"] for x in games[max(0, i - n):i] if x["minutes"] is not None][::-1]
            pred = {"blend50": blend, **{f"ew{a}": ew(pool, a) for a in ALPHAS}}
            rows.append({"season": g["season"], "band": l10, "actual": g["minutes"], "same": len(same), "pred": pred})
    return rows


def hybrid(r, alpha=ALPHA):
    return r["pred"][f"ew{alpha}"] if r["same"] >= MIN_SEASON_GAMES else r["pred"]["blend50"]


def mae(rows, fn):
    return sum(abs(fn(r) - r["actual"]) for r in rows) / len(rows)


BANDS = [("under10", 0, 10), ("from10", 10, 20), ("from20", 20, 30), ("from30", 30, 1000)]


def main(out_path=None):
    rows = targets(bb.load())
    train = [r for r in rows if r["season"] <= bb.TRAIN_MAX_SEASON]
    test = [r for r in rows if r["season"] in bb.TEST_SEASONS]
    print(f"target games {len(rows):,} | train {len(train):,} | test {len(test):,}")
    print("\n1) DECAY RATE chosen on the TRAIN seasons: MAE of the hybrid for each alpha (blend50 for reference)")
    curve = {a: mae(train, lambda r, a=a: hybrid(r, a)) for a in ALPHAS}
    print("  blend50 " + f"{mae(train, lambda r: r['pred']['blend50']):.4f} | " + " ".join(f"{a}:{v:.4f}" for a, v in curve.items()))
    best = min(curve, key=curve.get)
    print(f"  lowest on train: alpha {best} (the page uses {ALPHA})")
    res = {"alpha": ALPHA, "min_season_games": MIN_SEASON_GAMES, "train_curve": curve, "counts": {"train": len(train), "test": len(test)}}

    print("\n2) TEST seasons: blend50 vs hybrid")
    for label, sub in (("all players", test), ("rotation (prior 10-game minutes >= 20)", [r for r in test if r["band"] >= 20]),
                       ("2025-26", [r for r in test if r["season"] == 2026]), ("2026-27 so far", [r for r in test if r["season"] == 2027])):
        a, b = mae(sub, lambda r: r["pred"]["blend50"]), mae(sub, hybrid)
        print(f"  {label:42s} n {len(sub):6,d}  blend50 {a:.3f} -> hybrid {b:.3f} ({(b / a - 1) * 100:+.1f}%)")
    d = [abs(r["pred"]["blend50"] - r["actual"]) - abs(hybrid(r) - r["actual"]) for r in test]
    print(f"  hybrid better by {st.mean(d):.3f} minutes on average (standard error {st.stdev(d) / len(d) ** .5:.3f})")
    bias = lambda fn: sum(fn(r) - r["actual"] for r in test) / len(test)
    print(f"  bias (prediction minus actual): blend50 {bias(lambda r: r['pred']['blend50']):+.3f}, hybrid {bias(hybrid):+.3f}")

    print("\n3) TYPICAL MISS FOR MINUTES BY BAND (test seasons): the numbers the page shows")
    res["by_band"] = {}
    for key, lo, hi in BANDS + [("all", 0, 1000)]:
        sub = [r for r in test if lo <= r["band"] < hi]
        res["by_band"][key] = {"blend50": mae(sub, lambda r: r["pred"]["blend50"]), "hybrid": mae(sub, hybrid), "n": len(sub)}
        print(f"  {key:8s} n {len(sub):6,d}  blend50 {res['by_band'][key]['blend50']:.3f}  hybrid {res['by_band'][key]['hybrid']:.3f}")
    if out_path:
        Path(out_path).write_text(json.dumps(res, indent=1, default=str))


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else None)
