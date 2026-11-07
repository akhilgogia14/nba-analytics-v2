# NEXT: current task list

Written by Claude Code, refreshed 2026-11-07. Do these in order, one step at a time, in teaching mode (see CLAUDE.md). Stop after each step.

## Done (details in the files named)
- Source spike and data-quality checks: `docs/spike-findings.md`, release 001.
- Databricks CLI installed and logged in; read-only inventory of v1; two stopped v1 apps deleted: `docs/v1-inventory.md`.
- R2 access (token, `.env`, `.gitignore`, test upload): release 002.
- Sync script, tests, and tiers 1 and 2 landed untouched in R2 (90 files, 164 MB, manifests complete): release 003.

## Waiting on the owner
- Merge PR for release 003 (it also carries this file).
- Python 3.12 locally (before the daily job). Release 003 question 2.
- v1 leftovers (job, three secret scopes, 65 archived tables): keep until v2 works, then decide.

## Step 7: Can Databricks read R2? (decides how data gets into bronze)
- **Read what Databricks Free Edition says about outside network access and external storage.** Done 2026-11-07: Free Edition is serverless-only, and outbound internet is limited to an unpublished list of trusted domains that varies by region; custom storage locations are listed as unsupported, and the docs do not say whether R2 external locations work. Unity Catalog does document R2 external locations (`r2://bucket@account-id.r2.cloudflarestorage.com`, needs a storage credential and a newer runtime). The test below decides.
- **Run one harmless network test from Databricks (no secrets): can it reach the R2 endpoint over HTTPS?**
- **If reachable, test reading one small file with the R2 keys held in a Databricks secret scope (the owner enters the keys)**
- **If not, pick the fallback route and write the decision down** (for example: copy files into a Unity Catalog Volume with the Databricks CLI or a job, then load bronze from there)

## Step 8: Peek at the tier 2 tables (read-only)
- **Open one season of each tier 2 file (play-by-play, shots, possessions, lineups, game lineups, season stats, rosters, standings, officials)**
- **List columns, row counts, candidate keys, empty keys, obvious quirks**
- **Save findings to `docs/tier2-findings.md`**

## Step 9: Bronze for the core tables
- **Confirm schema names with the owner** (proposal: `workspace.nba_v2_bronze`, `nba_v2_silver`, `nba_v2_gold`)
- **Create the bronze schema and load tier 1 as-is, adding only load metadata (source file, checksum, loaded_at)**
- **Reconcile row counts against the parquet files**
- **Row-level change capture: MERGE on keys, plus Delta Change Data Feed if Free Edition supports it (hash-compare is the fallback)**
- **Release note and PR**

## Step 10: Daily GitHub Actions job
- **Workflow that runs `scripts/backfill.py` for tiers 1 and 2 on a schedule, with R2 keys as repository secrets (the owner adds them)**
- **Alert on failure; first real run of the "changed file" path on the 2027 files**
- **Release note and PR**

## Step 11: Silver for the core tables
- **Apply the rules in `docs/spike-findings.md` section 9** (ignore team_id 0 and unplayed games; "played" means minutes greater than 0; convert minutes text; dates via the schedule; player box scores are the player source; key checks on every load)
- **Quality gates, then release note**

Later (not yet): simple gold tables, simple visuals, tier 2 in silver, the research app, back-test harness, ML. See PLAN.md and `docs/LEARNING.md`. Parked ideas are at the end of PLAN.md.
