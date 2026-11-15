import sys
from datetime import date
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

SCHEMA = ("game_id string, season int, season_type string, game_date date, home_team_id int, home_tricode string, home_team_name string, "
          "away_team_id int, away_tricode string, away_team_name string, home_pts int, away_pts int, is_final boolean, home_won boolean, "
          "result_from_box_score boolean, has_box_score boolean, _row_hash string")


def game(gid, d, home, away, season=2027, stype="regular-season", final=True):
    hp, ap = (100, 90) if final else (None, None)
    return (gid, season, stype, d, home, f"T{home:02d}", f"Team {home}", away, f"T{away:02d}", f"Team {away}", hp, ap,
            final, (hp > ap) if final else None, False, final, "x")


def run(spark, rows):
    g = pytest.importorskip("gold_game_context")
    return {(r["team_id"], r["game_id"]): r.asDict() for r in g.transform(spark.createDataFrame(rows, SCHEMA)).collect()}


def test_rest_days_and_back_to_back_follow_the_gap_since_the_teams_last_game(spark):
    rows = [game("a", date(2026, 11, 1), 1, 2), game("b", date(2026, 11, 2), 3, 1), game("c", date(2026, 11, 5), 1, 4)]
    out = run(spark, rows)
    assert [out[(1, g)]["days_rest"] for g in "abc"] == [None, 0, 2]
    assert [out[(1, g)]["is_b2b"] for g in "abc"] == [None, True, False]
    assert out[(2, "a")]["days_rest"] is None  # a team's only game: no previous game


def test_a_new_season_starts_fresh_even_if_the_old_season_ended_days_earlier_in_the_data(spark):
    rows = [game("old", date(2026, 6, 10), 1, 2, season=2026, stype="playoffs"), game("new", date(2026, 10, 20), 1, 3, season=2027)]
    out = run(spark, rows)
    assert out[(1, "new")]["days_rest"] is None and out[(1, "new")]["games_in_4"] == 1


def test_crowded_stretches_count_this_game_and_the_days_before_it(spark):
    rows = [game("a", date(2026, 11, 1), 1, 2), game("b", date(2026, 11, 2), 1, 3), game("c", date(2026, 11, 4), 1, 4),
            game("d", date(2026, 11, 6), 1, 5)]
    out = run(spark, rows)
    assert [out[(1, g)]["games_in_4"] for g in "abcd"] == [1, 2, 3, 2]  # Nov 6: the 4 days Nov 3-6 hold only c and d
    assert [out[(1, g)]["is_3_in_4"] for g in "abcd"] == [False, False, True, False]
    assert [out[(1, g)]["games_in_6"] for g in "abcd"] == [1, 2, 3, 4]  # Nov 6: the 6 days Nov 1-6 hold all four
    assert [out[(1, g)]["is_4_in_6"] for g in "abcd"] == [False, False, False, True]


def test_home_and_road_stints_count_games_in_a_row_at_the_same_place(spark):
    rows = [game("a", date(2026, 11, 1), 1, 2), game("b", date(2026, 11, 3), 1, 3), game("c", date(2026, 11, 5), 4, 1),
            game("d", date(2026, 11, 7), 5, 1), game("e", date(2026, 11, 9), 6, 1), game("f", date(2026, 11, 11), 1, 7)]
    out = run(spark, rows)
    assert [(out[(1, g)]["is_home"], out[(1, g)]["stint_game_number"]) for g in "abcdef"] == [
        (True, 1), (True, 2), (False, 1), (False, 2), (False, 3), (True, 1)]


def test_opponent_rest_and_the_rest_edge_mirror_each_other(spark):
    rows = [game("a", date(2026, 11, 1), 1, 2), game("b", date(2026, 11, 2), 3, 4), game("c", date(2026, 11, 3), 1, 3)]
    out = run(spark, rows)
    # game c: team 1 last played Nov 1 (rest 1), team 3 played Nov 2 (rest 0)
    assert (out[(1, "c")]["days_rest"], out[(1, "c")]["opp_days_rest"], out[(1, "c")]["rest_edge"]) == (1, 0, 1)
    assert (out[(3, "c")]["days_rest"], out[(3, "c")]["opp_days_rest"], out[(3, "c")]["rest_edge"]) == (0, 1, -1)
    assert out[(1, "a")]["rest_edge"] is None  # team 1 is on its first game


def test_preseason_and_all_star_games_are_left_out_and_unplayed_games_are_kept(spark):
    rows = [game("pre", date(2026, 10, 10), 1, 2, stype="preseason"), game("asg", date(2026, 2, 15), 1, 2, season=2026, stype="all-star"),
            game("g1", date(2026, 11, 1), 1, 2), game("g2", date(2026, 11, 15), 1, 3, final=False)]
    out = run(spark, rows)
    assert sorted(g for _, g in out) == ["g1", "g1", "g2", "g2"]
    assert out[(1, "g2")]["is_final"] is False and out[(1, "g2")]["days_rest"] == 13
    assert out[(1, "g1")]["days_rest"] is None  # the preseason game does not count as the previous game


def test_columns_are_exactly_the_documented_ones_in_order(spark):
    g = pytest.importorskip("gold_game_context")
    df = g.transform(spark.createDataFrame([game("a", date(2026, 11, 1), 1, 2)], SCHEMA))
    assert df.columns == g.OUTPUT_COLUMNS


def test_python_table_is_registered():
    import silver_build as s
    assert s.TABLES["game_context"] == {"key": ["team_id", "game_id"], "layer": "gold", "python": "gold_game_context"}
