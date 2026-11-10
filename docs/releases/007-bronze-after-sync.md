# Release 007: bronze loads automatically after the daily sync

Date: 2026-11-10
Branch / PR: PR #12 (`ci/bronze-after-sync`)
Author: (Claude Code)

## What changed
- `.github/workflows/daily-sync.yml` now runs `scripts/bronze_load.py --execute` after both syncs succeed (Databricks CLI pinned to 1.24.0; the token and workspace address come from repo secrets and only the bronze step sees them). The run summary has a bronze line.
- `scripts/bronze_load.py` now adds new source columns to the bronze table itself, prints each one and records it in the run record (`schema_changes`). Before, a new column stopped the load.

## Why
The owner wants new files in bronze as soon as they land, at whatever time that is. The plan: GitHub runs sync and bronze; Databricks jobs run bronze to silver and silver to gold.

## How to verify
- Manual run from the branch, 2026-11-10: first attempt synced 16 changed files, loaded 6 into bronze, then stopped on a source schema change (all six possessions files were re-published with 3 new columns: `seconds_to_first_shot`, `is_transition`, `is_garbage_time`). That proved the login to Databricks works and that the load stops safely.
- After the change: second manual run green. `SCHEMA CHANGE ... adding [...]`, 13 files loaded, all key checks OK, run record `_manifest/2026-11-10T143920Z-bronze.json` (complete). A following dry run: `UNCHANGED: 90` of 90.
- The first live test of the append path: `standings` for 2027 now holds 2 dated versions (60 rows); the other snapshot tables grew the same way.
- `.venv/bin/python -m pytest -q`: 37 passed; 3 of 4 deliberate breakages of the new code were caught (the fourth is a wiring line in `main()` that the live run covers).

## Files added or changed
- `.github/workflows/daily-sync.yml`: the bronze step, CLI setup and summary line.
- `scripts/bronze_load.py`, `tests/test_bronze_load.py`: additive column handling.
- `docs/releases/007-bronze-after-sync.md`: this note.

## Risks and things I am unsure about
- The daily run now needs the Databricks token (90-day lifetime). When it expires the bronze step fails with a login error and GitHub emails. Calendar a renewal around 2026-02-05 (token created 2026-11-10; check the exact date under Settings, Developer, Access tokens).
- A new source column is now added without asking. It is additive (older rows are NULL), but a renamed column would look like a new column plus an empty old one; silver has to notice.
- A column that changes type in a way that cannot be converted still fails the load.
- Bronze has no automatic undo for the added columns (Delta keeps the table history, but columns are not dropped).
- If the sync succeeds and bronze fails, R2 is ahead of bronze until the next run; the next run catches up because it compares checksums.
- Slack is still not set up; the workflow skips it.
- Scheduled runs can start hours late (up to about 4 hours seen); nothing downstream may assume a clock time.

## Review focus for Codex
`columns_to_add` and the ALTER before the INSERT, the workflow conditions that keep bronze from running after a failed sync, and which steps can see `DATABRICKS_TOKEN`.

## Open questions for the owner
1. Is auto-adding source columns to bronze fine? (I made this choice; the alternative is stopping and alerting every time.)

## Owner walkthrough
- **What this does:** each day, after GitHub copies the new data into your bucket, it also tells Databricks to load whatever changed into the raw tables. You do nothing.
- **What you would see:** in the Actions tab, one run with steps for the two syncs and "Load bronze". The summary shows how many files were checked and changed, for each.
- **The new-columns surprise:** the data source added three columns to the possessions data today. The first test stopped, I allowed new columns to be added, and the second test passed. Old rows show empty for those columns.
- **What to check yourself:** open the latest run, expand "Load bronze" and look for "KEY CHECK ... OK" lines and the "Run record written ... (complete)" line.
