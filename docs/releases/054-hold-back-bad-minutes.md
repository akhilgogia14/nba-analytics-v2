# Release 054: hold back a game with impossible team minutes instead of stopping the whole build

Date: 2026-11-16
Branch / PR: fix/hold-back-bad-minutes
Author: (Claude Code)

## What changed
- Silver `team_game` now leaves out any game where a team's minutes are not a possible total (240:00 plus 25:00 per overtime). Both rows of the game are left out; every other game still builds.
- The `dropped_vs_bronze` gate now expects those rows to be missing. A new gate, `too_many_games_held_back`, stops the build if more than 5 games are held back at once (that would mean a format change, not one bad file).
- A new warning, `game_held_back_bad_team_minutes`, names each held-back game (date, teams, the minutes) in `_data_warnings`.
- Not changed: minutes that cannot be read at all (empty) are still NOT held back and still fail the `minutes_unparsed` gate, and every other gate is untouched.

## Why
On 2026-11-15 (run 43777594759) one source box score, game 0022600231 (NOP vs DEN, Nov 14), listed DEN's team minutes as 168:00 (a player's minutes missing; 10 of 13 players had minutes). The `overtime_minutes_invalid` gate correctly stopped the silver build, and with it every table after it, so no new game reached gold or the app, and `game_context` could not be built. One bad file should not hold back all the others. The owner chose "hold back only the bad game" (option 2).

## How to verify
- `.venv/bin/python -m pytest -q`: 120 passed (6 new in `tests/test_silver_team_game_hold_back.py`). With the old SQL put back, 4 of the 6 fail; the other 2 test behavior that was meant not to change.
- Real data, dry run only (nothing written): bronze has 13,584 real team rows; the new select returns 13,582 (exactly the 2 rows of game 0022600231); all 12 gates pass; the warning returns one row: `{"game_date":"2026-11-14","home":"NOP","away":"DEN","home_minutes":"240:00","away_minutes":"168:00"}`.
- Corrupted copies still fire: a game dropped from the build -> `dropped_vs_bronze`; a duplicated row -> `key_not_unique`, `dropped_vs_bronze`, `games_without_one_home_one_away`; bad minutes slipped into the build -> `overtime_minutes_invalid`; points +1 -> `plus_minus_not_margin`, `points_differ_from_schedule`, `points_differ_from_player_sum`; with the limit set to 0 the `too_many_games_held_back` gate fires (so the wiring works).
- After merge and a job run: check the job log, the new warning in `_data_warnings`, and that `game_context` is built. Results to be added.

## Files added or changed
- `sql/silver/team_game.sql`, `sql/silver/team_game_gates.sql`, `sql/silver/team_game_warnings.sql`.
- `tests/test_silver_team_game_hold_back.py`: 6 tests that run the real SQL files on small fake bronze tables in local Spark. `docs/releases/054-hold-back-bad-minutes.md`.

## Risks and things I am unsure about
- A held-back game is missing from `team_game` (so from the Teams page, team forecasts and `team_game_log`) until the source is corrected. Silver `game` still shows it as final with the score taken from the box score (the points check against the players' points passed), so Today's games shows the result.
- The held-back rule is on minutes only. A different single-game defect (for example points differing from the players' sum) still stops the whole build, as before. That may deserve the same treatment later; it is an owner decision.
- The rule is written three times (select, gate, warning) so the gate does not depend on the select's own logic. If the definition ever changes, change all three.
- The hourly polls skip the job when bronze has nothing new. Bronze already holds the bad file, so after this merges the job must be run once (or the 22:17 UTC safety-net run picks it up).

## Review focus for Codex
The `NOT IN` set (NULL handling of minutes), the 5-game limit, and the three copies of the rule.

## Open questions for the owner
- Should other single-game defects (points differ from the players' sum, a missing opponent row) be held back the same way, or keep stopping everything?

## Owner walkthrough
Yesterday one game's box score from the data source was missing a player's minutes (it said Denver played 168 minutes instead of 240). The safety check did its job and stopped the pipeline, but stopping the pipeline also stopped every other game, and the new table I was building. Now the pipeline sets aside just that one game, records which game and why in the oddities table, and carries on with the rest. When the data source fixes the file, the game comes in on the next run by itself. If more than five games are set aside at once, the pipeline still stops, because that would mean something bigger changed. The change is in three small SQL files and one new test file.
