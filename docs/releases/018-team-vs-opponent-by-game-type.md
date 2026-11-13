# Release 018: `team_vs_opponent` reworked so no row blends regular season and playoffs

Date: 2026-11-13 (UTC; table rebuilt 05:25 UTC)
Branch / PR: `feat/team-vs-opponent-by-type`, PR (number added after opening)
Author: (Claude Code)

## What changed
- Every row of `workspace.nba_v2_gold.team_vs_opponent` now covers exactly ONE game type: `regular-season`, `playoffs`, `play-in` or `nba-cup`. Nothing is averaged across types.
- The grouping columns are now `season_label` (one season such as `2024-25`, or `all` for all seasons) and `game_type`. The old `scope` and `scope_value` columns are gone, and so are the old "all games" rows that mixed types and the `regular_games` / `playoff_games` counts (every row is one type, so they are not needed).
- Key: team, opponent, season label, game type, stat. 47,232 rows (870 pairs). Groups by type: regular season 5,498, playoffs 280, play-in 114, NBA Cup 12.
- The SQL gates were reworked to match (11 gates; `labels_wrong` now checks the four game types and the season label form). Tests rewritten (81 pass).
- The table was dropped and rebuilt from `team_game` (the old columns could not be merged into). The app does not read this table, so nothing visible changed.

## Why
The owner's rule: a regular-season game and a playoff game must never be blended, because games change in the playoffs (the TJ Warren example: a huge 2020 playoff run that he never repeated). Release 017 only labelled the mix with counts; that was not enough.

## Decisions made without the owner (please confirm or change)
- Play-in and NBA Cup games are kept as their own game types, not dropped and not merged into another type.
- Within one season and type, the group is still all games of that team against that opponent.
- `team_form` and `player_form` (last 10 games) still blend types in the window and only count the non-regular games. Whether to split them is a separate decision.

## How to verify
- `.venv/bin/python -m pytest -q`: 81 passed. Hand-worked test: with five games (two 2025-26 regular season, one 2025-26 playoff, one 2026-27 regular season, one 2026-27 play-in), the all-seasons regular-season row has only the 3 regular-season games (points 100, 110, 120: mean 110, 10th percentile 102, 90th 118); the playoff and play-in games are separate rows.
- Real-data checks through Databricks Connect (nothing written): the new output of 47,232 rows passes all 11 gates; 21 deliberate breaks each fired the right gate, including playoffs folded into regular season (560 facts and 4,480 stats rows flagged), game types swapped, a typo'd game type, play-in left out, wrong counts, wrong percentiles, a dropped pair, a dropped group, a duplicate and a null label.
- Spot check, New York vs Boston, against raw `team_game`: all 7 season and game-type groups match exactly. For example 2024-25 playoffs: 6 games, 4 wins, points mean 105.667; 2024-25 regular season: 4 games, 0 wins, mean 108.75. All seasons: regular season 22 games, 9 wins; playoffs 6 games, 4 wins.
- Dropped the old table (51,984 rows, old columns) with the owner's approval, then `databricks bundle deploy` and `databricks bundle run silver_build`: `gold team_vs_opponent` source rows 47,232, gates on source and table pass, inserted 47,232, 0 oddities, `_build_log` run_id `2026-11-13T052506Z`.

## Files added or changed
- `scripts/gold_team_vs_opponent.py`: new grouping (every game counted under its own type, once for all seasons and once for its own season).
- `sql/gold/team_vs_opponent_gates.sql`, `team_vs_opponent_warnings.sql`: reworked to match.
- `tests/test_gold_team_vs_opponent.py`: rewritten.
- `scripts/silver_build.py`: new key for the table.
- `docs/NEXT.md`: step 13d-3 updated.

## Risks and things I am unsure about
- Many groups are small, especially playoffs (at most 7 games per series) and the current season. The page must show the game count with every figure.
- The workspace job files come from this branch; the next daily run deploys from `main`, so until this PR is merged that run still has the older table code and would try to merge the old shape into the new table. Please merge soon, or expect that run to fail on the table's columns (the fix is just to merge).
- Rosters and eras differ across seasons; a `season` row is the right place to look, the `all` row mixes eras.

## Review focus for Codex
- That no code path can put two game types in one row; the tag step and the gates' recompute.
- Season label form and the `all` rows.

## Open questions for the owner
1. Should `team_form` and `player_form` also be split by game type? (A last-10 window would then be "last 10 regular-season games" and "last 10 playoff games" as separate rows.)
2. OK to go on to `player_vs_opponent` built the same way (one game type per row)?

## Owner walkthrough
- **What changed:** the team-against-opponent table now keeps regular-season games and playoff games apart, always. There are no rows that average the two.
- **What to look at yourself:** open `workspace.nba_v2_gold.team_vs_opponent`, filter `team_tricode = 'NYK'`, `opponent_tricode = 'BOS'`, `stat = 'pts'`. You see one row per season and game type: for 2024-25 there are two rows, `playoffs` (6 games, 4 wins, average 105.667) and `regular-season` (4 games, 0 wins, average 108.75). Rows with `season_label = all` cover all seasons for one game type.
- **How to read it:** always look at `game_type` and `games`. A playoff row with 1 or 2 games is a very small sample.
- **What the files mean:** same as release 017. `gold_team_vs_opponent.py` is the recipe, the gates file is an independent second calculation that stops the build if they disagree, the test file is the hand-worked practice exam.
