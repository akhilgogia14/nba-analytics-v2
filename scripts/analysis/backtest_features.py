"""Back-test of the Predictions baseline: the feature builder (pure Python, no Spark), so it can be unit-tested.

A "game" is one game a player PLAYED, as a dict: season (int), date (ISO text), game_id, opp (opponent team id) and the seven stats
pts, reb, ast, fg3m, blk, stl, minutes. A player's games are given oldest first.

For every game after his first MIN_HISTORY, build_rows() produces what was known BEFORE it (and only that), next to what happened:
  last10   mean of his previous 10 games, from any season (what the page calls "last 10 games")
  last5    mean of his previous 5 games
  ewma10   exponentially weighted mean of all previous games (weight 2/11 on the newest, so about a 10-game memory)
  season   mean of his previous games of the SAME season (None if there are none yet)
  career   mean of all previous games
  opp10    mean of his previous (up to) 10 games against this opponent, from any season (None if he never met them)
  lo10/hi10, loS/hiS   lowest and highest of the last 10 / of the season so far (the page's Min and Max)
Nothing here looks at the game itself or later ones; tests/test_backtest_features.py proves it.
"""
STATS = ["pts", "reb", "ast", "fg3m", "blk", "stl", "minutes"]
MIN_HISTORY = 10
WINDOW = 10
ALPHA = 2 / (10 + 1)


def _mean(xs):
    return sum(xs) / len(xs) if xs else None


def _vals(games, stat):
    return [g[stat] for g in games if g.get(stat) is not None]


def build_rows(games, min_history=MIN_HISTORY, window=WINDOW):
    """One row per game from index min_history on: identifying facts, and per stat {actual, last10, last5, ewma10, season, career, opp10, lo10, hi10, loS, hiS, n_season, n_opp}."""
    rows = []
    ewma = {s: None for s in STATS}
    for i, g in enumerate(games):
        if i >= min_history:
            prior = games[:i]
            last = prior[-window:]
            same_season = [x for x in prior if x["season"] == g["season"]]
            meetings = [x for x in prior if x["opp"] == g["opp"]][-window:]
            stats = {}
            for s in STATS:
                actual = g.get(s)
                if actual is None:
                    continue
                v10, v5, vS, vC, vO = _vals(last, s), _vals(prior[-5:], s), _vals(same_season, s), _vals(prior, s), _vals(meetings, s)
                stats[s] = {
                    "actual": actual, "last10": _mean(v10), "last5": _mean(v5), "ewma10": ewma[s], "season": _mean(vS), "career": _mean(vC),
                    "opp10": _mean(vO), "lo10": min(v10) if v10 else None, "hi10": max(v10) if v10 else None,
                    "loS": min(vS) if vS else None, "hiS": max(vS) if vS else None, "n_season": len(vS), "n_opp": len(vO),
                }
            rows.append({"i": i, "season": g["season"], "date": g["date"], "game_id": g.get("game_id"), "opp": g["opp"], "n_prior": i,
                         "prior_minutes": _mean(_vals(last, "minutes")), "stats": stats})
        for s in STATS:  # only now does the game join the history
            v = g.get(s)
            if v is not None:
                ewma[s] = v if ewma[s] is None else ALPHA * v + (1 - ALPHA) * ewma[s]
    return rows


def blend(last10, season, w):
    """w of the last-10 mean plus (1 - w) of the season mean; with no season games yet, the last-10 mean alone."""
    if last10 is None:
        return season
    if season is None:
        return last10
    return w * last10 + (1 - w) * season


def mae(pairs):
    """Mean absolute error of (prediction, actual) pairs; pairs with no prediction are skipped. None if there are none."""
    errs = [abs(p - a) for p, a in pairs if p is not None]
    return sum(errs) / len(errs) if errs else None


def rmse(pairs):
    errs = [(p - a) ** 2 for p, a in pairs if p is not None]
    return (sum(errs) / len(errs)) ** 0.5 if errs else None


def coverage(triples):
    """Share of (low, high, actual) triples whose actual lies inside [low, high] (inclusive); the mean width too. Triples with no range are skipped."""
    ok = [(lo, hi, a) for lo, hi, a in triples if lo is not None and hi is not None]
    if not ok:
        return None, None
    return sum(1 for lo, hi, a in ok if lo <= a <= hi) / len(ok), sum(hi - lo for lo, hi, _ in ok) / len(ok)
