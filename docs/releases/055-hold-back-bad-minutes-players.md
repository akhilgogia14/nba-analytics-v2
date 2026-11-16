# Release 055: hold back the same bad game from silver player_game

Date: 2026-11-16
Branch / PR: fix/hold-back-bad-minutes-players
Author: (Claude Code)

## What changed
- Silver `player_game` now leaves out the players of any game that silver `team_game` holds back (a game whose TEAM minutes are not a possible total, release 054). Both silver tables always hold back the same games.
- The `player_game` gate `dropped_vs_bronze` expects those rows to be missing. Nothing else changes; the warning that names the game stays in `team_game_warnings.sql`.

## Why
After release 054 the job (run 43789354894, 2026-11-16) passed all of silver, then stopped in gold at `player_season_games`: its gate `played_game_missing_from_table` found 19 players who played game 0022600231 in `player_game` but whose game is not in `team_game` (the game grid is built from `team_game`). Release 054 held the game back in one silver table only. Holding it back in both keeps every downstream table consistent.

## How to verify
- `.venv/bin/python -m pytest -q`: 123 passed (3 new in `tests/test_silver_player_game_hold_back.py`, including one that proves `player_game` and `team_game` hold back exactly the same games for four kinds of impossible minutes). With the old `player_game` SQL put back, 2 of the 3 fail.
- Real data, dry run (nothing written): bronze has 177,986 real player rows; the new select returns 177,960 (exactly the 26 rows of game 0022600231); all `player_game` gates pass; corrupted copies still fire (a dropped row, a duplicated row, points +1).
- After merge and a job run: the job should pass all the way through gold, including `player_season_games`, `game_slate` and `game_context`. Results to be added.

## Files added or changed
- `sql/silver/player_game.sql`, `sql/silver/player_game_gates.sql`.
- `tests/test_silver_player_game_hold_back.py`, `docs/releases/055-hold-back-bad-minutes-players.md`.

## Risks and things I am unsure about
- Until the source box score is corrected, the 26 player rows of that game are in bronze but not in silver or gold: the players' Nov 14 lines for that game do not show up (their other games are unaffected). They come in on the first build after the source changes.
- The failed run of 2026-11-16 02:12 UTC had already rebuilt the gold tables before `player_season_games` (`player_game_log`, `player_form`, `team_form`, `team_vs_opponent`) from the silver tables as they were then, including the held-back game's players in the player tables. The next successful run rebuilds them without it.
- The rule now lives in four places (two selects, two gates, three counting the warning). If the definition ever changes, change all of them (the new test fails if the two selects drift apart).

## Review focus for Codex
Whether any other silver or gold table reads bronze directly and would still see the held-back game.

## Open questions for the owner
- Same as release 054: should other single-game defects be held back, or keep stopping everything?

## Owner walkthrough
The first fix set one game aside in one table, but the next table down still expected that game's players to exist, so it stopped. This change sets the same game aside in the players table as well, so both tables always agree on which games exist. When Denver's missing minutes are fixed at the source, the game and its players come in together on the next run. Two small SQL files changed and one test file was added.
