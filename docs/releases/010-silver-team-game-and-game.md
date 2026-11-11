# Release 010: silver `team_game` and `game`

Date: 2026-11-11
Branch / PR: `feat/silver-team-game` (PR number added when opened)
Author: (Claude Code)

## What changed
- New silver table `workspace.nba_v2_silver.team_game`: one row per team per game, key `(game_id, team_id)`, 13,530 rows. Date and season type from the schedule; opponent and opponent points from the opponent's own box-score row; team minutes, overtime periods, `won`, and the main stats.
- New silver table `workspace.nba_v2_silver.game`: one row per game, key `game_id`, 8,250 rows, from the schedule. Includes `is_final`, `home_won`, `has_box_score`, and `result_from_box_score` (see below).
- Both are built by `scripts/silver_build.py` (gates, MERGE, change feed, run log, oddities) and, with `player_game`, by the daily Databricks job; no workflow change was needed.
- `scripts/silver_build.py`: the table list now has three tables; `change_examples` takes the key columns (it had `game_id, person_id` fixed).
- `databricks.yml`: the upload now also excludes `*.log`, `summary.txt` and `payload.json`.

## Why
PLAN.md step 4: clean the core tables into silver. Gold tables (peer cohorts, distributions) will read these three.

## What the data showed (read-only profile before building)
- Team rows: 13,532 in bronze, of which 2 are the team 0 placeholder (game 0062600001); 13,530 real rows, exactly 2 per game, home and away. Team points equal the schedule's scores for all games that have a result. Team minutes are 240:00 plus 25:00 per overtime (0, 1, 2 or 3 overtimes occur: 12,852 / 602 / 72 / 4 team rows).
- The schedule has 7 placeholder games (team 0, no names): 6 TBD December regular-season games and the cup final. They are left out of `game` and appear when the teams are known (the same rule as the spike: ignore team 0).
- The schedule file lags the box scores. It was last changed 2026-11-10 14:30 and has results through 11-08, while box scores run through 11-10. 14 games (11-09 and 11-10) have a box score but no schedule result. In `game` their score comes from the box score and `result_from_box_score` is true.
- Preseason (420) and all-star (25) games have results but no box score; they include international clubs and all-star squads. They are kept in `game` with `has_box_score = false`.

## How to verify
- Dry run, then `--execute` on a laptop: `game` 8,250 rows, `team_game` 13,530 rows, all gates pass on the source and on the table; a second run: `inserted 0, updated 0, deleted 0` for all three tables.
- Cross-checks read from Databricks: team points equal the sum of player points in every team-game (0 mismatches); all 6,765 games with box scores have two `team_game` rows and the same scores as `game` (0 mismatches); every `player_game` game exists in `game`.
- Warnings: `_data_warnings` has 14 `result_from_box_score_schedule_lagging` rows for `game` (with examples, such as 0022600203 ATL vs LAL 114 to 124), none for `team_game`.
- Gates on corrupted copies of the SELECTs (queries only, tables untouched): points +1 in `team_game` failed 4 gates; a dropped team failed 2; broken minutes parsing failed the overtime gate; `game` with points +1 failed 2; a dropped season failed 2; placeholder rows kept failed 2. A first overtime test was aimed at a column no gate reads, so it passed wrongly; I redid it properly.
- A bug found and fixed on the way: the `ORDER BY` in `change_examples` was not an f-string, so it would have sent literal braces to Databricks. A new test checks the generated SQL for one- and two-column keys, and fails if the bug returns.
- The job, run after deploy: `TERMINATED SUCCESS`, all three tables, 0 changes, gates pass.
- `.venv/bin/python -m pytest -q`: 57 passed.

## Files added or changed
- `sql/silver/team_game.sql`, `team_game_gates.sql`, `team_game_warnings.sql`: the table, 11 gates, one warning (four or more overtimes; none today).
- `sql/silver/game.sql`, `game_gates.sql`, `game_warnings.sql`: the table, 11 gates, two warnings (lagging schedule; a past game with no result).
- `scripts/silver_build.py`, `tests/test_silver_build.py`: table list, key-aware change examples, new test.
- `databricks.yml`: more upload excludes.
- `docs/NEXT.md`, `docs/releases/010-silver-team-game-and-game.md`.

## Risks and things I am unsure about
- **Stray files in the workspace (my mistake, fixed).** Release 009's deploy had no exclude for the daily workflow's log files, so the CI deploy uploaded them into the bundle folder in your workspace. My local deploy then reported "4 deleted"; I believe those were the four log files (`tier1.log`, `tier2.log`, `bronze.log`, `silver.log`) but cannot list them now. They held sync output, not credentials (R2 and Databricks secrets are never printed). Logs are now excluded from the upload.
- `game` takes scores from the box score while the schedule lags. When the schedule file catches up, `result_from_box_score` flips to false and the row updates (I expect the first real "updated" rows in the run log then; not yet seen). If the schedule and the box score ever disagreed, the gate `schedule_points_differ_from_box_score` stops the build.
- Preseason and all-star games sit in `game` with international and all-star teams; anything that counts teams must filter by `season_type` or `has_box_score`.
- `team_game` uses team city plus name for `team_name` ("LA Clippers" style); not checked for every team.
- The gate `plus_minus_not_margin` assumes the source's team plus-minus equals the point margin; it holds for all 13,530 rows today.
- A game postponed after being scheduled keeps its row until the source changes it.

## Review focus for Codex
The self-join on the opponent in `team_game.sql` (two sides, team 0 excluded), the `coalesce` of schedule and box-score scores in `game.sql`, the minutes and overtime arithmetic (14400 and 1500 seconds), and what the gates do not cover (a game missing from both box-score files).

## Open questions for the owner
1. Is it fine that `game` fills a missing schedule result from the box score (flagged, with a warning per game)? The alternative is to leave those scores empty until the schedule file updates.
2. Keep preseason and all-star games in `game`? (Default: yes, with `has_box_score = false`.)

## Owner walkthrough
- **What this does:** it adds two more clean tables. One has a row for every team in every game (who they played, whether they won, overtime, points and the main stats). The other has a row for every game on the schedule, with the final score, who won, and whether we have a box score for it.
- **The late schedule:** the data source updates its schedule file a day or two after the games. So for the last 14 games the clean table takes the score from the box score and marks it. A list of those games is in the warnings table, and it will update by itself when the schedule catches up.
- **What you would see:** in Databricks, `workspace.nba_v2_silver.team_game` (13,530 rows), `game` (8,250) and the earlier `player_game`. They are rebuilt together after each daily data load.
- **What to check yourself:** `SELECT game_date, team_tricode, opponent_tricode, pts, opp_pts, won FROM workspace.nba_v2_silver.team_game ORDER BY game_date DESC LIMIT 10`, and `SELECT * FROM workspace.nba_v2_silver._data_warnings WHERE table_name = 'game'`.
