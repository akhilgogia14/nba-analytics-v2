import sys
from datetime import datetime
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

SCHEMA = ("player_id long, season int, player string, position string, team_id long, _loaded_at timestamp, _source_modified_at timestamp")


def row(pid, season, name, pos, loaded="2026-11-10 12:00:00", modified="2026-11-07 04:00:00", team=1):
    return (pid, season, name, pos, team, datetime.fromisoformat(loaded), datetime.fromisoformat(modified))


def run(spark, rows):
    g = pytest.importorskip("gold_player_season_position")
    return {(r["person_id"], r["season"]): r.asDict() for r in g.transform(spark.createDataFrame(rows, SCHEMA)).collect()}


def test_one_row_per_player_per_season_with_the_label_as_listed(spark):
    out = run(spark, [row(1, 2026, "A One", "G-F"), row(2, 2026, "B Two", "C"), row(1, 2025, "A One", "F-G")])
    assert sorted(out) == [(1, 2025), (1, 2026), (2, 2026)]
    assert (out[(1, 2026)]["position"], out[(1, 2026)]["player_name"], out[(1, 2026)]["season_label"]) == ("G-F", "A One", "2025-26")
    assert out[(1, 2025)]["position"] == "F-G"  # hyphenated labels stay as listed, never folded into G or F


def test_the_newest_snapshot_wins_when_a_season_has_several(spark):
    rows = [row(1, 2027, "A One", "G", loaded="2026-10-20 09:00:00"), row(1, 2027, "A One", "G-F", loaded="2026-11-12 09:00:00"),
            row(1, 2027, "A One", "G", loaded="2026-11-01 09:00:00")]
    assert run(spark, rows)[(1, 2027)]["position"] == "G-F"


def test_empty_or_missing_labels_are_ignored_and_labels_are_tidied(spark):
    rows = [row(1, 2026, "Blank", ""), row(2, 2026, "Spaces", "   "), row(3, 2026, "Null", None), row(4, 2026, "Loose", " f-c "),
            row(5, 2026, "Newest blank", "C", loaded="2026-11-01 09:00:00"), row(5, 2026, "Newest blank", "", loaded="2026-11-12 09:00:00")]
    out = run(spark, rows)
    assert sorted(out) == [(4, 2026), (5, 2026)]
    assert out[(4, 2026)]["position"] == "F-C"
    assert out[(5, 2026)]["position"] == "C"  # an empty newer snapshot does not erase the label


def test_columns_are_exactly_the_documented_ones_in_order(spark):
    g = pytest.importorskip("gold_player_season_position")
    df = g.transform(spark.createDataFrame([row(1, 2026, "A One", "G")], SCHEMA))
    assert df.columns == g.OUTPUT_COLUMNS == ["person_id", "season", "season_label", "player_name", "position"]


def test_python_table_is_registered():
    import silver_build as s
    assert s.TABLES["player_season_position"] == {"key": ["person_id", "season"], "layer": "gold", "python": "gold_player_season_position"}


def test_gate_and_warning_files_exist_and_use_the_table_placeholder():
    root = Path(__file__).resolve().parent.parent / "sql" / "gold"
    gates = (root / "player_season_position_gates.sql").read_text()
    warnings = (root / "player_season_position_warnings.sql").read_text()
    assert "{T}" in gates and "{T}" in warnings
