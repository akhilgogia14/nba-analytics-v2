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
    return {(r["team_id"], r["opponent_team_id"], r["season_label"], r["game_type"], r["stat"]): r.asDict() for r in out}


# Team 1 against team 2, five games: 2025-26 has two regular-season games and a playoff game,
# 2026-27 has a regular-season game and a play-in game.
G = [dict(team=1, opp=2, season=2026, pts=100, opp_pts=90),
     dict(team=1, opp=2, season=2026, pts=110, opp_pts=100),
     dict(team=1, opp=2, season=2026, pts=90, opp_pts=100, season_type="playoffs"),
     dict(team=1, opp=2, season=2027, pts=120, opp_pts=100),
     dict(team=1, opp=2, season=2027, pts=80, opp_pts=100, season_type="play-in")]


def test_every_row_is_one_game_type_and_labelled(spark):
    out = run(spark, G)
    groups = sorted({(k[2], k[3]) for k in out})
    assert groups == [("2025-26", "playoffs"), ("2025-26", "regular-season"), ("2026-27", "play-in"),
                      ("2026-27", "regular-season"), ("all", "play-in"), ("all", "playoffs"), ("all", "regular-season")]
    assert {k[4] for k in out} == set(STATS)
    assert len(out) == 7 * 8


def test_all_seasons_regular_season_never_includes_other_types(spark):
    r = run(spark, G)
    a = r[(1, 2, "all", "regular-season", "pts")]  # 100, 110, 120: the playoff and play-in games are not in here
    assert (a["games"], a["wins"]) == (3, 3)
    assert (a["first_game_date"], a["last_game_date"]) == (date(2026, 1, 1), date(2026, 1, 4))
    # points 100, 110, 120: linear interpolation puts the 10th percentile at 102 and the 90th at 118
    assert (a["mean"], a["median"], a["p10"], a["p90"], a["min_value"], a["max_value"]) == (110.0, 110.0, 102.0, 118.0, 100.0, 120.0)
    assert (a["team_tricode"], a["opponent_tricode"]) == ("T01", "T02")
    m = r[(1, 2, "all", "regular-season", "margin")]  # 10, 10, 20
    assert (m["mean"], m["median"], m["min_value"], m["max_value"]) == (13.333, 10.0, 10.0, 20.0)
    d = r[(1, 2, "all", "regular-season", "allowed")]  # 90, 100, 100
    assert (d["mean"], d["median"], d["min_value"], d["max_value"]) == (96.667, 100.0, 90.0, 100.0)


def test_other_game_types_are_their_own_rows(spark):
    r = run(spark, G)
    po = r[(1, 2, "all", "playoffs", "pts")]
    assert (po["games"], po["wins"], po["mean"], po["p10"], po["p90"]) == (1, 0, 90.0, 90.0, 90.0)
    pi = r[(1, 2, "all", "play-in", "pts")]
    assert (pi["games"], pi["wins"], pi["mean"]) == (1, 0, 80.0)


def test_one_season_rows_are_labelled_and_separate(spark):
    r = run(spark, G)
    s1 = r[(1, 2, "2025-26", "regular-season", "pts")]  # 100, 110
    assert (s1["games"], s1["wins"], s1["mean"], s1["median"], s1["p10"], s1["p90"]) == (2, 2, 105.0, 105.0, 101.0, 109.0)
    assert r[(1, 2, "2025-26", "playoffs", "pts")]["games"] == 1
    s2 = r[(1, 2, "2026-27", "regular-season", "pts")]
    assert (s2["games"], s2["mean"]) == (1, 120.0)
    assert r[(1, 2, "2026-27", "play-in", "pts")]["mean"] == 80.0


def test_each_opponent_and_team_is_separate(spark):
    games = G + [dict(team=1, opp=3, season=2027, pts=70, opp_pts=60), dict(team=2, opp=1, season=2027, pts=90, opp_pts=100)]
    r = run(spark, games)
    assert r[(1, 3, "all", "regular-season", "pts")]["games"] == 1
    assert r[(1, 2, "all", "regular-season", "pts")]["games"] == 3
    assert r[(2, 1, "all", "regular-season", "pts")]["games"] == 1 and r[(2, 1, "all", "regular-season", "margin")]["mean"] == -10.0


def test_latest_tricode_wins(spark):
    games = [dict(team=1, opp=2, season=2027, pts=100, opp_pts=90, tri="OLD", opp_tri="AAA"),
             dict(team=1, opp=2, season=2027, pts=100, opp_pts=90, tri="NEW", opp_tri="BBB")]
    a = run(spark, games)[(1, 2, "all", "regular-season", "pts")]
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
