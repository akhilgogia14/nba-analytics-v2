import sys
from datetime import date, timedelta
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

STATS = ["pts", "reb", "ast", "fg3m", "blk", "stl", "allowed", "margin"]


def make_games(spark, games):
    """games: list of dicts(team, opp, season, pts, opp_pts, season_type); dates run daily from 2026-01-01 in list order."""
    rows = []
    for i, g in enumerate(games):
        rows.append(dict(
            game_id=f"g{i:03d}", team_id=g["team"], opponent_team_id=g["opp"], game_date=date(2026, 1, 1) + timedelta(days=i),
            season=g["season"], season_type=g.get("season_type", "regular-season"),
            team_tricode=g.get("tri", f"T{g['team']:02d}"), opponent_tricode=g.get("opp_tri", f"T{g['opp']:02d}"),
            pts=g["pts"], opp_pts=g["opp_pts"], won=g["pts"] > g["opp_pts"], reb=40, ast=25, fg3m=12, blk=5, stl=7))
    return spark.createDataFrame(rows)


def run(spark, games):
    tv = pytest.importorskip("gold_team_vs_opponent")
    out = tv.transform(make_games(spark, games)).collect()
    return {(r["team_id"], r["opponent_team_id"], r["scope"], r["scope_value"], r["stat"]): r.asDict() for r in out}


# Team 1 against team 2, five games (team 2 plays no rows of its own here, only team 1's view is built).
G = [dict(team=1, opp=2, season=2026, pts=100, opp_pts=90),
     dict(team=1, opp=2, season=2026, pts=110, opp_pts=100),
     dict(team=1, opp=2, season=2026, pts=90, opp_pts=100, season_type="playoffs"),
     dict(team=1, opp=2, season=2027, pts=120, opp_pts=100),
     dict(team=1, opp=2, season=2027, pts=80, opp_pts=100, season_type="play-in")]


def test_scopes_and_labels(spark):
    out = run(spark, G)
    scopes = sorted({(k[2], k[3]) for k in out})
    assert scopes == [("all", "all"), ("game_type", "playoffs"), ("game_type", "regular-season"),
                      ("season", "2025-26"), ("season", "2026-27")]  # play-in has no game_type scope
    assert {k[4] for k in out} == set(STATS)
    assert len(out) == 5 * 8


def test_all_games_numbers(spark):
    r = out = run(spark, G)
    a = r[(1, 2, "all", "all", "pts")]
    assert (a["games"], a["wins"], a["regular_games"], a["playoff_games"]) == (5, 3, 3, 1)
    assert (a["first_game_date"], a["last_game_date"]) == (date(2026, 1, 1), date(2026, 1, 5))
    # points 80, 90, 100, 110, 120: linear interpolation puts the 10th percentile at 84 and the 90th at 116
    assert (a["mean"], a["median"], a["p10"], a["p90"], a["min_value"], a["max_value"]) == (100.0, 100.0, 84.0, 116.0, 80.0, 120.0)
    assert (a["team_tricode"], a["opponent_tricode"]) == ("T01", "T02")
    m = r[(1, 2, "all", "all", "margin")]  # 10, 10, -10, 20, -20
    assert (m["mean"], m["median"], m["min_value"], m["max_value"]) == (2.0, 10.0, -20.0, 20.0)
    d = r[(1, 2, "all", "all", "allowed")]  # 90, 100, 100, 100, 100
    assert (d["mean"], d["median"], d["min_value"], d["max_value"]) == (98.0, 100.0, 90.0, 100.0)


def test_season_scopes_are_labelled_and_separate(spark):
    r = run(spark, G)
    s1 = r[(1, 2, "season", "2025-26", "pts")]  # 100, 110, 90
    assert (s1["games"], s1["wins"], s1["regular_games"], s1["playoff_games"]) == (3, 2, 2, 1)
    assert (s1["mean"], s1["median"], s1["p10"], s1["p90"]) == (100.0, 100.0, 92.0, 108.0)
    s2 = r[(1, 2, "season", "2026-27", "pts")]  # 120, 80 (the second is a play-in game)
    assert (s2["games"], s2["wins"], s2["regular_games"], s2["playoff_games"]) == (2, 1, 1, 0)
    assert (s2["mean"], s2["p10"], s2["p90"]) == (100.0, 84.0, 116.0)


def test_game_type_scopes(spark):
    r = run(spark, G)
    reg = r[(1, 2, "game_type", "regular-season", "pts")]  # 100, 110, 120
    assert (reg["games"], reg["wins"], reg["mean"], reg["p10"], reg["p90"]) == (3, 3, 110.0, 102.0, 118.0)
    po = r[(1, 2, "game_type", "playoffs", "pts")]
    assert (po["games"], po["wins"], po["playoff_games"], po["mean"], po["p10"], po["p90"]) == (1, 0, 1, 90.0, 90.0, 90.0)


def test_each_opponent_and_team_is_separate(spark):
    games = G + [dict(team=1, opp=3, season=2027, pts=70, opp_pts=60), dict(team=2, opp=1, season=2027, pts=90, opp_pts=100)]
    r = run(spark, games)
    assert r[(1, 3, "all", "all", "pts")]["games"] == 1
    assert r[(1, 2, "all", "all", "pts")]["games"] == 5
    assert r[(2, 1, "all", "all", "pts")]["games"] == 1 and r[(2, 1, "all", "all", "margin")]["mean"] == -10.0


def test_latest_tricode_wins(spark):
    games = [dict(team=1, opp=2, season=2027, pts=100, opp_pts=90, tri="OLD", opp_tri="AAA"),
             dict(team=1, opp=2, season=2027, pts=100, opp_pts=90, tri="NEW", opp_tri="BBB")]
    a = run(spark, games)[(1, 2, "all", "all", "pts")]
    assert (a["team_tricode"], a["opponent_tricode"]) == ("NEW", "BBB")


def test_python_table_is_skipped_by_the_command_line_runner():
    import silver_build as s

    class NoSparkDb:
        sql = []

        def run(self, stmt):
            self.sql.append(stmt)
            raise AssertionError("a SKIPped table must not run any SQL")

    s.build(NoSparkDb(), "team_vs_opponent", s.TABLES["team_vs_opponent"], execute=True)
    assert NoSparkDb.sql == []
