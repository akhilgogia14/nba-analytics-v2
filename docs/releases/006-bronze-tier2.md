# Release 006: bronze for the tier 2 tables

Date: 2026-11-10
Branch / PR: `feat/bronze-tier2`
Author: (Claude Code)

## What changed
- Eleven more bronze tables: `pbp`, `shots`, `possessions`, `game_lineups`, `game_rosters`, `officials`, `lineups`, `player_season_stats`, `team_season_stats`, `standings`, `rosters`. With release 005, all 15 landed datasets are in `workspace.nba_v2_bronze`.
- `scripts/bronze_load.py` now has two modes per table: `replace` (event data: a changed file's rows are swapped) and `append` (snapshots: each changed file version is added and old versions stay, so history builds up, per `docs/tier2-findings.md` rule 8).
- Loads are by column name, not position, because seasons differ: the 2027 lineups, player and team season stats files add columns, standings changes types, rosters drops one. Tables are built from the union of all seasons; missing columns are NULL; a file with a column the table lacks stops the load.
- The tier 2 findings doc and the refreshed NEXT.md and PLAN.md (PR #7 was merged into a side branch, not main) now reach main.

## Why
PLAN.md build order step 3 (bronze) for everything landed in R2, so silver can be built from one place.

## How to verify
- Total rows, bronze vs reading all parquet files directly, all 15 tables: identical (for example pbp 3,509,588; shots 1,193,568; possessions 1,406,179; injury_report 1,219,044). Each has 6 source files, `_rescued_data` empty and `_sha256` filled.
- Key checks passed (rows = distinct keys, no NULL key parts) for the 12 tables that have a key; append tables are checked within one file version.
- Second run: `Files: 90 | UNCHANGED: 90`.
- `.venv/bin/python -m pytest -q`: 33 passed; 7 deliberate breakages of the new logic were all caught.
- Run record: `_manifest/2026-11-10T134545Z-bronze.json`.

## Files added or changed
- `scripts/bronze_load.py`: append mode, load by column name, tables built from all seasons.
- `tests/test_bronze_load.py`: tests for the above.
- `config/sources.json`: the 11 new tables with modes and keys.
- `docs/tier2-findings.md`, `docs/NEXT.md`, `PLAN.md`: brought onto main.
- `docs/releases/006-bronze-tier2.md`: this note.

## Risks and things I am unsure about
- The append path was only run for first loads. The first time a snapshot file changes (a 2027 file, probably within days) is its first live test of adding a second version; check that run.
- `shots` and `game_lineups` have no key, so only row counts protect them. Rules 4 and 5 in the findings still apply in silver.
- A source column added to an old season file stops the load by design. That alert needs a decision, not a retry.
- The daily snapshot copies grow storage a little each day for the 2027 files; the season-stats and lineups files are under 1 MB each now.
- `game_rosters` is loaded under that name only because the table is called that in the source; its meaning is unconfirmed (finding 6).
- Load time: the full tier 2 load took roughly 10 minutes on the small SQL warehouse; a daily run with a few changed files is short.

## Review focus for Codex
`select_list` (by-name insert, NULL fill, extra-column stop), `classify_snapshot` (could a changed snapshot be skipped?), and the append key check scope.

## Open questions for the owner
1. Add the bronze step to the daily workflow next? It needs a Databricks token created by you.

## Owner walkthrough
- **What this does:** the rest of the raw data (play-by-play, shots, possessions, season stats, standings and others) is now in Databricks next to the box scores, unchanged. Fifteen raw tables in total.
- **What you would see:** Databricks, Catalog, workspace, `nba_v2_bronze`: fifteen tables. Every row says which file it came from and the file's fingerprint.
- **Two kinds of table:** game-by-game data is refreshed in place when its file changes. Season-level tables (standings, rosters, season stats, lineups) keep every dated copy, so you can later see how a team's standing changed week by week.
- **What to check yourself:** `SELECT count(*) FROM workspace.nba_v2_bronze.pbp` should return 3,509,588 today (more as games are added).
