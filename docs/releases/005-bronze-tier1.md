# Release 005: bronze for the tier 1 tables

Date: 2026-11-10
Branch / PR: PR #10 (`feat/bronze-load`)
Author: (Claude Code)

## What changed
- New schema `workspace.nba_v2_bronze` with four tables: `player_boxscores`, `team_boxscores`, `schedules`, `injury_report` (all seasons 2022-2027).
- `scripts/bronze_load.py` loads only new or changed R2 files, comparing the R2 checksum label with `_sha256` stored in bronze. Each file is swapped in one atomic statement.
- Bronze rows are the source rows untouched plus `_source_file`, `_source_modified_at`, `_loaded_at`, `_sha256` (and Databricks' `_rescued_data`, which is empty everywhere).
- Every load writes a run record to R2 (`_manifest/<id>-bronze.json`).

## Why
PLAN.md build order step 3: load into Databricks (bronze) before cleaning anything.

## How to verify
- Total rows, bronze vs reading the parquet files directly: player_boxscores 176,726 / 176,726; team_boxscores 13,490 / 13,490; schedules 8,257 / 8,257; injury_report 1,219,044 / 1,219,044. `_rescued_data` and `_sha256` null counts are 0.
- Key checks: player_boxscores (game_id, person_id), team_boxscores (game_id, team_id, side) and schedules (game_id) are unique with no NULL parts.
- A second run reported `UNCHANGED: 24` for all 24 files.
- `.venv/bin/python -m pytest -q` passes (20 tests); 7 deliberate breakages of the decision logic were all caught.

## Files added or changed
- `scripts/bronze_load.py`: the bronze loader (dry run by default, `--execute` to load).
- `tests/test_bronze_load.py`: tests for the change decision, SQL building and key checks.
- `config/sources.json`: new `bronze` section (warehouse, schema, table list and keys).
- `docs/releases/005-bronze-tier1.md`: this note.

## Risks and things I am unsure about
- Bronze keeps everything as published. Known oddities are NOT fixed here: the placeholder game `0062600001` (team_id 0) is in `team_boxscores`; 114,270 injury report rows have no player and no status; `minutes` is text.
- `injury_report` has no clean natural key, so only a row count check protects it. Silver has to decide what a unique injury row is.
- If the source adds or renames a column, the insert fails with a column mismatch (deliberate: loud, not silent). The table would then need a planned change.
- `REPLACE WHERE` with a file's path assumes the path text is identical on every run (it has been).
- The loader runs from a laptop or CI using the Databricks CLI and a running SQL warehouse; the scheduled trigger is not built yet.
- Tier 2 tables are not in bronze yet.

## Review focus for Codex
`classify_file` (could a changed file be read as unchanged?), the REPLACE WHERE predicate, what happens if the run stops halfway, and whether silver rules in `docs/spike-findings.md` section 9 still match what bronze holds.

## Open questions for the owner
1. Load tier 2 into bronze next (play-by-play, shots and others), or start silver for the core tables first?
2. How do you want the bronze load triggered after the daily sync: a step in the same GitHub workflow (needs a Databricks token secret) or a Databricks job?

## Owner walkthrough
- **What this does:** it copies the four core data sets from your R2 bucket into tables in Databricks, row for row, without cleaning anything. Think of it as the raw shelf.
- **What you would see:** in Databricks, Catalog → workspace → `nba_v2_bronze`, four tables. Open `player_boxscores`: the first columns match the source; the last four say which file each row came from, when that file was written, when it was loaded and the file's fingerprint.
- **Why re-running is safe:** the script compares fingerprints. Same fingerprint, nothing happens. A changed file replaces only that file's rows, in one step that either fully works or leaves the old rows.
- **What to check yourself:** run the table row counts in a Databricks SQL editor, for example `SELECT count(*) FROM workspace.nba_v2_bronze.schedules` should give 8,257 (it grows as new games are added).
