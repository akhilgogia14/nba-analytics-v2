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

## Step 7: Can Databricks read R2? DONE 2026-11-07 (details in `docs/tier2-findings.md` section 1)
- **Read what Databricks Free Edition says about outside network access and external storage.** Done 2026-11-07: Free Edition is serverless-only, and outbound internet is limited to an unpublished list of trusted domains that varies by region; custom storage locations are listed as unsupported, and the docs do not say whether R2 external locations work. Unity Catalog does document R2 external locations (`r2://bucket@account-id.r2.cloudflarestorage.com`, needs a storage credential and a newer runtime). The test below decides.
- Result: yes. Network test passed; a notebook with `boto3` and the secret scope `nba-v2-r2` read R2; and a read-only Unity Catalog external location `nba_r2_raw` (credential `nba_r2_ro`) works with SQL `read_files`. Bronze will use the external location. The `boto3` route is the fallback. Leftover to decide after bronze works: the `nba-v2-r2` secret scope.
- Still untested: Auto Loader, `COPY INTO` and Delta Change Data Feed on this setup.

## Step 8: Peek at the tier 2 tables (read-only). DONE 2026-11-07
- Findings, keys and rules for bronze and silver are in `docs/tier2-findings.md` (2025 season only).
- Open items from it: what `game_rosters` really lists, how to link a shot to its play-by-play row, and why 80 `game_lineups` rows disagree.

## Step 9: Bronze. DONE 2026-11-10 (release notes 005 and 006)
- All 15 tables (tiers 1 and 2) are in `workspace.nba_v2_bronze`, loaded by `scripts/bronze_load.py`. Row counts match the source files exactly; keys checked; a second run finds nothing to do.
- Event tables replace a changed file's rows; snapshot tables (season stats, lineups, standings, rosters) append each changed version so history builds.
- Not yet exercised on real data: the append path for a second version of a file (first happens when a 2027 snapshot file changes).

## Step 10: Daily jobs
- **10a. Daily sync to R2: DONE** (`.github/workflows/daily-sync.yml`, release note 004). Slack alerts not set up (skipped by the owner for now).
- **10b. Bronze after the sync: NEXT.** Add a step to the same workflow that runs `scripts/bronze_load.py --execute` once the sync succeeds. Needs a Databricks token as a repo secret (owner creates it), the Databricks CLI in the workflow, and the warehouse running. Release note and PR.
- **10c. Databricks jobs for bronze to silver and silver to gold**, after silver exists (Step 11).

## Step 11: Silver for the core tables
- **Apply the rules in `docs/spike-findings.md` section 9** (ignore team_id 0 and unplayed games; "played" means minutes greater than 0; convert minutes text; dates via the schedule; player box scores are the player source; key checks on every load)
- **Quality gates, then release note**

Later (not yet): simple gold tables, simple visuals, tier 2 in silver, the research app, back-test harness, ML. See PLAN.md and `docs/LEARNING.md`. Parked ideas are at the end of PLAN.md.
