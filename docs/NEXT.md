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
- **10b. Bronze after the sync: DONE 2026-11-10** (PR #12, release note 007). The daily workflow loads bronze after both syncs succeed. New source columns are added to bronze automatically and logged.
- **10c. Silver as a Databricks job: DONE 2026-11-11** (release note 009, `databricks.yml`, `jobs/silver_build_task.py`). The daily workflow deploys the bundle and runs the job after bronze succeeds. A silver to gold job comes with the first gold tables.

## Step 11: Silver for the core tables
- **11a-e. `player_game`: DONE 2026-11-10** (release note 008, `sql/silver/`, `scripts/silver_build.py`). Rules from `docs/spike-findings.md` section 9 applied; 8 quality gates; MERGE with Change Data Feed, a run log (`_build_log`), an oddities table (`_data_warnings`) and a 1% delete guard (PR #13 and follow-up).
- **11f. `team_game` and `game`: DONE 2026-11-11** (release note 010). All three silver tables are rebuilt by the daily Databricks job.
- **Next: the first simple gold tables** (PLAN.md, `docs/MODELING.md`), plus a silver to gold step in the same job. Tier 2 silver (play-by-play, shots and so on) comes later.

## Step 12: Gold (the tables the app reads)
- **12a-c. `player_game_log`: DONE 2026-11-11** (release note 011, `sql/gold/`). One row per played player-game, with prior-10 and prior-season averages and labels. Built by the same job after silver.
- **12d. `player_form`: DONE 2026-11-12** (release note 012), written in PySpark as a trial. Long table, one row per player per stat, all 1,084 players (11,924 rows). Decision (owner, 2026-11-12): new gold tables are written in PySpark (see CLAUDE.md, Build conventions).
- **12e. `game_slate`**: games from yesterday through the next 7 days for "Today's games". Needs the delete-guard floor first (the guard only trips above 1% and above 100 rows), because it loses about 10 past games a day.
- Open: add `days_since_prior_game` to the log (release 011 question).


## Step 13: The first app (React + TypeScript + Vite + Tailwind)
- Owner decisions (2026-11-12): first pass as a Databricks App, then an always-on host (Cloudflare D1 with Pages and Workers); the app never queries Databricks in the long run. Design idea: the Scorecards mock-up (team, player, opponent selectors, switchable themes).
- **13a. Scaffold and health check: DONE** (release note 013, `app/`). Builds, and the server reads `player_form` through the warehouse locally.
- **13b. Deploy to Databricks Apps: DONE 2026-11-13** (release note 014). App `nba-player-form` is running and reads `player_form`; the app identity has four approved grants. It is not public and stops after about 24 hours (restart: `databricks apps start nba-player-form`).
- **13c. The Player form page: DONE 2026-11-13** (release note 015). Team and Player dropdowns, six scorecards with range bars, combined-stats table, four themes (Paper default). Reads only `player_form`. Deployed; not yet looked at in a browser by anyone (owner's first look is the real test).
- **13d-1. Plan agreed with the owner** (three gold tables, PySpark, opponent figures labelled by year and regular season or playoffs; build order team_form, team_vs_opponent, player_vs_opponent, one PR each).
- **13d-2. `team_form`: DONE 2026-11-13** (release note 016). 240 rows, 10 gates, 15 corrupted-copy checks, built by the daily job. Not read by the app yet (needs its own SELECT grant).
- **13d-3. `team_vs_opponent`: DONE 2026-11-13** (release notes 017, then 018: reworked so every row is ONE game type, never a regular-season and playoff blend). 47,232 rows, 11 gates, 21 corrupted-copy checks. Not read by the app yet (needs its own SELECT grant).
- **13d-4. `player_vs_opponent`** (next, same rule: one game type per row; also decide whether team_form and player_form get split by game type), then app endpoints and the Opponent dropdown and team view, each new table with its own SELECT grant. Also open: reach players who have not played this season; auto-deploy from GitHub.
- Later: the real Player form page from the Scorecards design; team form and player-vs-opponent gold tables; D1 export and the always-on host.


Later (not yet): more gold tables, simple visuals, tier 2 in silver, the research app, back-test harness, ML. See PLAN.md and `docs/LEARNING.md`. Parked ideas are at the end of PLAN.md.
