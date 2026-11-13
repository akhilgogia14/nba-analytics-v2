import sys
from datetime import date, timedelta
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

PLAYER_COLS = ["minutes_seconds", "minutes", "pts", "reb", "ast", "fg3m", "blk", "stl", "tov", "pf", "fgm", "fga",
               "fg3a", "ftm", "fta", "oreb", "dreb", "plus_minus"]


def make_teams(spark, teams):
    """teams: {team_id: (tricode, [(season, season_type), ...] oldest first)}. Game ids are '<team>-<n>', dates run daily."""
    rows = []
    for tid, (tri, games) in teams.items():
        for i, (season, stype) in enumerate(games, start=1):
            rows.append((f"{tid}-{i}", tid, date(2026, 1, 1) + timedelta(days=i), season, stype, tri, i % 2 == 0, 99, "OPP"))
    return spark.createDataFrame(rows, "game_id string, team_id int, game_date date, season int, season_type string, "
                                       "team_tricode string, is_home boolean, opponent_team_id int, opponent_tricode string")


def make_players(spark, rows):
    """rows: [dict(person_id, team_id, game, name, mins, pts, ...)]; game is '<team>-<n>'. Unlisted stats are 0.
    Date, season and season type are copied from the team schedule rows given in `sched` below by the caller."""
    out = []
    for r in rows:
        stats = {c: 0 for c in PLAYER_COLS}
        stats.update(minutes=0.0, plus_minus=0.0)  # the two decimal columns
        stats.update({k: v for k, v in r.items() if k in PLAYER_COLS})
        if "minutes_seconds" not in r and "mins" in r:
            stats["minutes_seconds"] = None if r["mins"] is None else r["mins"] * 60
            stats["minutes"] = None if r["mins"] is None else float(r["mins"])
        out.append((r["person_id"], r["team_id"], r["game"], r["name"], *[stats[c] for c in PLAYER_COLS]))
    return out


def run(spark, teams, player_rows):
    g = pytest.importorskip("gold_player_season_games")
    team_df = make_teams(spark, teams)
    sched = {(r["game_id"]): r for r in team_df.collect()}
    rows = []
    for p in make_players(spark, player_rows):
        s = sched[p[2]]
        rows.append((p[2], p[0], p[1], s["game_date"], s["season"], s["season_type"], p[3], *p[4:]))
    schema = ("game_id string, person_id int, team_id int, game_date date, season int, season_type string, player_name string, "
              "minutes_seconds int, minutes double, pts int, reb int, ast int, fg3m int, blk int, stl int, tov int, pf int, "
              "fgm int, fga int, fg3a int, ftm int, fta int, oreb int, dreb int, plus_minus double")
    players = spark.createDataFrame(rows, schema)
    out = g.transform(players, team_df).collect()
    return {(r["person_id"], r["team_id"], r["game_id"]): r.asDict() for r in out}


REG = "regular-season"


def test_missed_games_are_filled_in_from_the_team_schedule(spark):
    # team 1 plays 5 games. Player 7 plays games 1, 2 and 5; has a did-not-play row for game 3; no row at all for game 4.
    teams = {1: ("AAA", [(2026, REG)] * 5)}
    rows = [dict(person_id=7, team_id=1, game="1-1", name="P", mins=30, pts=20, reb=5, ast=3, fg3m=2, blk=1, stl=0),
            dict(person_id=7, team_id=1, game="1-2", name="P", mins=10, pts=4, reb=1, ast=0),
            dict(person_id=7, team_id=1, game="1-3", name="P", mins=0),
            dict(person_id=7, team_id=1, game="1-5", name="P", mins=22, pts=11, reb=9, ast=1, fg3m=0, blk=2, stl=3)]
    out = run(spark, teams, rows)
    assert len(out) == 5 and {k[0] for k in out} == {7}
    assert [out[(7, 1, f"1-{i}")]["played"] for i in range(1, 6)] == [True, True, False, False, True]
    assert [out[(7, 1, f"1-{i}")]["game_number"] for i in range(1, 6)] == [1, 2, 3, 4, 5]
    assert all(r["team_games"] == 5 for r in out.values())
    first, missed, last = out[(7, 1, "1-1")], out[(7, 1, "1-4")], out[(7, 1, "1-5")]
    assert (first["pts"], first["reb"], first["ast"], first["fg3m"], first["blk"], first["stl"], first["minutes"]) == (20, 5, 3, 2, 1, 0, 30.0)
    assert (last["pts"], last["reb"], last["blk"], last["stl"]) == (11, 9, 2, 3)
    assert all(missed[c] is None for c in ("pts", "reb", "ast", "fg3m", "blk", "stl", "minutes"))
    assert out[(7, 1, "1-3")]["pts"] is None  # the did-not-play row's zeros are not shown as stats
    assert (first["season_label"], first["game_type"], first["team_tricode"], first["opponent_tricode"]) == ("2025-26", REG, "AAA", "OPP")
    assert (first["opponent_team_id"], first["is_home"], out[(7, 1, "1-2")]["is_home"], first["game_date"]) == (99, False, True, date(2026, 1, 2))
    assert first["other_teams"] is None


def test_a_player_with_one_game_gets_the_whole_team_season(spark):
    teams = {1: ("AAA", [(2026, REG)] * 4)}
    out = run(spark, teams, [dict(person_id=7, team_id=1, game="1-3", name="P", mins=2, pts=0)])
    assert sorted(k[2] for k in out) == ["1-1", "1-2", "1-3", "1-4"]
    assert sorted(r["played"] for r in out.values()) == [False, False, False, True]
    assert out[(7, 1, "1-3")]["pts"] == 0  # played, scored nothing: shown as 0, not empty


def test_a_traded_player_has_a_full_grid_for_each_team_and_a_note(spark):
    teams = {1: ("AAA", [(2026, REG)] * 4), 2: ("BBB", [(2026, REG)] * 3)}
    rows = [dict(person_id=7, team_id=1, game="1-1", name="P", mins=20, pts=8),
            dict(person_id=7, team_id=1, game="1-2", name="P", mins=20, pts=9),
            dict(person_id=7, team_id=2, game="2-2", name="P", mins=25, pts=14),
            dict(person_id=7, team_id=2, game="2-3", name="P", mins=25, pts=15)]
    out = run(spark, teams, rows)
    assert len(out) == 7  # 4 + 3
    a = [r for k, r in out.items() if k[1] == 1]
    b = [r for k, r in out.items() if k[1] == 2]
    assert len(a) == 4 and sum(r["played"] for r in a) == 2 and {r["other_teams"] for r in a} == {"BBB"}
    assert len(b) == 3 and sum(r["played"] for r in b) == 2 and {r["other_teams"] for r in b} == {"AAA"}
    assert out[(7, 2, "2-1")]["played"] is False and out[(7, 1, "1-4")]["played"] is False


def test_three_teams_list_the_other_two_alphabetically(spark):
    teams = {1: ("CCC", [(2026, REG)] * 2), 2: ("AAA", [(2026, REG)] * 2), 3: ("BBB", [(2026, REG)] * 2)}
    rows = [dict(person_id=7, team_id=t, game=f"{t}-1", name="P", mins=10, pts=1) for t in (1, 2, 3)]
    out = run(spark, teams, rows)
    assert out[(7, 1, "1-1")]["other_teams"] == "AAA,BBB"
    assert out[(7, 2, "2-1")]["other_teams"] == "BBB,CCC"
    assert out[(7, 3, "3-1")]["other_teams"] == "AAA,CCC"


def test_played_means_minutes_or_a_stat_or_a_non_zero_plus_minus(spark):
    teams = {1: ("AAA", [(2026, REG)] * 6)}
    rows = [dict(person_id=7, team_id=1, game="1-1", name="P", mins=0, reb=1),             # a rebound, no minutes: played
            dict(person_id=7, team_id=1, game="1-2", name="P", mins=None, plus_minus=-3.0),  # only a plus/minus: played
            dict(person_id=7, team_id=1, game="1-3", name="P", mins=0, plus_minus=0.0),     # nothing at all: did not play
            dict(person_id=7, team_id=1, game="1-4", name="P", mins=5),                    # minutes but no stats: played
            dict(person_id=7, team_id=1, game="1-5", name="P", mins=0, pf=1),               # a foul only: played
            dict(person_id=7, team_id=1, game="1-6", name="P", mins=None)]                  # no minutes, no stats: did not play
    out = run(spark, teams, rows)
    assert [out[(7, 1, f"1-{i}")]["played"] for i in range(1, 7)] == [True, True, False, True, True, False]


def test_game_types_are_never_mixed_and_numbering_restarts(spark):
    # team 1: 3 regular-season games then 2 playoff games. Player 7 plays both kinds, player 8 only regular season.
    teams = {1: ("AAA", [(2026, REG)] * 3 + [(2026, "playoffs")] * 2)}
    rows = [dict(person_id=7, team_id=1, game="1-1", name="P", mins=10, pts=1),
            dict(person_id=7, team_id=1, game="1-4", name="P", mins=10, pts=2),
            dict(person_id=8, team_id=1, game="1-2", name="Q", mins=10, pts=3)]
    out = run(spark, teams, rows)
    assert sorted(k for k in out if k[0] == 7) == [(7, 1, f"1-{i}") for i in range(1, 6)]
    assert sorted(k for k in out if k[0] == 8) == [(8, 1, "1-1"), (8, 1, "1-2"), (8, 1, "1-3")]  # no playoff grid
    po = [out[(7, 1, "1-4")], out[(7, 1, "1-5")]]
    assert [r["game_type"] for r in po] == ["playoffs", "playoffs"]
    assert [(r["game_number"], r["team_games"]) for r in po] == [(1, 2), (2, 2)]
    assert out[(7, 1, "1-1")]["team_games"] == 3
    assert out[(7, 1, "1-4")]["played"] and not out[(7, 1, "1-5")]["played"]


def test_seasons_are_separate_grids_and_no_cross_season_note(spark):
    teams = {1: ("AAA", [(2026, REG)] * 2 + [(2027, REG)] * 3), 2: ("BBB", [(2026, REG)] * 2 + [(2027, REG)] * 3)}
    rows = [dict(person_id=7, team_id=1, game="1-1", name="P", mins=10, pts=1),   # 2026 with team 1
            dict(person_id=7, team_id=2, game="2-3", name="P", mins=10, pts=2)]   # 2027 with team 2
    out = run(spark, teams, rows)
    assert sorted(k[2] for k in out if k[1] == 1) == ["1-1", "1-2"] and sorted(k[2] for k in out if k[1] == 2) == ["2-3", "2-4", "2-5"]
    assert {r["other_teams"] for r in out.values()} == {None}
    assert out[(7, 1, "1-1")]["season_label"] == "2025-26" and out[(7, 2, "2-3")]["season_label"] == "2026-27"


def test_a_player_who_never_played_gets_no_grid(spark):
    teams = {1: ("AAA", [(2026, REG)] * 3)}
    rows = [dict(person_id=7, team_id=1, game="1-1", name="P", mins=0), dict(person_id=7, team_id=1, game="1-2", name="P", mins=None),
            dict(person_id=8, team_id=1, game="1-1", name="Q", mins=9, pts=2)]
    out = run(spark, teams, rows)
    assert {k[0] for k in out} == {8}


def test_player_name_is_the_latest_one(spark):
    teams = {1: ("AAA", [(2026, REG)] * 3)}
    rows = [dict(person_id=7, team_id=1, game="1-1", name="Old Name", mins=10, pts=1),
            dict(person_id=7, team_id=1, game="1-3", name="New Name", mins=10, pts=1)]
    assert {r["player_name"] for r in run(spark, teams, rows).values()} == {"New Name"}


def test_python_table_is_skipped_by_the_command_line_runner():
    import silver_build as s

    class NoSparkDb:
        sql = []

        def run(self, stmt):
            self.sql.append(stmt)
            raise AssertionError("a SKIPped table must not run any SQL")

    s.build(NoSparkDb(), "player_season_games", s.TABLES["player_season_games"], execute=True)
    assert NoSparkDb.sql == []
