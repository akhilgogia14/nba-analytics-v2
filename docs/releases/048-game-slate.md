# Release 048: gold `game_slate` (the data for "Today's games")

Date: 2026-11-14
Branch / PR: feat/game-slate
Author: (Claude Code)

## What changed
- New gold table `workspace.nba_v2_gold.game_slate`: one row per game of the latest season (2026-27), played or not. 1,267 rows on today's data (67 preseason, 1,200 regular season), 183+ of them final.
- Written in PySpark (`scripts/gold_game_slate.py`), registered in `scripts/silver_build.py`, so the daily Databricks job builds it after silver.
- 11 quality gates and 1 warning in SQL that recompute the answer from silver `game` without the PySpark code.
- Nothing in the app reads it yet. It needs its own SELECT grant (asked separately, with the exact statement).

## Why
The owner asked for a landing page of the day's games, with a click-through to each team (PLAN.md: simple visuals from gold first). `game_date` is the schedule's US date, so "today" is a date match and no tip-off time is needed.

## How to verify
- `.venv/bin/python -m pytest -q`: 106 passed (4 new tests for the table).
- Gates dry-run on real silver data (no table written yet): all 11 pass on 1,267 rows; the warning returns 0 rows.
- 13 corrupted copies each fired the gates they should: duplicate game (`key_not_unique`), dropped game (`row_count_differs_from_silver`), old-season row (`not_the_latest_season`), bad game type, wrong season label, home score +1, date moved a day, missing team code, team plays itself, final game losing a score, unplayed game with a winner, flipped `home_won`, a team twice on one date. A copy with unfinished games from Nov 2 fired the warning (15 rows).
- After merge and a job run, the real build result goes into this note.
- My first draft of two corrupted-copy tests was wrong (a `LIMIT` cut the whole union down to one row, so they never tested the key gate); caught and rewritten before the numbers above.

## Files added or changed
- `scripts/gold_game_slate.py`: the table (filter to the latest season, add `season_label`, rename `season_type` to `game_type`).
- `sql/gold/game_slate_gates.sql`, `sql/gold/game_slate_warnings.sql`: checks.
- `scripts/silver_build.py`: one line registering the table.
- `tests/test_gold_game_slate.py`: 4 tests. `docs/releases/048-game-slate.md`, `docs/NEXT.md`.

## Risks and things I am unsure about
- Dates are the schedule's date, not a tip-off moment; a late-night game belongs to the day the schedule gives it.
- The warning flags games not final more than a day behind the newest final one (postponed or late score); it shows nothing today.
- The all-star game has made-up teams, so it is excluded from the "team twice on one date" gate only.
- The table is rebuilt every job run; once the season turns over it switches to the new season by itself (highest `season` in silver).

## Review focus for Codex
The gate for final/unplayed consistency, the latest-season filter, and whether `game_type` values cover everything silver can hold.

## Open questions for the owner
- After merge: run the job to build the table. Then the grant on `game_slate` for the app identity (exact statement shown first, waits for your yes).

## Owner walkthrough
This adds one new table that lists every game of this season: the date, the two teams, the score once the game is over, and whether it has been played. It is the list the "Today's games" page will read. You will not see anything new in the app yet. Think of it as the schedule sheet the page will be drawn from. The checks make sure the list matches the official game table exactly, that no game is listed twice, that a finished game always has a score and a winner, and that a game not yet played has neither. After you merge, running the job builds it; then I will ask for permission to let the app read it.
