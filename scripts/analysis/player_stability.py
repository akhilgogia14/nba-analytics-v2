"""Read-only: are a PLAYER's own rest and home/away splits steady enough to show on a screen?"""
import math, statistics as st
from databricks.connect import DatabricksSession
spark = DatabricksSession.builder.profile("DEFAULT").serverless(True).getOrCreate()
rows = spark.sql("""
 SELECT p.person_id, p.season, p.game_date, p.game_id, p.played, p.pts, p.reb, p.ast, p.fg3m, p.blk, p.stl, p.minutes,
        c.is_home, c.days_rest, c.rest_edge
 FROM workspace.nba_v2_gold.player_season_games p
 JOIN workspace.nba_v2_gold.game_context c ON c.team_id = p.team_id AND c.game_id = p.game_id
 WHERE p.game_type = 'regular-season' AND c.game_type = 'regular-season' AND c.is_final AND p.season <= 2026
 ORDER BY p.person_id, p.season, p.game_date, p.game_id""").collect()
from types import SimpleNamespace
_f = lambda v: None if v is None else float(v)
rows = [SimpleNamespace(person_id=r.person_id, season=r.season, game_date=r.game_date, game_id=r.game_id, played=bool(r.played),
        pts=_f(r.pts), reb=_f(r.reb), ast=_f(r.ast), fg3m=_f(r.fg3m), blk=_f(r.blk), stl=_f(r.stl), minutes=_f(r.minutes),
        is_home=bool(r.is_home), days_rest=r.days_rest, rest_edge=r.rest_edge) for r in rows]
print("grid rows (played or not):", len(rows), "| played:", sum(1 for r in rows if r.played))
STATS = ["pts", "reb", "ast", "fg3m", "blk", "stl", "minutes"]
CTX = {
 "home vs away": (lambda x: x.is_home, lambda x: not x.is_home),
 "back-to-back vs 1+ day rest": (lambda x: x.days_rest == 0, lambda x: x.days_rest is not None and x.days_rest >= 1),
 "2+ days rest vs 1 day": (lambda x: x.days_rest is not None and x.days_rest >= 2, lambda x: x.days_rest == 1),
 "rest edge + vs -": (lambda x: x.rest_edge is not None and x.rest_edge > 0, lambda x: x.rest_edge is not None and x.rest_edge < 0),
}
by = {}
for r in rows: by.setdefault((r.person_id, r.season), []).append(r)
by = {k: v for k, v in by.items() if sum(1 for x in v if x.played) >= 20}   # player-seasons with 20+ games played (same rule as the page)
print("player-seasons with 20+ games played:", len(by))
def mean_stat(gs, s): v = [getattr(x, s) for x in gs if x.played and getattr(x, s) is not None]; return sum(v) / len(v) if v else None
def effect(games, a, b, s, minimum):
    ga = [x for x in games if a(x) and x.played]; gb = [x for x in games if b(x) and x.played]
    if len(ga) < minimum or len(gb) < minimum: return None
    return mean_stat(ga, s) - mean_stat(gb, s)
def avail(games, a, b, minimum):  # share of team games played in A minus in B
    ga = [x for x in games if a(x)]; gb = [x for x in games if b(x)]
    if len(ga) < minimum or len(gb) < minimum: return None
    return 100 * sum(x.played for x in ga) / len(ga) - 100 * sum(x.played for x in gb) / len(gb)
def corr(pairs):
    if len(pairs) < 30: return None, len(pairs)
    return st.correlation([p[0] for p in pairs], [p[1] for p in pairs]), len(pairs)
fmt = lambda rn: f"{rn[0]:+.2f} ({rn[1]})" if rn[0] is not None else f"n/a ({rn[1]})"

print("\n1) LEAGUE-WIDE 'vs OWN SEASON AVERAGE' EFFECT (player-seasons with 20+ games played; A minus B; z = difference / standard error)")
own = {}
for k, gs in by.items():
    own[k] = {s: mean_stat(gs, s) for s in STATS}
for cn, (a, b) in CTX.items():
    out = []
    for s in STATS:
        va = [getattr(x, s) - own[k][s] for k, gs in by.items() for x in gs if x.played and a(x) and getattr(x, s) is not None]
        vb = [getattr(x, s) - own[k][s] for k, gs in by.items() for x in gs if x.played and b(x) and getattr(x, s) is not None]
        d = sum(va) / len(va) - sum(vb) / len(vb); se = math.sqrt(st.variance(va) / len(va) + st.variance(vb) / len(vb))
        out.append(f"{s} {d:+.2f} (z {d/se:+.1f})")
    na = sum(1 for gs in by.values() for x in gs if x.played and a(x)); nb = sum(1 for gs in by.values() for x in gs if x.played and b(x))
    sa = [x.played for gs in by.values() for x in gs if a(x)]; sb = [x.played for gs in by.values() for x in gs if b(x)]
    pa, pb = 100 * sum(sa) / len(sa), 100 * sum(sb) / len(sb)
    print(f"  {cn:28s} played {na}/{nb} | " + " | ".join(out) + f" | availability {pa:.1f}% vs {pb:.1f}% ({pa-pb:+.1f} pts)")

print("\n2) SAME PLAYER, FIRST HALF vs SECOND HALF of his season (r of his effect across player-seasons); odd/even games; season N vs N+1")
print(f"  {'context':28s} {'stat':14s} {'half r (n)':>14s} {'odd/even r (n)':>16s} {'next-season r (n)':>19s}")
results = []
for cn, (a, b) in CTX.items():
    for s in STATS + ["availability"]:
        halves, oddeven, nxt = [], [], []
        for (pid, season), gs in by.items():
            m = len(gs) // 2
            f = (lambda g, mn: avail(g, a, b, mn)) if s == "availability" else (lambda g, mn: effect(g, a, b, s, mn))
            e1, e2 = f(gs[:m], 3), f(gs[m:], 3)
            if e1 is not None and e2 is not None: halves.append((e1, e2))
            eo, ee = f(gs[0::2], 3), f(gs[1::2], 3)
            if eo is not None and ee is not None: oddeven.append((eo, ee))
            nx = by.get((pid, season + 1))
            if nx:
                e_this, e_next = f(gs, 5), f(nx, 5)
                if e_this is not None and e_next is not None: nxt.append((e_this, e_next))
        r1, r2, r3 = corr(halves), corr(oddeven), corr(nxt)
        results.append((cn, s, r1, r2, r3))
        print(f"  {cn:28s} {s:14s} {fmt(r1):>14s} {fmt(r2):>16s} {fmt(r3):>19s}")
vals = [r for _, s, *rs in results if s != "availability" for r in [x[0] for x in rs] if r is not None]
av = [r for _, s, *rs in results if s == "availability" for r in [x[0] for x in rs] if r is not None]
print(f"\nSUMMARY stats (28 per method): lowest r {min(vals):+.2f}, highest {max(vals):+.2f}, mean {sum(vals)/len(vals):+.3f}, share above +0.16: {sum(1 for v in vals if v>0.16)}/{len(vals)}")
print(f"SUMMARY availability: values {[round(v,2) for v in av]}")
print("\n3) HOW MANY GAMES A PLAYER-SEASON HAS IN EACH SITUATION (median played games, and median team games)")
for cn, (a, b) in CTX.items():
    pa = [sum(1 for x in gs if x.played and a(x)) for gs in by.values()]; pb = [sum(1 for x in gs if x.played and b(x)) for gs in by.values()]
    print(f"  {cn:28s} A median {st.median(pa):.0f} (p10 {sorted(pa)[len(pa)//10]}) | B median {st.median(pb):.0f} (p10 {sorted(pb)[len(pb)//10]})")
