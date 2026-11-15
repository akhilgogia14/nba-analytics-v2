# Release 051: gold `game_context` (rest, back-to-back, home/away for every game on the schedule)

Date: 2026-11-15
Branch / PR: feat/game-context
Author: (Claude Code)

## What changed
- New gold table `workspace.nba_v2_gold.game_context`: one row per team per game on the schedule, played or not, for six seasons (2021-22 to 2026-27). 15,610 rows (regular season 14,700, playoffs 844, play-in 60, NBA Cup 6).
- Per row, the situation before tip-off: `days_rest`, `is_b2b` (back-to-back), `games_in_4` and `games_in_6` (with `is_3_in_4` and `is_4_in_6`), `stint_game_number` (game N of a homestand or road trip), the opponent's rest (`opp_days_rest`) and `rest_edge` (this team's rest minus the opponent's).
- Written in PySpark (`scripts/gold_game_context.py`), registered in `scripts/silver_build.py`, so the daily Databricks job builds it after silver.
- 13 quality gates and 2 warnings in SQL. Nothing reads the table yet; the app needs its own SELECT grant (asked separately, exact statement first).

## Why
The schedule already tells us, before a game, whether a team is on a back-to-back, how rested it is and whether it is home or away. PLAN: context for the offense stats, with the app pointing at the next game (planned in `docs/NEXT.md` item 30).

## How to verify
- `.venv/bin/python -m pytest -q`: 114 passed (8 new, in `tests/test_gold_game_context.py`).
- Real data with Databricks Connect (nothing written; a temporary view in one session): 15,610 rows; all 13 gates return 0 bad rows.
- An independent plain-SQL version of the same logic (a different method for every column) gives the identical 15,610 rows: 0 rows only in one, 0 only in the other.
- 18 corrupted copies each fired the gates they should (duplicate row, dropped row, null team, bad game type, wrong season label, moved date, flipped home/away, rest +1, rest set on a season opener, negative rest, flipped back-to-back flag, stretch counts off, flipped 3-in-4 flag, stint number +1, opponent rest changed, rest edge changed, same team twice on a date). Every one of the 13 gates fired at least once.
- Both warnings tested: removing one game of a completed season warns for both teams; the long-gap warning fires on real data (see risks).
- Spread of `days_rest` in regular seasons: 0 days 2,563 games, 1 day 9,204, 2 days 2,080, 3 days 373, and a small tail up to 11; 7 and 8 days (144 and 39 games) are the All-Star break.

## Files added or changed
- `scripts/gold_game_context.py`: the table. `scripts/silver_build.py`: one line registering it.
- `sql/gold/game_context_gates.sql`, `sql/gold/game_context_warnings.sql`: the checks.
- `tests/test_gold_game_context.py`: 8 tests. `docs/releases/051-game-context.md`.

## Risks and things I am unsure about
- **The schedule hides some future games.** Silver leaves out games whose teams are not known yet. Today that is the NBA Cup knockout rounds (six placeholder games on Dec 4, 5 and 8). Result: 11 teams show 10 or 11 days of rest for games on Dec 12 to 14, which is wrong until the Cup teams are set. The long-gap warning flags exactly these rows (11 today). The app must not trust a rest figure of 8 or more days; the Advanced stats page words it as "a long break, or games missing from the schedule".
- Rest counts calendar days, not hours; travel and time zones are not in the data.
- Preseason and all-star games are left out of the schedule load on purpose.
- The first game of each season has no rest figure (empty), not a made-up number.
- The table is rebuilt on every job run and also changes when the schedule changes (a game moved), by design.

## Review focus for Codex
The date arithmetic (`days_rest`, the 4 and 6 night windows, and the season boundary), the stint logic, and whether the gates are independent enough of the PySpark code.

## Open questions for the owner
- After merge: run the job to build the table, then the SELECT grant for the app identity.

## Owner walkthrough
This adds one table that describes each team's situation before each game: how many days of rest it has, whether it is the second night of a back-to-back, whether it is home or away, whether it is the third game in four nights, how far into a road trip it is, and how rested the opponent is. It covers six seasons of history plus every game still to come this season, because the schedule is known in advance. You will not see anything new in the app from this alone. It is the foundation for the Advanced stats tab. The checks prove the table agrees with the schedule, that both teams of a game see the same situation from opposite sides, and that every number matches an independent calculation. One honest caveat: until the NBA Cup knockout teams are known, a few December games show too much rest, and a warning says so.
