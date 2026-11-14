import sys
from datetime import date
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

SCHEMA = ("game_id string, season int, season_type string, game_date date, home_team_id int, home_tricode string, home_team_name string, "
          "away_team_id int, away_tricode string, away_team_name string, home_pts int, away_pts int, is_final boolean, home_won boolean, "
          "result_from_box_score boolean, has_box_score boolean, _row_hash string")


def game(gid, d, season, stype, home, away, hp=None, ap=None):
    final = hp is not None
    return (gid, season, stype, d, home, f"T{home:02d}", f"Team {home}", away, f"T{away:02d}", f"Team {away}", hp, ap,
            final, (hp > ap) if final else None, False, final, "x")


def run(spark, rows):
    g = pytest.importorskip("gold_game_slate")
    return {r["game_id"]: r.asDict() for r in g.transform(spark.createDataFrame(rows, SCHEMA)).collect()}


def test_only_the_latest_season_one_row_per_game_played_or_not(spark):
    rows = [game("g1", date(2026, 11, 1), 2027, "regular-season", 1, 2, 110, 100),
            game("g2", date(2026, 11, 15), 2027, "regular-season", 3, 4),
            game("g0", date(2026, 5, 1), 2026, "playoffs", 1, 3, 95, 101)]
    out = run(spark, rows)
    assert sorted(out) == ["g1", "g2"]
    played, to_come = out["g1"], out["g2"]
    assert (played["is_final"], played["home_won"], played["home_pts"], played["away_pts"]) == (True, True, 110, 100)
    assert (to_come["is_final"], to_come["home_won"], to_come["home_pts"], to_come["away_pts"]) == (False, None, None, None)
    assert (played["season_label"], played["game_type"], played["home_tricode"], played["away_team_name"]) == ("2026-27", "regular-season", "T01", "Team 2")


def test_game_types_are_kept_on_the_row(spark):
    rows = [game("a", date(2026, 10, 5), 2027, "preseason", 1, 2, 90, 99), game("b", date(2026, 11, 2), 2027, "regular-season", 1, 3, 90, 80)]
    out = run(spark, rows)
    assert (out["a"]["game_type"], out["a"]["home_won"], out["b"]["game_type"]) == ("preseason", False, "regular-season")


def test_columns_are_exactly_the_documented_ones_in_order(spark):
    g = pytest.importorskip("gold_game_slate")
    df = g.transform(spark.createDataFrame([game("g1", date(2026, 11, 1), 2027, "regular-season", 1, 2, 110, 100)], SCHEMA))
    assert df.columns == g.OUTPUT_COLUMNS


def test_python_table_is_registered():
    import silver_build as s
    assert s.TABLES["game_slate"] == {"key": ["game_id"], "layer": "gold", "python": "gold_game_slate"}
