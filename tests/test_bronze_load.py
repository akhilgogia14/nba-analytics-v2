import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import bronze_load as b  # noqa: E402


def test_new_when_bronze_has_no_rows_for_the_file():
    assert b.classify_file("abc", []) == "NEW"


def test_unchanged_only_when_every_stored_checksum_matches():
    assert b.classify_file("abc", ["abc"]) == "UNCHANGED"
    assert b.classify_file("abc", ["abc", "abc"]) == "UNCHANGED"


def test_changed_when_checksum_differs():
    assert b.classify_file("new", ["old"]) == "CHANGED"


def test_changed_when_stored_checksum_is_missing():
    # the first load had no _sha256 column; those rows must be reloaded
    assert b.classify_file("abc", [None]) == "CHANGED"


def test_changed_when_file_has_mixed_checksums():
    assert b.classify_file("abc", ["abc", "old"]) == "CHANGED"


def test_missing_r2_label_is_never_unchanged():
    assert b.classify_file(None, [None]) != "UNCHANGED"


def test_sql_string_escapes_quotes():
    assert b.sql_str("o'brien") == "'o''brien'"


def test_file_uri_shape():
    assert b.file_uri("https://acct.r2.cloudflarestorage.com/", "bkt", "raw/x/y.parquet") == \
        "r2://bkt@acct.r2.cloudflarestorage.com/raw/x/y.parquet"


COLS = ["a", "b", "_rescued_data", "_source_file", "_source_modified_at", "_loaded_at", "_sha256"]


def test_load_sql_replaces_only_that_file():
    sql = b.load_file_sql("s.t", "r2://b@h/raw/f.parquet", "sha1", "replace", COLS, ["a", "b", "_rescued_data"])
    assert "REPLACE WHERE _source_file = 'r2://b@h/raw/f.parquet'" in sql
    assert "'sha1' AS _sha256" in sql
    assert "DELETE" not in sql.upper() and "DROP" not in sql.upper()


def test_key_check_covers_every_key_part():
    sql = b.key_check_sql("s.t", ["game_id", "person_id"])
    assert "count(DISTINCT game_id, person_id)" in sql
    assert "game_id IS NULL OR person_id IS NULL" in sql


# ---- append mode (snapshot tables keep every version) ----

def test_snapshot_unchanged_when_this_version_is_already_stored():
    assert b.classify_snapshot("v2", ["v1", "v2"]) == "UNCHANGED"


def test_snapshot_changed_when_version_not_stored_yet():
    assert b.classify_snapshot("v3", ["v1", "v2"]) == "CHANGED"


def test_snapshot_new_when_nothing_stored():
    assert b.classify_snapshot("v1", []) == "NEW"


def test_snapshot_missing_label_is_never_unchanged():
    assert b.classify_snapshot(None, [None]) != "UNCHANGED"


def test_append_sql_never_removes_old_rows():
    sql = b.load_file_sql("s.t", "r2://b@h/f.parquet", "v3", "append", COLS, ["a", "b", "_rescued_data"])
    assert sql.startswith("INSERT INTO s.t SELECT")
    assert "REPLACE WHERE" not in sql


def test_replace_sql_is_the_default():
    assert "REPLACE WHERE" in b.load_file_sql("s.t", "r2://b@h/f.parquet", "v3", "replace", COLS, ["a"])


def test_count_check_looks_at_one_version_when_given():
    assert "_sha256 = 'v3'" in b.count_check_sql("s.t", "u", "v3")
    assert "_sha256" not in b.count_check_sql("s.t", "u")


def test_append_key_check_is_within_one_version():
    sql = b.key_check_sql("s.t", ["team_id"], "append")
    assert "count(DISTINCT team_id, _source_file, _sha256)" in sql
    assert "_source_file" not in b.key_check_sql("s.t", ["team_id"])


def test_mode_picks_the_right_classifier():
    # a file seen before with a different checksum: replace mode says CHANGED either way,
    # but append mode keeps the version it already holds as UNCHANGED
    assert b.classifier_for("append")("v1", ["v1", "v2"]) == "UNCHANGED"
    assert b.classifier_for("replace")("v1", ["v1", "v2"]) == "CHANGED"
    assert b.classifier_for(None)("v1", ["v1", "v2"]) == "CHANGED"


# ---- seasons with different columns ----

def test_missing_file_column_becomes_null_in_table_order():
    sel = b.select_list(COLS, ["b", "_rescued_data"])
    assert sel[0] == "NULL AS `a`" and sel[1] == "`b`"


def test_extra_file_column_stops_the_load():
    import pytest
    with pytest.raises(ValueError):
        b.select_list(["a", "_source_file", "_source_modified_at", "_loaded_at", "_sha256"], ["a", "new_col"])


def test_metadata_columns_come_from_the_file_and_the_checksum():
    sql = b.load_file_sql("s.t", "u", "abc", "append", COLS, ["a", "b", "_rescued_data"])
    assert "_metadata.file_path AS _source_file" in sql and "'abc' AS _sha256" in sql


def test_table_is_created_from_all_seasons():
    sql = b.create_empty_sql("s.t", "r2://b@h/raw/x/*/*.parquet")
    assert "mergeSchema => true" in sql and "WHERE 1 = 0" in sql


# ---- new columns from the source ----

def test_new_file_columns_are_found_with_their_types():
    typed = [("a", "bigint"), ("fresh", "double"), ("flag", "boolean")]
    assert b.columns_to_add(["a", "_source_file"], typed) == [("fresh", "double"), ("flag", "boolean")]


def test_no_new_columns_when_table_has_them_all():
    assert b.columns_to_add(["a", "fresh"], [("a", "bigint"), ("fresh", "double")]) == []


def test_add_columns_sql_is_additive_only():
    sql = b.add_columns_sql("s.t", [("fresh", "double"), ("flag", "boolean")])
    assert sql == "ALTER TABLE s.t ADD COLUMNS (`fresh` double, `flag` boolean)"
    assert "DROP" not in sql.upper()


def test_after_adding_columns_the_select_includes_them():
    sel = b.select_list(["a", "fresh", "_source_file", "_source_modified_at", "_loaded_at", "_sha256"], ["a", "fresh"])
    assert "`fresh`" in sel and "NULL AS `fresh`" not in sel
