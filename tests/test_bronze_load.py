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


def test_load_sql_replaces_only_that_file():
    sql = b.load_file_sql("s.t", "r2://b@h/raw/f.parquet", "sha1")
    assert "REPLACE WHERE _source_file = 'r2://b@h/raw/f.parquet'" in sql
    assert "'sha1' AS _sha256" in sql
    assert "DELETE" not in sql.upper() and "DROP" not in sql.upper()


def test_key_check_covers_every_key_part():
    sql = b.key_check_sql("s.t", ["game_id", "person_id"])
    assert "count(DISTINCT game_id, person_id)" in sql
    assert "game_id IS NULL OR person_id IS NULL" in sql
