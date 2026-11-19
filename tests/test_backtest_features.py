import copy
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts" / "analysis"))
import backtest_features as b  # noqa: E402


def game(i, season=2026, opp=1, **o):
    base = {"season": season, "date": f"2026-{1 + i // 28:02d}-{1 + i % 28:02d}", "game_id": f"g{i:03d}", "opp": opp,
            "pts": 10 + i, "reb": i % 7, "ast": i % 5, "fg3m": i % 4, "blk": i % 3, "stl": i % 2, "minutes": 30.0}
    base.update(o)
    return base


def history(n=30, **o):
    return [game(i, **o) for i in range(n)]


def test_rows_start_after_the_minimum_history():
    rows = b.build_rows(history(14))
    assert [r["i"] for r in rows] == [10, 11, 12, 13]
    assert b.build_rows(history(10)) == []


def test_predictors_are_means_of_the_games_before_the_target():
    games = history(20)
    r = b.build_rows(games)[0]  # target = game 10
    assert r["stats"]["pts"]["actual"] == 20
    assert r["stats"]["pts"]["last10"] == sum(10 + k for k in range(0, 10)) / 10  # games 0-9
    assert r["stats"]["pts"]["last5"] == sum(10 + k for k in range(5, 10)) / 5
    assert r["stats"]["pts"]["career"] == r["stats"]["pts"]["last10"]
    assert (r["stats"]["pts"]["lo10"], r["stats"]["pts"]["hi10"]) == (10, 19)


def test_the_future_never_leaks_into_a_prediction():
    games = history(40)
    k = 25
    before = b.build_rows(games)[k - b.MIN_HISTORY]
    altered = copy.deepcopy(games)
    for g in altered[k:]:  # the target game and everything after it become absurd
        for s in b.STATS:
            g[s] = 9999
    after = b.build_rows(altered)[k - b.MIN_HISTORY]
    for s in b.STATS:
        for key in ("last10", "last5", "ewma10", "season", "career", "opp10", "lo10", "hi10", "loS", "hiS", "n_season", "n_opp"):
            assert before["stats"][s][key] == after["stats"][s][key], (s, key)
    assert after["stats"]["pts"]["actual"] == 9999  # only the answer changed


def test_season_mean_uses_only_the_same_season_and_is_none_at_a_new_season():
    games = history(15, season=2025) + [game(15 + i, season=2026) for i in range(5)]
    rows = {r["i"]: r for r in b.build_rows(games)}
    assert rows[15]["stats"]["pts"]["season"] is None and rows[15]["stats"]["pts"]["n_season"] == 0  # first game of the new season
    assert rows[15]["stats"]["pts"]["last10"] is not None  # but last-10 reaches back across the seasons
    assert rows[17]["stats"]["pts"]["season"] == (25 + 26) / 2 and rows[17]["stats"]["pts"]["n_season"] == 2
    assert rows[17]["stats"]["pts"]["loS"] == 25 and rows[17]["stats"]["pts"]["hiS"] == 26


def test_opponent_history_is_that_opponents_games_only_and_capped_at_ten():
    games = [game(i, opp=7 if i % 2 == 0 else 8) for i in range(40)]
    r = [x for x in b.build_rows(games) if x["i"] == 30][0]  # opp 7
    mine = [10 + k for k in range(0, 30) if k % 2 == 0][-10:]
    assert r["stats"]["pts"]["opp10"] == sum(mine) / 10 and r["stats"]["pts"]["n_opp"] == 10
    never = [x for x in b.build_rows(history(15) + [game(15, opp=99)]) if x["i"] == 15][0]
    assert never["stats"]["pts"]["opp10"] is None and never["stats"]["pts"]["n_opp"] == 0


def test_ewma_is_an_exponentially_weighted_mean_of_all_previous_games():
    games = history(12, pts=0) 
    games[0]["pts"] = 100
    r = b.build_rows(games)[0]  # target game 10; ewma over games 0-9: 100 decays by (1 - alpha) each game
    assert abs(r["stats"]["pts"]["ewma10"] - 100 * (1 - b.ALPHA) ** 9) < 1e-9


def test_a_gap_is_skipped_not_counted_as_zero():
    games = history(14)
    games[5]["pts"] = None
    r = b.build_rows(games)[0]
    assert r["stats"]["pts"]["last10"] == sum(10 + k for k in range(10) if k != 5) / 9
    games[10]["pts"] = None  # no answer, so no row for that stat
    assert "pts" not in b.build_rows(games)[0]["stats"] and "reb" in b.build_rows(games)[0]["stats"]


def test_blend_falls_back_to_the_one_there_is():
    assert b.blend(20, 10, 0.5) == 15
    assert b.blend(20, 10, 1.0) == 20 and b.blend(20, 10, 0.0) == 10
    assert b.blend(20, None, 0.5) == 20 and b.blend(None, 10, 0.5) == 10 and b.blend(None, None, 0.5) is None


def test_metrics():
    assert b.mae([(10, 12), (10, 7), (None, 5)]) == 2.5  # the pair with no prediction is skipped
    assert abs(b.rmse([(10, 12), (10, 7)]) - ((4 + 9) / 2) ** 0.5) < 1e-12
    assert b.mae([]) is None and b.rmse([(None, 1)]) is None
    assert b.coverage([(1, 5, 5), (1, 5, 0), (None, None, 3)]) == (0.5, 4.0)  # inclusive ends; no range skipped
    assert b.coverage([]) == (None, None)
