"""A game whose team minutes are not a possible total is held back from silver team_game instead of stopping the build."""
import sys
from datetime import date
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import silver_build as s  # noqa: E402

PREFIX = "workspace.nba_v2_bronze."
BOX = ("game_id string, team_id int, season int, season_type_id int, team_city string, team_name string, team_tricode string, "
       "side string, minutes string, points int, rebounds_total int, assists int, three_pointers_made int, blocks int, steals int, "
       "turnovers int, fouls_personal int, field_goals_made int, field_goals_attempted int, three_pointers_attempted int, "
       "free_throws_made int, free_throws_attempted int, rebounds_offensive int, rebounds_defensive int, plus_minus_points double")


def box(gid, side, tid, minutes, points, opp_points):
    return (gid, tid, 2027, 2, "City", f"Team{tid}", f"T{tid:02d}", side, minutes, points, 40, 20, 12, 5, 7, 12, 18, 40, 85, 35, 15, 20,
            10, 30, float(points - opp_points))


def game(gid, home_minutes="240:00", away_minutes="240:00", hp=110, ap=100, base=10):
    return [box(gid, "home", base, home_minutes, hp, ap), box(gid, "away", base + 1, away_minutes, ap, hp)]


@pytest.fixture
def setup(spark):
    """Creates the bronze tables as temporary views named bronze_<table> and returns functions that run the real SQL files on them."""
    def local(sql):
        return sql.replace(PREFIX, "bronze_")

    def load(boxes):
        spark.createDataFrame(boxes, BOX).createOrReplaceTempView("bronze_team_boxscores")
        gids = sorted({b[0] for b in boxes})
        spark.createDataFrame([(g, date(2026, 11, 14), "regular-season", None, None) for g in gids],
                              "game_id string, game_date date, season_type string, home_pts int, away_pts int").createOrReplaceTempView("bronze_schedules")
        spark.createDataFrame([(b[0], b[1], b[9]) for b in boxes if b[1] != 0], "game_id string, team_id int, points int").createOrReplaceTempView("bronze_player_boxscores")

    def select():
        return spark.sql(local(s.strip_comments((ROOT / "sql/silver/team_game.sql").read_text())))

    def gates():
        select().createOrReplaceTempView("tg_src")
        rows = spark.sql(local(s.gates_sql((ROOT / "sql/silver/team_game_gates.sql").read_text(), "tg_src"))).collect()
        return {r[0]: int(r[1]) for r in rows}

    def warnings():
        select().createOrReplaceTempView("tg_src")
        return spark.sql(local(s.gates_sql((ROOT / "sql/silver/team_game_warnings.sql").read_text(), "tg_src"))).collect()

    return load, select, gates, warnings


def test_a_game_with_impossible_team_minutes_is_left_out_and_everything_else_is_kept(setup):
    load, select, gates, _ = setup
    load(game("g1") + game("g2", away_minutes="168:00", base=20) + game("g3", home_minutes="265:00", away_minutes="265:00", base=30))
    got = sorted((r["game_id"], r["team_id"]) for r in select().collect())
    assert got == [("g1", 10), ("g1", 11), ("g3", 30), ("g3", 31)]  # g2 is out on BOTH sides, the overtime game is in


def test_the_gates_expect_the_held_back_rows_to_be_missing(setup):
    load, _, gates, _ = setup
    load(game("g1") + game("g2", away_minutes="168:00", base=20))
    result = gates()
    assert {k: v for k, v in result.items() if v != 0} == {}, result
    assert "too_many_games_held_back" in result and "dropped_vs_bronze" in result


def test_the_warning_names_the_held_back_game_and_its_minutes(setup):
    load, _, _, warnings = setup
    load(game("g1") + game("g2", away_minutes="168:00", base=20))
    w = [r for r in warnings() if r["warning"] == "game_held_back_bad_team_minutes"]
    assert [r["row_key"] for r in w] == ["g2"]
    assert '"away_minutes":"168:00"' in w[0]["detail"] and '"home_minutes":"240:00"' in w[0]["detail"] and '"game_date":"2026-11-14"' in w[0]["detail"]


def test_five_held_back_games_are_tolerated_six_stop_the_build(setup):
    load, _, gates, _ = setup
    five = game("ok") + [row for i in range(5) for row in game(f"b{i}", away_minutes="168:00", base=20 + 2 * i)]
    load(five)
    assert gates()["too_many_games_held_back"] == 0
    load(five + game("b5", away_minutes="168:00", base=40))
    assert gates()["too_many_games_held_back"] == 1


def test_minutes_that_cannot_be_read_are_not_held_back_so_they_still_stop_the_build(setup):
    load, select, gates, _ = setup
    load(game("g1") + game("g2", away_minutes="", base=20))
    assert sorted({r["game_id"] for r in select().collect()}) == ["g1", "g2"]  # not held back
    assert gates()["minutes_unparsed"] == 1  # ... and the existing gate still fails loudly


def test_a_game_that_vanishes_for_any_other_reason_still_fails_the_row_count_gate(setup, spark):
    load, select, _, _ = setup
    load(game("g1") + game("g2", base=20))
    select().filter("game_id <> 'g2'").createOrReplaceTempView("tg_src")  # a normal game missing from the build
    gates_sql = s.gates_sql((ROOT / "sql/silver/team_game_gates.sql").read_text().replace(PREFIX, "bronze_"), "tg_src")
    assert {r[0]: int(r[1]) for r in spark.sql(gates_sql).collect()}["dropped_vs_bronze"] == 2
