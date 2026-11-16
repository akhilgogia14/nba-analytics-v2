"""A game held back from silver team_game (impossible team minutes) is held back from silver player_game too."""
import sys
from datetime import date
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import silver_build as s  # noqa: E402

PREFIX = "workspace.nba_v2_bronze."
TEAM_BOX = ("game_id string, team_id int, season int, season_type_id int, team_city string, team_name string, team_tricode string, "
            "side string, minutes string, points int, rebounds_total int, assists int, three_pointers_made int, blocks int, steals int, "
            "turnovers int, fouls_personal int, field_goals_made int, field_goals_attempted int, three_pointers_attempted int, "
            "free_throws_made int, free_throws_attempted int, rebounds_offensive int, rebounds_defensive int, plus_minus_points double")
PLAYER_BOX = ("game_id string, person_id int, team_id int, season int, season_type_id int, first_name string, family_name string, "
              "team_tricode string, side string, minutes string, position string, comment string, points int, rebounds_total int, "
              "assists int, three_pointers_made int, blocks int, steals int, turnovers int, fouls_personal int, field_goals_made int, "
              "field_goals_attempted int, three_pointers_attempted int, free_throws_made int, free_throws_attempted int, "
              "rebounds_offensive int, rebounds_defensive int, plus_minus_points double")
SCHEDULE = ("game_id string, game_date date, season_type string, home_team_id int, away_team_id int, "
            "home_team_abbreviation string, away_team_abbreviation string, home_pts int, away_pts int")


def game(gid, base, home_minutes="240:00", away_minutes="240:00"):
    """Two teams of five starters (20 points each = 100 for the team), plus the matching team rows and schedule row."""
    teams, players = [], []
    for side, tid, minutes in (("home", base, home_minutes), ("away", base + 1, away_minutes)):
        teams.append((gid, tid, 2027, 2, "City", f"Team{tid}", f"T{tid:02d}", side, minutes, 100, 40, 20, 12, 5, 7, 12, 18, 40, 85, 35, 15, 20, 10, 30, 0.0))
        for k in range(5):
            players.append((gid, tid * 100 + k, tid, 2027, 2, "First", f"Last{tid}{k}", f"T{tid:02d}", side, "30:00", "G", "", 20, 8, 4, 2, 1, 1, 2, 3, 7, 15, 6, 3, 4, 2, 6, 0.0))
    sched = (gid, date(2026, 11, 14), "regular-season", base, base + 1, f"T{base:02d}", f"T{base + 1:02d}", None, None)
    return teams, players, sched


@pytest.fixture
def setup(spark):
    def local(sql):
        return sql.replace(PREFIX, "bronze_")

    def load(*games):
        spark.createDataFrame([t for g in games for t in g[0]], TEAM_BOX).createOrReplaceTempView("bronze_team_boxscores")
        spark.createDataFrame([p for g in games for p in g[1]], PLAYER_BOX).createOrReplaceTempView("bronze_player_boxscores")
        spark.createDataFrame([g[2] for g in games], SCHEDULE).createOrReplaceTempView("bronze_schedules")

    def select(name):
        return spark.sql(local(s.strip_comments((ROOT / f"sql/silver/{name}.sql").read_text())))

    def gates(name):
        select(name).createOrReplaceTempView("src")
        rows = spark.sql(local(s.gates_sql((ROOT / f"sql/silver/{name}_gates.sql").read_text(), "src"))).collect()
        return {r[0]: int(r[1]) for r in rows}

    return load, select, gates


def test_the_held_back_games_players_are_left_out_and_other_games_are_kept(setup):
    load, select, _ = setup
    load(game("g1", 10), game("g2", 20, away_minutes="168:00"), game("g3", 30, home_minutes="265:00", away_minutes="265:00"))
    got = {r["game_id"] for r in select("player_game").collect()}
    assert got == {"g1", "g3"}
    assert select("player_game").filter("game_id = 'g1'").count() == 10


def test_player_game_and_team_game_always_hold_back_the_same_games(setup):
    load, select, _ = setup
    load(game("g1", 10), game("g2", 20, away_minutes="168:00"), game("g3", 30, home_minutes="239:59"), game("g4", 40, home_minutes="250:00"))
    players = {r["game_id"] for r in select("player_game").collect()}
    teams = {r["game_id"] for r in select("team_game").collect()}
    assert players == teams == {"g1"}  # 168:00, 239:59 and 250:00 (not 240 + a multiple of 25) are all impossible


def test_the_player_gates_pass_with_a_game_held_back_and_still_fail_for_a_game_that_vanishes_otherwise(setup, spark):
    load, select, gates = setup
    load(game("g1", 10), game("g2", 20, away_minutes="168:00"))
    assert {k: v for k, v in gates("player_game").items() if v != 0} == {}
    select("player_game").filter("game_id <> 'g1'").createOrReplaceTempView("src")  # a normal game missing from the build
    sql = s.gates_sql((ROOT / "sql/silver/player_game_gates.sql").read_text().replace(PREFIX, "bronze_"), "src")
    assert {r[0]: int(r[1]) for r in spark.sql(sql).collect()}["dropped_vs_bronze"] == 10
