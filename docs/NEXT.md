# NEXT: current task list

Written by the planning chat. Do these in order, one step at a time, in teaching mode (see CLAUDE.md). Stop after each step.
First action: commit `CLAUDE.md` and `docs/` on your first branch (they are already on disk, untracked).

## Step 1: Finish the source spike (read-only, no R2, no repo data)
- **Download the 2026 and 2027 parquet files for the core tables to a temp folder**
- **List columns and row counts; find the earliest and latest game date**
- **Check what `_2022` and `_2027` mean in real dates**
- **Read the license text**

## Step 2: Check data quality
- **Check each row has a unique, never-empty key**
- **See how a "did not play" player appears in the box scores**
- **Compare game_logs vs box scores row counts for one season to explain the size gap**
- **Check the injury report: columns, history, how recent**

## Step 3: Write it down
- **Create a branch; in PLAN.md fix the source repo name (files are on `sportsdataverse/sportsdataverse-data` releases) and replace its "Wording" paragraph with the "Positioning and wording" rule from CLAUDE.md**
- **Save findings to `docs/spike-findings.md`**
- **Write release note `docs/releases/001-source-spike.md`**
- **Open a pull request**

## Step 4: Databricks login and read-only inventory
- **Install the Databricks CLI with Homebrew (show the command first)**
- **The owner runs the login in their own terminal (no secrets in chat)**
- **List v1 jobs, apps, schemas, tables, warehouses and secrets; change nothing**
- **Save the list to `docs/v1-inventory.md`**

## Step 5: Propose the v1 cleanup (do not run it yet)
- **Turn the inventory into a numbered cleanup list, in this order: stop schedules, then the app, then jobs, then anything else**
- **Mark each item reversible or not**
- **Ask the owner about the v1 tables (keep or delete)**
- **Wait for a yes on each item before touching it**

## Step 6: R2 access
- **Owner creates an R2 API token scoped to `nba-bucket` (read and write) and stores it as an environment variable**
- **Write a tiny script that lists the bucket (read-only test)**
- **Then upload one small file to `raw/hoopr_stats/...` plus a manifest entry, as a test**
- **Release note and review before the full backfill**

Later steps (not yet): full 2022+ backfill to R2, load bronze in Databricks, silver, simple gold, simple visuals. See PLAN.md and `docs/LEARNING.md`.
