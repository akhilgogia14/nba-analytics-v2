# Release 011: first gold table, `player_game_log`

Date: 2026-11-11
Branch / PR: `feat/gold-player-game-log` (PR number added when opened)
Author: (Claude Code)

## What changed
- New schema `workspace.nba_v2_gold` and table `player_game_log`: one row per played player-game, key `(game_id, person_id)`, 144,599 rows. It has the stats (PTS, REB, AST, 3PM, BLK, STL, TOV), minutes, the combos (PTS+REB+AST, PTS+REB, PTS+AST, REB+AST), and each player's averages over their previous 10 played games and over the earlier games of the same season. The current game is never in its own window.
- Labels the owner asked for: `season_label` (such as `2026-27`), `is_regular_season` (false for play-in, playoffs and cup), `prior_l10_games_earlier_season` (how many of the 10 window games come from an earlier season) and `prior_l10_games_not_regular` (how many are not regular-season games).
- `scripts/silver_build.py` now works on layers: each table names its layer; its SQL is in `sql/<layer>/`; the table and its own run log and oddities table live in that layer's schema (`nba_v2_gold._build_log`, `_data_warnings`). Silver tables are always built before gold.
- The Databricks job (`jobs/silver_build_task.py`) builds silver then gold. A failed silver gate stops the run before gold. No workflow change was needed.
- Files: `sql/gold/player_game_log.sql`, `player_game_log_gates.sql`, `player_game_log_warnings.sql`.

## Why
PLAN.md core screen: pick a player, see the typical range per stat. This table is the per-game log behind the dots, and its "prior" columns are leak-proof inputs for the back-test (Phase 7). No blend weight is chosen here: both averages are stored and the back-test decides.

## Decisions (owner, 2026-11-11)
- Count all played games (regular season, play-in, playoffs, cup), and label the ones that are not regular season. Preseason has no box scores, so none exist.
- Let a last-10 window reach into an earlier season when a player has fewer than 10 games this season, and label how many games came from earlier seasons.

## How to verify
- Dry run: 144,599 source rows (the earlier 144,458 plus the 141 players who played 2026-11-10), all gates pass.
- `--execute` on a laptop (45 s): 144,599 rows created, gates on the table pass, 5 oddities logged. Second run (25 s): `inserted 0, updated 0, deleted 0`.
- The 5 oddities are the player-games over 55 minutes: four Toronto players in the 2022-01-29 triple-overtime game and one Knicks player on 2023-03-05 (55.1 to 56.5 minutes).
- Gates fire on corrupted copies of the SELECT (queries only, tables untouched): a 10-game window that includes the current game failed 3 gates; a window one game short failed 134,826 rows; a stats mix-up (reb average built from assists) failed 140,635 rows; a season window that ignored the season failed 3 gates; dropping short-minute games failed 3; a wrong earlier-season label failed 20,810; an inverted regular-season flag failed 144,599. The averages and the two labels are checked against a second, independent computation (a self-join on game numbers, not a window frame) for all 7 stats.
- By hand against silver (one player, latest game): window of 10 games, average 23.8 points, 2 games from earlier seasons; season to date 8 games, 22.875. Gold shows the same numbers. Some players' third game of 2026-27 shows a window with 8 games from last season.
- Job run after deploy: `TERMINATED SUCCESS` in 2 min 36 s for all four tables (three silver, one gold), 0 changes, all gates pass. The 2026-11-11 22:41 UTC scheduled run (first with all three silver tables) also succeeded, with 0 changes because the source had nothing new.
- `.venv/bin/python -m pytest -q`: 59 passed (2 new: layers and ordering).

## Files added or changed
- `sql/gold/*`: the table, 15 gates, 1 warning.
- `scripts/silver_build.py`: layers, schema per layer, build order.
- `jobs/silver_build_task.py`: passes the SQL root; error message names the layer.
- `tests/test_silver_build.py`, `docs/NEXT.md`, this note.

## Risks and things I am unsure about
- "Last 10 games" counts played games only, so a player back from a long injury has a window that reaches months back. The table does not yet say how old the window is. A column for days since the previous game and the window's first date would show it (open question below).
- Labels are about the window's games, not about the current season, so they never change after a game is written (a season-relative flag would rewrite every row each October).
- Garbage-time games stay in. 16% of played rows are under 10 minutes; minutes are in every row. Whether to drop them should come from a back-test study.
- The gates recompute the averages twice per build, which adds time. The whole job takes 2.6 minutes today; if it grows, the recompute can run on a sample.
- A corrected historical box score changes the priors of that player's later rows, so many rows of one player can update at once. That is expected; the run log shows it.
- The player name is the latest spelling (6 players have variants such as `Jr` and `Jr.`), so a name change updates all of that player's rows.
- Early season players with no games yet have NULL priors, by design.

## Review focus for Codex
The window frames (`10 PRECEDING AND 1 PRECEDING`, `UNBOUNDED PRECEDING AND 1 PRECEDING`), the ordering tie-break (`game_date, game_id`), the earlier-season arithmetic (`prior_l10_games - least(prior_season_games, prior_l10_games)`), and what the recompute gates do not cover.

## Open questions for the owner
1. Add `days_since_prior_game` and the date of the window's first game to the log, so a stale window is visible? (My suggestion: yes, in the next step; it is a context column, not a prediction input.)

## Owner walkthrough
- **What this does:** it adds a new layer of tables called gold, built for the app. The first one is a log with one row for every game a player played. Next to each game's stats it shows what that player had averaged in his previous 10 games and so far that season, as it stood before that game. It also tells you how many of those 10 games were from an earlier season or were playoff, play-in or cup games.
- **Why "before that game":** so we can later test honestly how well simple averages predict a night's stats. A game never counts in its own average.
- **What you would see:** in Databricks, `workspace.nba_v2_gold.player_game_log` with 144,599 rows. It updates by itself after silver, in the same daily job.
- **What to check yourself:** `SELECT game_date, pts, prior_l10_pts, prior_l10_games_earlier_season, season_label FROM workspace.nba_v2_gold.player_game_log WHERE player_name LIKE '%Brunson%' ORDER BY game_date DESC LIMIT 10`.
