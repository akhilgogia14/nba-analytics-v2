import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import silver_build as s  # noqa: E402

SEL = "-- a comment\nSELECT 1 AS game_id, 2 AS person_id\n-- trailing comment"
GATES = "-- header {T} in a comment\nSELECT 'k' AS gate, count(*) AS bad FROM {T}"


def test_strip_comments_removes_whole_line_comments_only():
    assert s.strip_comments(SEL) == "SELECT 1 AS game_id, 2 AS person_id"


def test_comment_cannot_swallow_closing_bracket():
    assert s.source_sql(SEL).endswith(") _s")
    assert "--" not in s.source_sql(SEL)


def test_source_hashes_every_column():
    assert "sha2(to_json(struct(*)), 256) AS _row_hash" in s.source_sql(SEL)


def test_gates_use_the_named_source_and_ignore_comments():
    q = s.gates_sql(GATES, "silver_src")
    assert q == "SELECT 'k' AS gate, count(*) AS bad FROM silver_src"


def test_gates_on_source_wraps_select_in_with():
    q = s.gates_on_source(SEL, GATES)
    assert q.startswith("WITH silver_src AS (SELECT 1 AS game_id")
    assert q.endswith("FROM silver_src")


def test_failing_gates_lists_only_nonzero_and_handles_strings():
    assert s.failing_gates([["a", "0"], ["b", "3"], ["c", 0]]) == [("b", 3)]


def test_create_turns_on_change_data_feed_and_is_empty():
    q = s.create_sql("t", SEL)
    assert "delta.enableChangeDataFeed = true" in q and "WHERE 1 = 0" in q and "IF NOT EXISTS" in q


def test_merge_is_null_safe_on_every_key_column_and_only_updates_changed_rows():
    q = s.merge_sql("t", SEL, ["game_id", "person_id"])
    assert "t.game_id <=> s.game_id AND t.person_id <=> s.person_id" in q
    assert "WHEN MATCHED AND t._row_hash <> s._row_hash THEN UPDATE SET *" in q
    assert "WHEN NOT MATCHED THEN INSERT *" in q
    assert "WHEN NOT MATCHED BY SOURCE THEN DELETE" in q


def test_real_sql_files_exist_for_every_table_and_gates_use_the_placeholder():
    for name in s.TABLES:
        assert (s.SQL_DIR / f"{name}.sql").exists()
        assert "{T}" in (s.SQL_DIR / f"{name}_gates.sql").read_text()
