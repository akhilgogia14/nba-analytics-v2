import sys
from datetime import date
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

SCHEMA = ("game_id string, team_id int, game_date date, season int, season_type string, team_name string, team_tricode string, "
          "is_home boolean, opponent_team_id int, opponent_tricode string, overtime_periods int, pts int, opp_pts int, won boolean, "
          "reb int, ast int, fg3m int, blk int, stl int, tov int, pf int, fgm int, fga int, fg3a int, ftm int, fta int, oreb int, dreb int, "
          "plus_minus double, minutes_seconds int")


def game(gid, tid, opp, d, season, stype, home, pts, opp_pts, **kw):
    box = dict(reb=44, ast=25, fg3m=13, blk=5, stl=7, tov=12, pf=18, fgm=40, fga=88, fg3a=36, ftm=7, fta=9, oreb=10, dreb=34)
    box.update(kw)
    return (gid, tid, d, season, stype, f"Team {tid}", f"T{tid:02d}", home, opp, f"T{opp:02d}", 0, pts, opp_pts, pts > opp_pts,
            box["reb"], box["ast"], box["fg3m"], box["blk"], box["stl"], box["tov"], box["pf"], box["fgm"], box["fga"], box["fg3a"],
            box["ftm"], box["fta"], box["oreb"], box["dreb"], float(pts - opp_pts), 14400)


def run(spark, rows):
    g = pytest.importorskip("gold_team_game_log")
    out = g.transform(spark.createDataFrame(rows, SCHEMA)).collect()
    return {(r["team_id"], r["game_id"]): r.asDict() for r in out}


def test_one_row_per_team_per_game_with_result_and_box_score(spark):
    rows = [game("g1", 1, 2, date(2026, 11, 1), 2027, "regular-season", True, 110, 100),
            game("g1", 2, 1, date(2026, 11, 1), 2027, "regular-season", False, 100, 110),
            game("g2", 1, 3, date(2026, 5, 1), 2026, "playoffs", False, 95, 101, fgm=35, fga=90)]
    out = run(spark, rows)
    assert sorted(out) == [(1, "g1"), (1, "g2"), (2, "g1")]
    w, l, p = out[(1, "g1")], out[(2, "g1")], out[(1, "g2")]
    assert (w["won"], w["margin"], w["is_home"], w["game_type"], w["season_label"]) == (True, 10, True, "regular-season", "2026-27")
    assert (l["won"], l["margin"], l["is_home"], l["pts"], l["opp_pts"]) == (False, -10, False, 100, 110)
    assert (p["game_type"], p["season_label"], p["won"], p["margin"], p["fgm"], p["fga"]) == ("playoffs", "2025-26", False, -6, 35, 90)
    assert (w["opponent_team_id"], w["opponent_tricode"], w["team_tricode"], w["overtime_periods"]) == (2, "T02", "T01", 0)


def test_columns_are_exactly_the_documented_ones_in_order(spark):
    g = pytest.importorskip("gold_team_game_log")
    rows = [game("g1", 1, 2, date(2026, 11, 1), 2027, "regular-season", True, 110, 100)]
    df = g.transform(spark.createDataFrame(rows, SCHEMA))
    assert df.columns == g.OUTPUT_COLUMNS
    assert g.BOX_COLUMNS == ["fgm", "fga", "fg3m", "fg3a", "ftm", "fta", "oreb", "dreb", "reb", "ast", "stl", "blk", "tov", "pf"]


def test_python_table_is_skipped_by_the_command_line_runner():
    import silver_build as s
    assert s.TABLES["team_game_log"]["python"] == "gold_team_game_log"
    assert s.TABLES["team_game_log"]["key"] == ["team_id", "game_id"]
