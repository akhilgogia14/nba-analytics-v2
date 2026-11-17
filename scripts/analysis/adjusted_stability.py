"""Read-only: do the rest / home-away effects and a team's or player's own splits survive adjusting for home/away and opponent strength?"""
import math, statistics as st
import numpy as np
from databricks.connect import DatabricksSession
spark = DatabricksSession.builder.profile("DEFAULT").serverless(True).getOrCreate()
f = lambda v: None if v is None else float(v)

def design(rows, extra=()):
    """columns: home, b2b, rest2plus (baseline = 1 day of rest), edge_pos, edge_neg (baseline = even or unknown), then extras"""
    X = []
    for r in rows:
        X.append([1.0 if r["home"] else 0.0, 1.0 if r["rest"] == 0 else 0.0, 1.0 if r["rest"] >= 2 else 0.0,
                  1.0 if (r["edge"] or 0) > 0 else 0.0, 1.0 if (r["edge"] or 0) < 0 else 0.0] + [r[e] for e in extra])
    return np.column_stack([np.ones(len(X)), np.array(X)])
NAMES = ["intercept", "home (vs away)", "back-to-back (vs 1 day)", "2+ days (vs 1 day)", "rest edge + (vs even)", "rest edge - (vs even)"]
def ols(X, y):
    beta, *_ = np.linalg.lstsq(X, y, rcond=None)
    res = y - X @ beta
    s2 = res @ res / (len(y) - X.shape[1])
    se = np.sqrt(np.diag(s2 * np.linalg.inv(X.T @ X)))
    return beta, se
def raw_effects(rows, y):
    """the as-played A minus B, same contrasts as the regression's baselines, for comparison"""
    def d(a, b):
        ya = [y[i] for i, r in enumerate(rows) if a(r)]; yb = [y[i] for i, r in enumerate(rows) if b(r)]
        return np.mean(ya) - np.mean(yb), math.sqrt(np.var(ya, ddof=1) / len(ya) + np.var(yb, ddof=1) / len(yb))
    return {"home (vs away)": d(lambda r: r["home"], lambda r: not r["home"]),
            "back-to-back (vs 1 day)": d(lambda r: r["rest"] == 0, lambda r: r["rest"] == 1),
            "2+ days (vs 1 day)": d(lambda r: r["rest"] >= 2, lambda r: r["rest"] == 1),
            "rest edge + (vs even)": d(lambda r: (r["edge"] or 0) > 0, lambda r: (r["edge"] or 0) == 0),
            "rest edge - (vs even)": d(lambda r: (r["edge"] or 0) < 0, lambda r: (r["edge"] or 0) == 0)}
def table(title, rows, y, extra=(), unit=""):
    X = design(rows, extra); beta, se = ols(X, np.array(y)); raw = raw_effects(rows, y)
    print(f"  {title}")
    print(f"    {'situation':26s} {'as played':>16s} {'adjusted (home, opponent, other rest terms)':>46s}")
    for i, n in enumerate(NAMES[1:], start=1):
        rd, rs = raw[n]
        print(f"    {n:26s} {rd:+7.2f} (z {rd/rs:+5.1f}) {beta[i]:+14.2f} (z {beta[i]/se[i]:+5.1f})")
    if extra: print(f"    opponent term coefficient: {beta[len(NAMES)]:+.2f} (1.0 would mean the opponent's average effect carries over exactly)")
    return beta

def corr(pairs):
    if len(pairs) < 30: return None, len(pairs)
    return st.correlation([p[0] for p in pairs], [p[1] for p in pairs]), len(pairs)
fmt = lambda rn: f"{rn[0]:+.2f} ({rn[1]})" if rn[0] is not None else f"n/a ({rn[1]})"
CTX = {
 "home vs away": (lambda x: x["home"], lambda x: not x["home"]),
 "back-to-back vs 1 day": (lambda x: x["rest"] == 0, lambda x: x["rest"] == 1),
 "2+ days vs 1 day": (lambda x: x["rest"] >= 2, lambda x: x["rest"] == 1),
 "rest edge + vs -": (lambda x: (x["edge"] or 0) > 0, lambda x: (x["edge"] or 0) < 0),
}
def mean_of(gs, key): v = [x[key] for x in gs]; return sum(v) / len(v)
def own_effect(gs, a, b, key, minimum):
    ga = [x for x in gs if a(x)]; gb = [x for x in gs if b(x)]
    if len(ga) < minimum or len(gb) < minimum: return None
    return mean_of(ga, key) - mean_of(gb, key)
def stability(by, key, label):
    """by: {(id, season): games oldest first}; key = the adjusted value on each game"""
    out = []
    for cn, (a, b) in CTX.items():
        halves, oddeven, nxt = [], [], []
        for (pid, season), gs in by.items():
            m = len(gs) // 2
            e1, e2 = own_effect(gs[:m], a, b, key, 3), own_effect(gs[m:], a, b, key, 3)
            if e1 is not None and e2 is not None: halves.append((e1, e2))
            eo, ee = own_effect(gs[0::2], a, b, key, 3), own_effect(gs[1::2], a, b, key, 3)
            if eo is not None and ee is not None: oddeven.append((eo, ee))
            nx = by.get((pid, season + 1))
            if nx:
                e_t, e_n = own_effect(gs, a, b, key, 5), own_effect(nx, a, b, key, 5)
                if e_t is not None and e_n is not None: nxt.append((e_t, e_n))
        r = (corr(halves), corr(oddeven), corr(nxt)); out.append((cn, r))
        print(f"    {label:9s} {cn:24s} half {fmt(r[0]):>13s} | odd/even {fmt(r[1]):>13s} | next season {fmt(r[2]):>13s}")
    return out

# ================= TEAMS =================
t = spark.sql("""
 SELECT l.team_id, l.opponent_team_id, l.season, l.game_date, l.game_id, l.margin, l.pts, l.opp_pts, c.is_home, c.days_rest, c.rest_edge
 FROM workspace.nba_v2_gold.team_game_log l JOIN workspace.nba_v2_gold.game_context c ON c.team_id = l.team_id AND c.game_id = l.game_id
 WHERE l.game_type = 'regular-season' AND c.game_type = 'regular-season' AND c.is_final AND l.season <= 2026
 ORDER BY l.team_id, l.season, l.game_date, l.game_id""").collect()
T = [dict(team=r.team_id, opp=r.opponent_team_id, season=r.season, margin=f(r.margin), home=bool(r.is_home), rest=r.days_rest, edge=r.rest_edge) for r in t if r.days_rest is not None]
print("TEAM-GAMES with a known rest (regular season, 2021-22 to 2025-26):", len(T))
tm = {}
for g in T: tm.setdefault((g["team"], g["season"]), []).append(g["margin"])
rating = {k: sum(v) / len(v) for k, v in tm.items()}
for g in T:
    g["exp"] = rating[(g["team"], g["season"])] - rating.get((g["opp"], g["season"]), 0.0)   # what the two teams' season margins predict
    g["adj"] = g["margin"] - g["exp"]                                                       # margin beyond that
print("\n1) TEAMS: LEAGUE-WIDE EFFECT ON MARGIN, as played vs adjusted")
beta = table("margin beyond what the two teams' season ratings predict (team rating minus opponent rating)", T, [g["adj"] for g in T])
print("  (the as-played column above is on the adjusted margin; for the plain as-played margin see the release 052 note: home +3.9, back-to-back -2.4, rest edge +3.2)")
table("plain margin, no rating adjustment, but all situations in one model (home, rest and edge together)", T, [g["margin"] for g in T])
bh = beta[1]
print("\n2) TEAMS: DOES A TEAM'S OWN SPLIT REPEAT AFTER REMOVING HOME/AWAY AND OPPONENT STRENGTH?  (margin; r (n team-seasons))")
for g in T: g["adj2"] = g["adj"] - bh * (0.5 if g["home"] else -0.5)       # also take out the average home edge
for g in T: g["adj_nohome"] = g["adj"]
by = {}
for g in T: by.setdefault((g["team"], g["season"]), []).append(g)
res_raw = stability(by, "margin", "as played")
res_adj = stability(by, "adj2", "adjusted")

# ================= PLAYERS =================
p = spark.sql("""
 SELECT p.person_id, p.season, p.game_date, p.game_id, p.opponent_team_id, p.pts, p.reb, p.ast, p.fg3m, p.blk, p.stl, p.minutes, c.is_home, c.days_rest, c.rest_edge
 FROM workspace.nba_v2_gold.player_season_games p JOIN workspace.nba_v2_gold.game_context c ON c.team_id = p.team_id AND c.game_id = p.game_id
 WHERE p.played AND p.game_type = 'regular-season' AND c.game_type = 'regular-season' AND c.is_final AND p.season <= 2026
 ORDER BY p.person_id, p.season, p.game_date, p.game_id""").collect()
STATS = ["pts", "reb", "ast", "fg3m", "blk", "stl", "minutes"]
P = [dict(pid=r.person_id, season=r.season, opp=r.opponent_team_id, home=bool(r.is_home), rest=r.days_rest, edge=r.rest_edge, **{s: f(getattr(r, s)) for s in STATS})
     for r in p if r.days_rest is not None]
byp = {}
for g in P: byp.setdefault((g["pid"], g["season"]), []).append(g)
byp = {k: v for k, v in byp.items() if len(v) >= 20}
P = [g for v in byp.values() for g in v]
print("\nPLAYER-GAMES played, in player-seasons with 20+ games played:", len(P), "| player-seasons:", len(byp))
print("\n3) PLAYERS: LEAGUE-WIDE EFFECT vs THE PLAYER'S OWN SEASON AVERAGE, as played vs adjusted for home, other rest terms and OPPONENT (how much the opposing team's games usually run above or below players' own averages)")
for s in STATS:
    own = {k: mean_of(v, s) for k, v in byp.items()}
    for g in P: g["y_" + s] = g[s] - own[(g["pid"], g["season"])]
    opp_eff = {}
    for g in P: opp_eff.setdefault((g["opp"], g["season"]), []).append(g["y_" + s])
    opp_eff = {k: sum(v) / len(v) for k, v in opp_eff.items()}
    for g in P: g["opp_" + s] = opp_eff[(g["opp"], g["season"])]
    table(f"{s}", P, [g["y_" + s] for g in P], extra=("opp_" + s,))
print("\n4) PLAYERS: DOES A PLAYER'S OWN SPLIT REPEAT AFTER REMOVING HOME/AWAY AND OPPONENT?  (r (n player-seasons))")
for s in STATS:
    X = design(P, extra=("opp_" + s,)); beta, _ = ols(X, np.array([g["y_" + s] for g in P]))
    for g in P: g["adj_" + s] = g["y_" + s] - beta[1] * (1.0 if g["home"] else 0.0) - beta[6] * g["opp_" + s]
    print(f"  {s}")
    # the player's own home-away split is judged with home left in, opponent removed
    for g in P: g["ao_" + s] = g["y_" + s] - beta[6] * g["opp_" + s]
    r_adj = stability(byp, "adj_" + s, "adjusted")
    r_raw = stability(byp, "y_" + s, "as played")
    # one-line numeric summary for the closing table
    vals_raw = [x for _, r in r_raw for x in [m[0] for m in r] if x is not None]
    vals_adj = [x for _, r in r_adj for x in [m[0] for m in r] if x is not None]
    print(f"    -> {s}: as played mean r {sum(vals_raw)/len(vals_raw):+.3f} (max {max(vals_raw):+.2f}) | adjusted mean r {sum(vals_adj)/len(vals_adj):+.3f} (max {max(vals_adj):+.2f})")
