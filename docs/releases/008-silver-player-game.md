# Release 008: silver `player_game` (first silver table)

Date: 2026-11-10
Branch / PR: `feat/silver-player-game` (PR number added when opened)
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
1. Keep the delete-on-vanish behaviour in `MERGE`, or leave rows in silver and only add/update?
2. Should the one `0:00` row with a rebound stay as is (not played, stats kept)?

## Owner walkthrough
- **What this does:** it makes a clean table of every player in every game since 2022, with the date, opponent, minutes as a number, whether they played and whether they started, plus the main stats. Players who sat out are included and marked, so a missing row never means "did not play".
- **What you would see:** in Databricks, `workspace.nba_v2_silver.player_game` with 177,122 rows. Filter `played = true` for 144,458 players who actually played.
- **The checks:** before anything is written, 8 tests run, for example "no player appears twice in a game", "every game has 5 starters per team" and "the players' points add up to the team's points". If one fails, nothing is written.
- **Change tracking:** running the build twice changes nothing the second time, and the table keeps a log of exactly which rows changed. Later tables will read only that log.
- **What to check yourself:** open the table and run `SELECT * FROM workspace.nba_v2_silver.player_game WHERE player_name LIKE '%Jokic%' ORDER BY game_date DESC LIMIT 10`.
