# Release 033: gold `player_season_games` carries the rest of the box score

Date: 2026-11-13 (UTC)
Branch / PR: `feat/fuller-box-score` (PR number added after opening)
Author: (Claude Code)

## What changed
- `gold.player_season_games` gains 11 columns: `started`, `fgm`, `fga`, `fg3a`, `ftm`, `fta`, `oreb`, `dreb`, `tov`, `pf`, `plus_minus`. They hold the player's numbers for games he played and are NULL for games he missed, like the existing stat columns. Same rows, same key, same "played" rule: nothing else about the table changes.
- **The table was altered first, by hand, with the owner's approval** (2026-11-13): `ALTER TABLE ... ADD COLUMNS (...)`. It only added empty columns; the 288,143 rows, the key and the app's SELECT grant were untouched. This pull request is the code that fills them.
- Gates: the existing "stats differ from silver" gate now also compares the 11 new columns (and requires them empty for missed games). Two new gates: `box_score_arithmetic_wrong` (makes never exceed attempts, threes are part of field goals, offensive plus defensive rebounds equal rebounds, points equal 2 x field goals plus threes plus free throws made; computed on the table's own numbers, so it is independent of the PySpark code) and `played_row_missing_box_score` (a played game with any of the 11 empty). Both pass on silver: **0 violations of any rule across all 144,822 played rows**, and also for the 4 extra rows the owner's wider "played" rule adds.

## Why
The owner asked for a fuller box score (field goals, free throws, turnovers, fouls, plus/minus) in the box-score table. The numbers live in silver, so the table the app already reads is extended; no new table and no new grant are needed.

## How to verify
- `.venv/bin/python -m pytest tests -q`: **98 passed** (96 before; 2 new: the new columns come through for played games and are empty for missed ones, and the column order). Local Spark, so the real Databricks run is still the final check.
- New gate SQL run read-only against the real table while the new columns were still empty: it ran, only `stats_differ_from_silver` and `played_row_missing_box_score` fired (144,826 played rows each, as they should), and the other 14 gates passed.
- **Not done yet:** the real job run that fills the columns (needs the owner's yes), the corrupted-copy checks on the filled output, and the app change that shows the columns.

## Files added or changed
- `scripts/gold_player_season_games.py`: carries the 11 columns through. `sql/gold/player_season_games_gates.sql`: the extended and the two new gates. `tests/test_gold_player_season_games.py`: the new tests.

## Risks and things I am unsure about
- **Timing with the daily sync.** The table now has 11 columns the old code does not write. The job's MERGE copies "all columns", so if the daily sync runs old code (from `main`) before this is merged, the gold step of that run may fail on the mismatch; I could not test this without running it. If it does, nothing is written (the failure happens before any change) and merging this fixes it. Merging this pull request soon avoids it.
- The first real run will rewrite all 288,143 rows as "updated" (the new columns fill in); that is expected.

## Later
- Corrupted-copy checks on the filled output (recorded here after the run), the app route and table.

## Review focus for Codex
- `box_score_arithmetic_wrong`: whether any real game could legitimately break one of those rules (none of 144,822 does).

## Owner walkthrough
- **What changed:** behind the scenes only; nothing on the page yet. The table the page reads from now has room for the rest of each game's box score: shots made and tried, free throws, rebounds split into offensive and defensive, turnovers, fouls, plus/minus, and whether he started.
- **What the checks do:** they re-add the numbers the way a scorer would (points = twos x 2 + threes + free throws; rebounds = offensive + defensive; makes never above attempts) and compare everything to the cleaned source data. They all agreed on every real game.
- **Next:** I run the job to fill the columns (I will ask first), then build the fuller table on the page.
