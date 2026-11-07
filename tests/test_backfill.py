import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import backfill  # noqa: E402


def asset(name, size=10, updated="2026-01-01T00:00:00Z"):
    return {"name": name, "size": size, "updated_at": updated, "browser_download_url": f"https://x/{name}"}


def test_select_assets_one_per_season_ignores_other_formats_and_years():
    assets = [asset("t_2021.parquet"), asset("t_2022.parquet"), asset("t_2022.csv"),
              asset("t_2022.rds"), asset("t_2023.parquet")]
    picked = backfill.select_assets(assets, [2022, 2023])
    assert [p["name"] for p in picked] == ["t_2022.parquet", "t_2023.parquet"]


def test_select_assets_fails_when_a_season_is_missing():
    with pytest.raises(ValueError):
        backfill.select_assets([asset("t_2022.parquet")], [2022, 2023])


def test_select_assets_fails_when_two_files_match():
    with pytest.raises(ValueError):
        backfill.select_assets([asset("a_2022.parquet"), asset("b_2022.parquet")], [2022])


def test_r2_key_layout():
    assert backfill.r2_key("raw/hoopr_stats", "nba_stats_schedules", 2025, "f.parquet") == \
        "raw/hoopr_stats/nba_stats_schedules/2025/f.parquet"


def test_is_parquet():
    assert backfill.is_parquet(b"PAR1" + b"x" * 20 + b"PAR1")
    assert not backfill.is_parquet(b"<html>not parquet</html>")
    assert not backfill.is_parquet(b"PAR1PAR1")  # too short to be a real file


def test_classify_new_when_missing_in_r2():
    assert backfill.classify(asset("a"), None) == "NEW"


def test_classify_unchanged_when_labels_match():
    a = asset("a", size=10, updated="U1")
    head = {"ContentLength": 10, "Metadata": {"source_updated_at": "U1"}}
    assert backfill.classify(a, head) == "UNCHANGED"


def test_classify_check_when_labels_missing_or_stale_or_size_differs():
    a = asset("a", size=10, updated="U2")
    assert backfill.classify(a, {"ContentLength": 10, "Metadata": {}}) == "CHECK"
    assert backfill.classify(a, {"ContentLength": 10, "Metadata": {"source_updated_at": "U1"}}) == "CHECK"
    assert backfill.classify(a, {"ContentLength": 9, "Metadata": {"source_updated_at": "U2"}}) == "CHECK"


def test_resolve():
    assert backfill.resolve("abc", "abc") == "UNCHANGED"
    assert backfill.resolve("abc", "abd") == "CHANGED"


def test_is_parquet_rejects_truncated_file():
    # starts like parquet but the download was cut off (no closing marker)
    assert not backfill.is_parquet(b"PAR1" + b"x" * 100)
