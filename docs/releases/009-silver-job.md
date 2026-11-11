# Release 009: silver builds itself as a Databricks job after bronze

Date: 2026-11-11
Branch / PR: `feat/databricks-silver-job` (PR number added when opened)
Author: (Claude Code)

## What changed
- New Databricks job `nba-v2 silver build`, defined as code in `databricks.yml` (a Databricks Asset Bundle) and run on serverless compute. Its one task, `jobs/silver_build_task.py`, runs the same `build()` as `scripts/silver_build.py`: gates, MERGE, run log, oddities.
- `.github/workflows/daily-sync.yml` has a new step after "Load bronze": `databricks bundle deploy`, then `databricks bundle run silver_build` (it waits for the job). It runs only if bronze succeeded. A failed gate fails the job and turns the workflow red. The run summary has a silver line.
- `scripts/silver_build.py` no longer imports `bronze_load` (and with it `boto3`). The SQL runner is passed in: the CLI runner on a laptop, a new `SparkRunner` inside the job. `sql_str` moved to `scripts/sqlutil.py`; `bronze_load` imports it from there.
- Only code the job needs is uploaded to the workspace (11 files: `sql/`, `scripts/`, `jobs/`, `config/`, `databricks.yml`). `.env`, `.venv`, data, tests and docs are excluded; a dry run of the upload (`databricks bundle sync --dry-run`) was checked for this.

## Why
The owner wants silver to stay current without anyone running it, at whatever time the data lands, with Databricks jobs doing the silver step (PLAN.md, daily jobs). Deploying on every daily run means the job always runs the repo's current code (v1's "job ran an old notebook copy" problem).

## How to verify
- Manual workflow run from the branch, 2026-11-11 (run 43106690273, all steps green): sync 11 changed files, bronze loaded 11 files (key checks OK; `player_boxscores` rows 177,276), silver step `Files: 16 uploaded, 1 deleted` (the old probe script, approved by the owner), job `TERMINATED SUCCESS` in about 1.5 minutes, then `Changed this run: inserted 154, updated 0, deleted 0`.
- Afterwards, read from Databricks: bronze and silver both 177,276 rows. The change feed at the new version: `insert 154`, all with game date 2026-11-10 (141 played, 13 did not). `_build_log` has the run (versions 5 to 6, 0 new oddities). The probe script is gone from the workspace folder.
- Earlier, run by hand as a job: no-change run, 177,122 rows, gates pass, `_build_log` row written (versions 4 to 5).
- `.venv/bin/python -m pytest -q`: 56 passed. New tests cover the Spark runner, the dry run reading SQL from a given folder and writing nothing, and importing `silver_build` with `boto3` blocked.
- First failed try (kept for the record): a script launched by a job has no `__file__`; the bundle now passes the uploaded folder as an argument.

## Files added or changed
- `databricks.yml`: the bundle, the job and what gets uploaded.
- `jobs/silver_build_task.py`: the job's task; turns a stopped build into a failed task.
- `scripts/sqlutil.py`: shared `sql_str`.
- `scripts/silver_build.py`: swappable runner, `SparkRunner`, `sql_dir` argument.
- `scripts/bronze_load.py`: imports `sql_str` from `sqlutil`.
- `.github/workflows/daily-sync.yml`: silver step and summary line.
- `tests/test_silver_build.py`: new tests.
- `docs/NEXT.md`, `docs/releases/009-silver-job.md`.

## Risks and things I am unsure about
- The job runs as the Databricks token's owner, and CI deploys with the same token. When the token expires (about November 2028) both bronze and silver fail with a login error.
- Deploy runs every day. It is a no-op when nothing changed, but a deploy problem blocks silver. `bundle deploy` also removes files from the workspace bundle folder that are no longer in the repo (that is how the probe disappeared); it only touches that folder.
- Free Edition allows 5 concurrent job tasks per account; silver uses 1. Gold jobs later must fit.
- The workflow's summary line depends on the text `Changed this run` in the job output. If that wording changes, the line says "did not run".
- Running `silver_build.py --execute` from a laptop while the daily job runs could collide; the workflow's lock does not cover a manual run. Rule: do not run it by hand around the daily run time.
- Each daily run adds a Delta version to the silver table even when nothing changed. Harmless.
- Only `player_game` exists; team and schedule silver tables and the gold job are not built yet.
- If Databricks queues or hangs the job, the workflow waits until its 45-minute limit.

## Review focus for Codex
What the bundle uploads (`sync.exclude`), which steps see `DATABRICKS_TOKEN`, the conditions that keep silver from running after a failed bronze, and the `SystemExit` to `RuntimeError` conversion in the job task.

## Open questions for the owner
1. Is deploying the bundle on every daily run fine? (The alternative is deploying only when `databricks.yml` or the code changes, which is more to maintain.)

## Owner walkthrough
- **What this does:** after GitHub copies the new data in and loads the raw tables, it now tells Databricks to build the clean table. You do nothing. It all happens in the same daily run.
- **What you would see:** in the Actions run, a new step "Build silver (Databricks job)" and a summary line like "silver: Changed this run: inserted 154, updated 0, deleted 0". In Databricks, under Jobs, a job called "nba-v2 silver build" with one run per day.
- **Proof it works:** yesterday's games arrived as 154 new rows in the raw table, and the clean table gained exactly those 154 (141 players who played, 13 who did not).
- **What each new file means:** `databricks.yml` is the written-down definition of the job; `jobs/silver_build_task.py` is the one task it runs; `scripts/sqlutil.py` is a tiny shared helper.
- **What to check yourself:** open the latest "daily-sync" run, expand "Build silver (Databricks job)" and look for "Changed this run" and "Run written to ... _build_log". Then in Databricks run `SELECT * FROM workspace.nba_v2_silver._build_log ORDER BY run_id DESC LIMIT 5`.
