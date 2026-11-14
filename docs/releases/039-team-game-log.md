# Release 039: gold `team_game_log`

Date: 2026-11-14 (UTC)
Branch / PR: `feat/team-game-log` (PR number added after opening)
Author: (Claude Code)

## What changed
- A new gold table, **`workspace.nba_v2_gold.team_game_log`** (PySpark, `scripts/gold_team_game_log.py`): one row per team per game played, key `(team_id, game_id)`. Expected size: **13,550 rows** (6,775 games x 2 teams, seasons 2021-22 to 2026-27, newest game 2026-11-11).
- Columns: the game (date, season and `season_label`, `game_type`, opponent, home or away), the result (`won`, `pts`, `opp_pts`, `margin`, `overtime_periods`) and the team box score (`fgm`, `fga`, `fg3m`, `fg3a`, `ftm`, `fta`, `oreb`, `dreb`, `reb`, `ast`, `stl`, `blk`, `tov`, `pf`). Percentages are not stored; the page works them out.
- Every game type is kept (regular season, playoffs, play-in, NBA Cup) in `game_type`; the app will always filter to one type, so they are never mixed.
- It is registered in `scripts/silver_build.py` and so is built by the existing daily job after silver, with the same MERGE, gates, run log and delete guard as the other gold tables.

## Why
Release 037, step 3: the Teams page needs a team box-score table (last 15 games) and a way to list a team's games against one opponent. It reads this table, so no `team_vs_opponent` grant is needed.

## How to verify
- `.venv/bin/python -m pytest tests -q`: **102 passed** (99 before; 3 new: one row per team per game with result and box score, the exact column list and order, and the registration).
- The 10 gates were run **read-only against real silver** through a SQL copy of what the table will hold (the table does not exist yet): all 10 return 0 bad rows (key unique and not null, row count equals silver, game types and season labels valid, every value equals silver, margin and win agree with the score, every game is mirrored by its opponent's row with the opposite result, no empty box-score value, and the box-score arithmetic holds: makes never above attempts, threes part of field goals, OREB + DREB = REB, points = 2 x FG + 3PM + FT). The warning query runs and returns no rows.
- **Not done yet:** the real job run (creates the table; I will ask first), the corrupted-copy checks on the real output, the app route and the SELECT grant.

## Files added or changed
- `scripts/gold_team_game_log.py`: the table. `scripts/silver_build.py`: registers it. `sql/gold/team_game_log_gates.sql`, `sql/gold/team_game_log_warnings.sql`: checks. `tests/test_gold_team_game_log.py`: tests. `docs/NEXT.md`.

## Risks and things I am unsure about
- The first job run **creates** the table (`CREATE TABLE IF NOT EXISTS`, then inserts 13,550 rows). Nothing existing changes. If the daily sync runs before the owner's yes it would create it too, which is harmless.
- The table only has games through silver's newest date (2026-11-11 today) until the source publishes again.
- `margin = 0` cannot happen (the silver gate `tied_games` already guarantees it); the new gate repeats that so it cannot slip in.

## Review focus for Codex
(Only if the owner asks.) That the gates do not reuse the PySpark code, and the mirror gate.

## Open questions for the owner
None. The SELECT grant for the app identity will be asked for later, with the exact statement, when the app page is built.

## Owner walkthrough
- **What changed:** behind the scenes only; nothing on the page. There is one new table that lists every team game as a row: who played, home or away, the score, and the team's shots, rebounds, assists, turnovers and fouls.
- **What the checks do:** they re-add the numbers the way a scorer would (points = twos x 2 + threes + free throws; rebounds = offensive + defensive) and check every game appears twice, once per team, with opposite results. They all agree on all 13,550 real rows.
- **What to check yourself:** nothing yet. After the job run I will show you one real game (both teams) next to what you remember.
