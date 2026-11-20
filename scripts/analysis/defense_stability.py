"""Read-only: does a team's defense against a position group repeat? (see docs/defense-stability.md)

For every defending team-season and every group (starter/bench x listed position), what the group put up per 36 minutes against that
defense, three ways: "shown" (as the Defense panel shows it), "adjusted" (each opposing player's game minus his own season rate times
the minutes he played, so who the defense happened to face is taken out) and "relative" (adjusted, minus the same team's adjusted figure
against ALL opposing players, so only what is specific to the position group is left). Then: does the figure repeat between the first and second
half of a season, between odd and even games, and from one season to the next? Usage: python defense_stability.py [out.json]
"""
import json, sys, statistics as st
from databricks.connect import DatabricksSession

STATS = ["pts", "reb", "ast", "fg3m", "blk", "stl"]
LAST_SEASON = 2026          # 2025-26; the current season is too young
MIN_PLAYER_GAMES = 20       # per half (or per odd/even side); a season-to-season pair needs 2x this in each season
G = "workspace.nba_v2_gold"

spark = DatabricksSession.builder.profile("DEFAULT").serverless(True).getOrCreate()
sums = ", ".join(f"sum(x.{s}) AS {s}, sum(x.{s} - x.rate_{s} * x.minutes) AS adj_{s}" for s in STATS)
rates = ", ".join(f"sum({s}) OVER w / sum(minutes) OVER w AS rate_{s}" for s in STATS)
rows = spark.sql(f"""
  WITH p AS (
    SELECT person_id, season, game_id, game_date, opponent_team_id AS def_id, started, minutes, {", ".join(STATS)}
    FROM {G}.player_season_games
    WHERE played AND game_type = 'regular-season' AND season <= {LAST_SEASON} AND minutes > 0 AND opponent_team_id IS NOT NULL),
  x AS (SELECT p.*, {rates} FROM p WINDOW w AS (PARTITION BY person_id, season))
  SELECT x.def_id, x.season, x.game_id, x.game_date, IF(x.started, 'starter', 'bench') AS role, coalesce(pos.position, 'Not listed') AS label,
         count(*) AS players, sum(x.minutes) AS minutes, {sums}
  FROM x LEFT JOIN {G}.player_season_position pos ON pos.person_id = x.person_id AND pos.season = x.season
  GROUP BY x.def_id, x.season, x.game_id, x.game_date, IF(x.started, 'starter', 'bench'), coalesce(pos.position, 'Not listed')""").collect()
print("group-game rows:", len(rows))

# (def_id, season, role, label) -> list of rows in date order
by = {}
for r in rows:
    by.setdefault((r.def_id, r.season, r.role, r.label), []).append(r)
for v in by.values():
    v.sort(key=lambda r: (r.game_date, r.game_id))


def figure(rs, s, adjusted):
    """Per-36 figure over rows, or None when the group is too thin."""
    mins = float(sum(r.minutes for r in rs))
    if sum(r.players for r in rs) < 1 or mins <= 0:
        return None
    return 36 * float(sum(r[f"adj_{s}" if adjusted else s] for r in rs)) / mins


def enough(rs, need):
    return sum(r.players for r in rs) >= need


def corr(pairs):
    if len(pairs) < 20:
        return None
    return st.correlation([p[0] for p in pairs], [p[1] for p in pairs])


# the team's games of a season, in date order; every split is by GAME so all groups of a team share it
games_of = {}
for (d, season, ro, la), rs in by.items():
    games_of.setdefault((d, season), set()).update(r.game_id for r in rs)
order = {k: [g for g in sorted(v)] for k, v in games_of.items()}   # game ids sort by date within a season
team_rows = {}                                                     # (def, season) -> every group row, for the team-wide figure
for (d, season, ro, la), rs in by.items():
    team_rows.setdefault((d, season), []).extend(rs)


def pick(rs, ids):
    return [r for r in rs if r.game_id in ids]


def splits(key):
    gs = order[key]
    m = len(gs) // 2
    return [("half", set(gs[:m]), set(gs[m:])), ("odd", set(gs[0::2]), set(gs[1::2]))]


def value(kind, rs, tr, ids, s, need):
    """The figure for one group on one set of games, or None when thin. kind: shown, adjusted, or relative (adjusted minus team-wide)."""
    sub = pick(rs, ids)
    if not enough(sub, need):
        return None
    v = figure(sub, s, kind != "shown")
    if v is None or kind != "relative":
        return v
    t = figure(pick(tr, ids), s, True)
    return None if t is None else v - t


KINDS = ("shown", "adjusted", "relative")
results = {}
groups = sorted({(k[2], k[3]) for k in by})
for kind in KINDS:
    for role, label in groups:
        for s in STATS:
            pairs = {"half": [], "odd": [], "next": []}
            for (d, season, ro, la), rs in by.items():
                if (ro, la) != (role, label):
                    continue
                tr = team_rows[(d, season)]
                for name, a, b in splits((d, season)):
                    va, vb = value(kind, rs, tr, a, s, MIN_PLAYER_GAMES), value(kind, rs, tr, b, s, MIN_PLAYER_GAMES)
                    if va is not None and vb is not None:
                        pairs[name].append((va, vb))
                n2 = by.get((d, season + 1, role, label))
                if n2:
                    allg, allg2 = set(order[(d, season)]), set(order[(d, season + 1)])
                    va = value(kind, rs, tr, allg, s, 2 * MIN_PLAYER_GAMES)
                    vb = value(kind, n2, team_rows[(d, season + 1)], allg2, s, 2 * MIN_PLAYER_GAMES)
                    if va is not None and vb is not None:
                        pairs["next"].append((va, vb))
            results[(kind, role, label, s)] = {m: (corr(v), len(v)) for m, v in pairs.items()}

# volume: how many team-seasons per group have enough player-games for a half-season comparison
print("\n1) HOW MUCH EACH GROUP HAS (median player-games per team-season; team-seasons with >= %d per half)" % (2 * MIN_PLAYER_GAMES))
for role, label in groups:
    pg = [sum(r.players for r in rs) for k, rs in by.items() if (k[2], k[3]) == (role, label)]
    ok = sum(1 for x in pg if x >= 2 * MIN_PLAYER_GAMES)
    print(f"  {role:8s} {label:10s} median {st.median(pg):6.0f} player-games | {ok:3d} of {len(pg):3d} team-seasons pass")

f = lambda t: f"{t[0]:+.2f} ({t[1]})" if t[0] is not None else "n/a"
for kind in KINDS:
    print(f"\n2) CORRELATION r ACROSS TEAM-SEASONS, {kind.upper()} per-36 figure (pairs in brackets; |r| < 0.2 is mostly noise)")
    print(f"  {'group':18s} {'stat':5s} {'half vs half':>16s} {'odd vs even':>16s} {'season vs next':>16s}")
    for role, label in groups:
        for s in STATS:
            r = results[(kind, role, label, s)]
            if r["half"][0] is None and r["next"][0] is None:
                continue
            print(f"  {role + ' ' + label:18s} {s:5s} {f(r['half']):>16s} {f(r['odd']):>16s} {f(r['next']):>16s}")

print("\n3) SUMMARY PER STAT: mean and highest r over the groups that could be tested (count of tests in brackets)")
summary = {}
for kind in KINDS:
    for s in STATS:
        line = []
        for m in ("half", "odd", "next"):
            vals = [results[(kind, ro, la, s)][m][0] for ro, la in groups if results[(kind, ro, la, s)][m][0] is not None]
            summary[f"{kind}/{s}/{m}"] = (st.mean(vals), max(vals), len(vals)) if vals else None
            line.append(f"{m} {st.mean(vals):+.2f} (max {max(vals):+.2f}, n {len(vals)})" if vals else f"{m} n/a")
        print(f"  {kind:9s} {s:5s} " + " | ".join(line))

if len(sys.argv) > 1:
    json.dump({"results": {"|".join(k): v for k, v in results.items()}, "summary": summary}, open(sys.argv[1], "w"), indent=1)
