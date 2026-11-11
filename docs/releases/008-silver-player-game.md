# Release 008: silver `player_game` (first silver table)

Date: 2026-11-10
Branch / PR: PR #13 (`feat/silver-player-game`, merged 2026-11-11); follow-up in the update section below (`feat/silver-run-log`)
Author: (Claude Code)

## What changed
- New table `workspace.nba_v2_silver.player_game`: one row per player per game, key `(game_id, person_id)`, 177,122 rows (2022 to 2027). It includes players who did not play (`played = false`, with their reason in `dnp_reason`).
- `sql/silver/player_game.sql` defines the table as one SELECT over bronze `player_boxscores` joined to `schedules` (date, season type, opponent). Minutes text becomes seconds; `played` means minutes greater than 0; `started` means a non-empty `position`.
- `sql/silver/player_game_gates.sql` holds 8 quality gates (each returns a bad-row count; 0 passes).
- `scripts/silver_build.py` runs the gates on the would-be rows first, then creates the table (Delta Change Data Feed on) and runs a `MERGE`. Dry run by default.
- Rows are compared by a hash of the whole row (`_row_hash`), so unchanged rows are not rewritten and the change feed only shows real changes.

## Why
PLAN.md step 4 (clean into silver) and the rules in `docs/spike-findings.md` section 9. The owner chose to keep non-playing rows and to use `MERGE` plus Change Data Feed, so gold can later read only what changed.

## How to verify
- Dry run, then `--execute` (run 1): source rows 177,122, gates on source all pass, table rows 177,122, gates on table all pass.
- `--execute` again (run 2): `MERGE would: insert 0, update 0, delete 0`. `DESCRIBE HISTORY` shows versions 0 (create), 1 (MERGE), 2 (MERGE); the change feed holds only `insert / version 1 / 177,122`, so the no-change run left no rows in the feed.
- Change detection, tested as queries on modified copies of the SELECT (table untouched): one changed source row gives `[0 inserts, 1 update, 0 deletes]`; removing one game from the source gives `[0, 0, 27]` (the 27 rows of that game). An earlier attempt reported 0 updates because my test picked a key that did not exist; redone with a real key.
- Gates found on the first run: 7 passed, 1 failed (`stats_without_minutes`: Tony Bradley, IND, game 0022400942, 1 rebound at `0:00`). Points still match the team total, so I changed the gate to fail on points without minutes and kept the other case as a warning (1 row today).
- `.venv/bin/python -m pytest -q`: 46 passed (9 new). Three deliberate breakages (NULL-safe key match, update condition, feed switched off) were each caught by a test.

## Files added or changed
- `sql/silver/player_game.sql`: the table definition.
- `sql/silver/player_game_gates.sql`: quality gates (and the warning query, as a comment).
- `scripts/silver_build.py`: gates, create, MERGE, post-check.
- `tests/test_silver_build.py`: tests for the SQL builders.
- `docs/NEXT.md`: Step 10b marked done, Step 11 progress.
- `docs/releases/008-silver-player-game.md`: this note.

## Risks and things I am unsure about
- `MERGE` deletes silver rows that vanish from bronze (so silver mirrors bronze). Silver can be rebuilt from bronze, but a bad bronze load would be copied. The script stops if the source returns 0 rows; there is no other size guard yet.
- Not run automatically yet: silver only updates when someone runs the script. The Databricks job that does it daily is Step 10c.
- The warning case (stats at `0:00`) is one row today; if it grows the rule may need a look. I kept `played = false` for it.
- `season_type` is text from the schedule (`regular-season` etc.); `season_type_id` is also kept. Schedule dates are strings in bronze and cast to DATE here; a bad date would fail the gate `missing_game_date` only if it parses to NULL.
- Gates compare player points to team points from `team_boxscores`; if both came from one wrong source they would agree. They are independent files, but the same upstream.
- Change Data Feed on Free Edition: tested working here, retention and cleanup behaviour not studied.

## Review focus for Codex
The `<=>` key match and the `WHEN NOT MATCHED BY SOURCE THEN DELETE`, `_row_hash` coverage (`to_json(struct(*))`), the minutes conversion for `x:60` values, and the `started` rule.

## Open questions for the owner
Both answered 2026-11-11 (see the update section): keep delete-on-vanish, with a size guard; keep the `0:00` row and monitor it in a table.

## Update 2026-11-11 (follow-up PR): run log, oddities table, delete guard
Answering the two questions above, the owner chose: delete rows that vanish from bronze, a way to see what changed from run to run, and keep the `0:00` row but monitor it in an appending table.

**What changed**
- **Delete guard.** If a MERGE would delete more than 1% of the table's rows (about 1,770 today), the run stops and says why. `--allow-large-delete` overrides it. Smaller deletes, such as one corrected game's 27 rows, go through and are printed.
- **`workspace.nba_v2_silver._build_log`.** One row per run: counts inserted, updated and deleted (read from the change feed), source and table row counts, the table version before and after, new oddities logged, and up to 5 examples of changed rows (which columns changed, old to new) and deleted keys. To see every change in a run: `SELECT * FROM table_changes('workspace.nba_v2_silver.player_game', <version_before + 1>, <version_after>)`.
- **`workspace.nba_v2_silver._data_warnings`.** Oddities that are not failures. A row is appended the first time it is seen (same table, warning name and row key is never added twice). First entry: `stats_at_zero_minutes`, key `0022400942|1628396` (Tony Bradley, IND, 2025-03-11, 1 rebound at `0:00`). Warnings are defined in `sql/silver/player_game_warnings.sql`, so adding another is one SELECT.
- The old commented-out warning query was removed from `player_game_gates.sql`.

**What I checked on the `0:00` row** (read-only, before the owner's decision): player rebounds and assists add up to the team totals in all 13,518 team-games (0 mismatches), including that game (IND 38 and 38). The cause of a rebound at `0:00` is not known.

**How verified**
- Dry run (no change): `MERGE would: insert 0, update 0, delete 0`. Two `--execute` runs: both `inserted 0, updated 0, deleted 0`; the first logged 1 oddity, the second 0 (no duplicate). `_build_log` holds 2 rows (versions 2 to 3 and 3 to 4).
- `.venv/bin/python -m pytest -q`: 53 passed.
- Not verified on real data: the example output for changed and deleted rows. Bronze did not change between runs, so that path is tested only with a fake database.

**Files**
- `scripts/silver_build.py`, `tests/test_silver_build.py`: guard, log tables, examples.
- `sql/silver/player_game_warnings.sql`: new. `sql/silver/player_game_gates.sql`: comment only.

**Risks**
- Each run adds a Delta version even when nothing changed (a MERGE with no changes still commits), so the version number goes up by about 1 per run. This is harmless.
- The change feed keeps rows for as long as the table's old versions are kept; `_build_log` keeps the counts and examples permanently.
- The 1% guard is a guess; it can be tightened or loosened.
- A second table's warnings and gates must be added with each new silver table (a test checks the files exist).

## Owner walkthrough
- **What this does:** it makes a clean table of every player in every game since 2022, with the date, opponent, minutes as a number, whether they played and whether they started, plus the main stats. Players who sat out are included and marked, so a missing row never means "did not play".
- **What you would see:** in Databricks, `workspace.nba_v2_silver.player_game` with 177,122 rows. Filter `played = true` for 144,458 players who actually played.
- **The checks:** before anything is written, 8 tests run, for example "no player appears twice in a game", "every game has 5 starters per team" and "the players' points add up to the team's points". If one fails, nothing is written.
- **Change tracking:** running the build twice changes nothing the second time, and the table keeps a log of exactly which rows changed. Later tables will read only that log.
- **What to check yourself:** open the table and run `SELECT * FROM workspace.nba_v2_silver.player_game WHERE player_name LIKE '%Jokic%' ORDER BY game_date DESC LIMIT 10`.
- **Added 2026-11-11, the run log:** `_build_log` is a diary of every build (how many rows were added, changed or removed, with a few examples). `_data_warnings` is a short list of odd rows worth a look; it adds a row only the first time it sees something. Check it with `SELECT * FROM workspace.nba_v2_silver._data_warnings`.
- **The safety stop:** if a build would delete more than 1% of the table, it stops instead.
