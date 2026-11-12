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
    for name, cfg in s.TABLES.items():
        d = s.SQL_ROOT / cfg["layer"]
        if cfg.get("python"):  # a PySpark table has a module with build(spark) instead of a .sql file
            assert (s.ROOT / "scripts" / f"{cfg['python']}.py").exists()
        else:
            assert (d / f"{name}.sql").exists()
        assert "{T}" in (d / f"{name}_gates.sql").read_text()


def test_delete_guard_trips_above_one_percent_only():
    assert not s.delete_guard_trips(27, 177122)
    assert not s.delete_guard_trips(1771, 177122)
    assert s.delete_guard_trips(1773, 177122)
    assert not s.delete_guard_trips(5, 0)


def test_changed_columns_lists_only_differences_and_ignores_the_hash():
    cols = ["game_id", "pts", "reb", "_row_hash"]
    assert s.changed_columns(cols, ["g", "5", "2", "h1"], ["g", "6", "2", "h2"]) == [("pts", "5", "6")]
    assert s.changed_columns(cols, ["g", None, "2", "h"], ["g", "3", "2", "h"]) == [("pts", None, "3")]


def test_warnings_insert_only_adds_rows_not_already_logged():
    q = s.warnings_insert_sql("player_game", "RUN1", "-- c\nSELECT 'w' AS warning, 'k' AS row_key, '{}' AS detail FROM {T}", "silver.t")
    assert "FROM silver.t" in q and "WHERE NOT EXISTS" in q
    assert "x.warning = w.warning AND x.row_key = w.row_key" in q and "x.table_name = 'player_game'" in q


def test_log_insert_records_versions_and_escapes_quotes():
    c = dict(source_rows=10, inserted=1, updated=2, deleted=3, table_rows=9, version_before=None,
             version_after=4, new_warnings=0, examples="{\"k\": \"O'Neal\"}")
    q = s.log_insert_sql("R", "player_game", c)
    assert "NULL, 4, 0" in q and "O''Neal" in q
    c["version_before"] = 3
    assert ", 3, 4, 0" in s.log_insert_sql("R", "player_game", c)


def test_every_table_has_a_warnings_file_with_the_placeholder():
    for name, cfg in s.TABLES.items():
        assert "{T}" in (s.SQL_ROOT / cfg["layer"] / f"{name}_warnings.sql").read_text()


class FakeDb:
    """Stands in for Databricks: returns canned change-feed rows."""
    def __init__(self, rows):
        self.rows, self.sql = rows, []

    def run(self, stmt):
        self.sql.append(stmt)
        return self.rows


def test_change_examples_pairs_updates_and_lists_deletes():
    cols = ["game_id", "person_id", "pts", "_row_hash"]
    rows = [["g1", "7", "6", "h2", "update_postimage"], ["g1", "7", "5", "h1", "update_preimage"],
            ["g2", "9", "4", "h3", "delete"]]
    db = FakeDb(rows)
    out = s.change_examples(db, "t", 5, cols, ["game_id", "person_id"])
    assert out["updated"] == [{"key": "g1|7", "changes": {"pts": ["5", "6"]}}]
    assert out["deleted_keys"] == ["g2|9"]
    assert "table_changes('t', 5, 5)" in db.sql[0]


def test_change_examples_caps_the_number_of_examples():
    cols = ["game_id", "person_id", "pts", "_row_hash"]
    rows = []
    for i in range(20):
        rows += [["g", str(i), "2", "b", "update_postimage"], ["g", str(i), "1", "a", "update_preimage"],
                 ["d", str(i), "0", "c", "delete"]]
    out = s.change_examples(FakeDb(rows), "t", 1, cols, ["game_id", "person_id"])
    assert len(out["updated"]) == s.MAX_EXAMPLES and len(out["deleted_keys"]) == s.MAX_EXAMPLES


class FakeSpark:
    def __init__(self, result=None, error=None):
        self.result, self.error = result, error

    def sql(self, stmt):
        if self.error:
            raise self.error
        outer = self

        class DF:
            def collect(self):
                return outer.result
        return DF()


def test_spark_runner_returns_lists_and_wraps_failures_as_runtimeerror():
    import pytest
    assert s.SparkRunner(FakeSpark([(1, "a"), (2, "b")])).run("x") == [[1, "a"], [2, "b"]]
    with pytest.raises(RuntimeError):
        s.SparkRunner(FakeSpark(error=ValueError("table not found"))).run("x")


def test_silver_build_does_not_need_boto3_or_bronze_load():
    import subprocess
    code = "import sys; sys.modules['boto3']=None; sys.path.insert(0,'scripts'); import silver_build; print('ok')"
    out = subprocess.run([sys.executable, "-c", code], capture_output=True, text=True, cwd=s.ROOT)
    assert out.stdout.strip() == "ok", out.stderr


class ScriptedDb:
    """Answers the dry-run queries; records what was run."""
    def __init__(self):
        self.sql = []

    def run(self, stmt):
        self.sql.append(stmt)
        if stmt.startswith("DESCRIBE TABLE"):
            raise RuntimeError("table not found")
        if "count(*)" in stmt:
            return [["5"]]
        return [["gate_a", "0"]]


def test_dry_run_reads_sql_from_the_given_folder_and_writes_nothing(tmp_path):
    layer_dir = tmp_path / "gold"
    layer_dir.mkdir()
    (layer_dir / "t.sql").write_text("SELECT 1 AS game_id, 2 AS person_id")
    (layer_dir / "t_gates.sql").write_text("SELECT 'gate_a' AS gate, 0 AS bad FROM {T}")
    (layer_dir / "t_warnings.sql").write_text("SELECT 'w' AS warning, 'k' AS row_key, '' AS detail FROM {T}")
    db = ScriptedDb()
    s.build(db, "t", {"key": ["game_id", "person_id"], "layer": "gold"}, execute=False, sql_root=tmp_path)
    assert any("workspace.nba_v2_gold.t" in q for q in db.sql)  # the table lives in its layer's schema
    joined = "\n".join(db.sql)
    assert "SELECT 1 AS game_id" in joined
    assert not any(w in joined for w in ("CREATE TABLE", "MERGE INTO", "INSERT INTO"))


def test_change_examples_orders_by_the_key_columns_for_one_and_two_column_keys():
    db = FakeDb([])
    s.change_examples(db, "t", 1, ["game_id", "person_id", "pts", "_row_hash"], ["game_id", "person_id"])
    s.change_examples(db, "t", 1, ["game_id", "pts", "_row_hash"], ["game_id"])
    assert "ORDER BY 1, 2, _change_type" in db.sql[0] and "{" not in db.sql[0]
    assert "ORDER BY 1, _change_type" in db.sql[1] and "{" not in db.sql[1]


def test_every_silver_table_comes_before_every_gold_table():
    layers = [cfg["layer"] for cfg in s.TABLES.values()]
    assert layers == sorted(layers, key=["silver", "gold"].index)


def test_schema_for_layer_and_log_tables_follow_the_layer():
    assert s.schema_for("gold") == "workspace.nba_v2_gold"
    assert all("nba_v2_gold." in q for q in s.create_log_tables_sql(s.schema_for("gold")))
