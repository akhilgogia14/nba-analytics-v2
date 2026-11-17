"""Read-only: are rest and home/away effects steady enough per team to show on a screen?"""
import sys, math, statistics as st
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))   # the scripts/ folder, for gold_game_context
from databricks.connect import DatabricksSession
import gold_game_context as g
spark = DatabricksSession.builder.profile("DEFAULT").serverless(True).getOrCreate()
g.build(spark).createOrReplaceTempView("gc")
rows = spark.sql("""
 SELECT c.team_id, c.season, c.game_date, c.is_home, c.days_rest, c.rest_edge, l.pts, l.opp_pts, l.fgm, l.fga, l.fg3m, l.tov, l.reb, l.ast
 FROM gc c JOIN workspace.nba_v2_gold.team_game_log l ON l.team_id = c.team_id AND l.game_id = c.game_id
 WHERE c.game_type='regular-season' AND c.is_final AND c.season <= 2026
 ORDER BY c.team_id, c.season, c.game_date""").collect()
print("games:", len(rows))
STATS = {  # name -> function of a list of game rows (so percentages are pooled)
 "pts": lambda r: sum(x.pts for x in r) / len(r), "allowed": lambda r: sum(x.opp_pts for x in r) / len(r),
 "margin": lambda r: sum(x.pts - x.opp_pts for x in r) / len(r),
 "fg_pct": lambda r: 100 * sum(x.fgm for x in r) / sum(x.fga for x in r), "fg3m": lambda r: sum(x.fg3m for x in r) / len(r),
 "tov": lambda r: sum(x.tov for x in r) / len(r), "reb": lambda r: sum(x.reb for x in r) / len(r), "ast": lambda r: sum(x.ast for x in r) / len(r)}
CTX = {  # name -> (label A, test A, label B, test B)
 "home vs away": (lambda x: x.is_home, lambda x: not x.is_home),
 "back-to-back vs 1+ day rest": (lambda x: x.days_rest == 0, lambda x: x.days_rest is not None and x.days_rest >= 1),
 "2+ days rest vs 1 day": (lambda x: x.days_rest is not None and x.days_rest >= 2, lambda x: x.days_rest == 1),
 "rest edge + vs -": (lambda x: x.rest_edge is not None and x.rest_edge > 0, lambda x: x.rest_edge is not None and x.rest_edge < 0),
}
def effect(games, a, b, f, minimum):
    ga = [x for x in games if a(x)]; gb = [x for x in games if b(x)]
    if len(ga) < minimum or len(gb) < minimum: return None
    return f(ga) - f(gb)
def corr(pairs):
    if len(pairs) < 20: return None, len(pairs)
    return st.correlation([p[0] for p in pairs], [p[1] for p in pairs]), len(pairs)
by = {}
for r in rows: by.setdefault((r.team_id, r.season), []).append(r)
print("\n1) LEAGUE-WIDE EFFECT (all team-games 2022-2026, A minus B; n = games in A / B; z = difference / standard error)")
for cn, (a, b) in CTX.items():
    allg = rows
    ga = [x for x in allg if a(x)]; gb = [x for x in allg if b(x)]
    out = []
    for sn in ["pts", "allowed", "margin", "fg_pct", "fg3m", "tov"]:
        f = STATS[sn]
        d = f(ga) - f(gb)
        if sn == "fg_pct":  # standard error from per-game percentages, close enough for a z
            va = [100 * x.fgm / x.fga for x in ga]; vb = [100 * x.fgm / x.fga for x in gb]
        else:
            fn = {"pts": lambda x: x.pts, "allowed": lambda x: x.opp_pts, "margin": lambda x: x.pts - x.opp_pts, "fg3m": lambda x: x.fg3m, "tov": lambda x: x.tov}[sn]
            va = [fn(x) for x in ga]; vb = [fn(x) for x in gb]
        se = math.sqrt(st.variance(va) / len(va) + st.variance(vb) / len(vb))
        out.append(f"{sn} {d:+.2f} (z {d/se:+.1f})")
    print(f"  {cn:30s} n={len(ga)}/{len(gb)} | " + " | ".join(out))
print("\n2) SAME TEAM, FIRST HALF vs SECOND HALF OF A SEASON (correlation r of the team's effect across team-seasons; |r| < 0.2 is mostly noise)")
print("   and 3) SAME TEAM, SEASON N vs SEASON N+1")
print(f"  {'context':30s} {'stat':8s} {'half r (n)':>14s} {'odd/even r (n)':>16s} {'next-season r (n)':>19s}")
for cn, (a, b) in CTX.items():
    for sn in ["pts", "allowed", "margin", "fg_pct", "fg3m", "tov"]:
        f = STATS[sn]; halves = []; oddeven = []; nxt = []
        for (tid, season), gs in by.items():
            m = len(gs) // 2
            e1, e2 = effect(gs[:m], a, b, f, 3), effect(gs[m:], a, b, f, 3)
            if e1 is not None and e2 is not None: halves.append((e1, e2))
            eo, ee = effect(gs[0::2], a, b, f, 3), effect(gs[1::2], a, b, f, 3)
            if eo is not None and ee is not None: oddeven.append((eo, ee))
            nx = by.get((tid, season + 1))
            if nx:
                e_this, e_next = effect(gs, a, b, f, 5), effect(nx, a, b, f, 5)
                if e_this is not None and e_next is not None: nxt.append((e_this, e_next))
        (r1, n1), (r2, n2), (r3, n3) = corr(halves), corr(oddeven), corr(nxt)
        fmt = lambda r, n: f"{r:+.2f} ({n})" if r is not None else "n/a"
        print(f"  {cn:30s} {sn:8s} {fmt(r1, n1):>14s} {fmt(r2, n2):>16s} {fmt(r3, n3):>19s}")
print("\n4) HOW MANY GAMES A TEAM-SEASON HAS IN EACH SITUATION (median)")
for cn, (a, b) in CTX.items():
    na = [sum(1 for x in gs if a(x)) for gs in by.values()]; nb = [sum(1 for x in gs if b(x)) for gs in by.values()]
    print(f"  {cn:30s} A median {st.median(na):.0f} (min {min(na)}, max {max(na)}) | B median {st.median(nb):.0f} (min {min(nb)}, max {max(nb)})")
