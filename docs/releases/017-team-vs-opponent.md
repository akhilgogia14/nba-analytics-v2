# Release 017: gold `team_vs_opponent` (second of three new gold tables)

Date: 2026-11-13 (UTC; table first built 04:43 UTC)
Branch / PR: `feat/gold-team-vs-opponent`, PR (number added after opening)
Author: (Claude Code)

## What changed
- New gold table `workspace.nba_v2_gold.team_vs_opponent`: 51,984 rows. One row per team, opponent, scope, scope value and stat. All 870 team pairs (30 x 29) are present.
- Every row says which games it covers (the label you asked for: year and regular season or playoffs):
  - scope `all`: every game since Oct 2021.
  - scope `season`: one season, labelled like `2024-25`.
  - scope `game_type`: `regular-season` or `playoffs` (play-in and NBA Cup games count in `all` and `season` only).
- The same eight stats as `team_form`: points, rebounds, assists, 3-pointers, blocks, steals, points allowed, margin.
- Per row: games, wins, regular and playoff game counts, first and last date, mean, median, 10th and 90th percentile, lowest and highest.
- PySpark build (`scripts/gold_team_vs_opponent.py`), independent SQL gates (11), one warning, 7 tests. Added to the daily job.
- The app does not read it yet. That needs its own `SELECT` grant, which I will ask about when the page work starts.

## Why
PLAN.md step 7 and plan 13d: the Opponent dropdown and the team-level view need team-against-opponent numbers. Labelled groups and visible game counts keep small samples honest.

## Decisions made without the owner (please confirm or change)
- No year-by-game-type cross (for example "2024-25 playoffs"). Within a `season` row the counts of regular and playoff games show what it is made of.
- A `season` group contains every game type of that season (including play-in and Cup), as the counts reveal.
- The warning only flags a pair with no game in 400 days. Small groups are not warned about (there would be hundreds); the page must show the game count instead.

## How to verify
- `.venv/bin/python -m pytest -q`: 81 passed (7 new). Hand-worked values in a test: points 80, 90, 100, 110, 120 give mean 100, 10th percentile 84, 90th percentile 116; season, game-type and all-game groups each checked separately, and so is the latest team abbreviation.
- Dry run on real data through Databricks Connect: 51,984 rows, 870 pairs, all gates pass.
- 20 corrupted copies of the real output (wrong percentile, counts off by one, wrong label, dropped pair or group, duplicate row, null label, wins above games, ...) each fired the expected gate; the untouched output fires none.
- Spot check against raw `team_game`, New York vs Boston, all games: 28 games, 13 wins, points mean 109.571, allowed mean 112.714, margin mean -3.143, points median 108.5, 2021-10-20 to 2026-10-23 (identical in the table). Their 6 playoff games are all in 2024-25.
- Real job run (`databricks bundle deploy`, `databricks bundle run silver_build`): `gold team_vs_opponent` source rows 51,984, gates on source and table pass, inserted 51,984, updated 0, deleted 0, 0 oddities, `_build_log` run_id `2026-11-13T044300Z`. Other tables unchanged.

## Files added or changed
- `scripts/gold_team_vs_opponent.py` (new): the PySpark table; reuses the stat list and season label from `gold_team_form.py`.
- `sql/gold/team_vs_opponent_gates.sql` (new): 11 gates, an independent recompute with its own percentile formula.
- `sql/gold/team_vs_opponent_warnings.sql` (new): the stale-pair warning.
- `tests/test_gold_team_vs_opponent.py` (new): 7 tests.
- `scripts/silver_build.py`: one new entry in `TABLES`.
- `docs/NEXT.md`: step 13d-3 done.

## Risks and things I am unsure about
- Many groups are small (a playoff series is at most 7 games; the current season so far is 1 or 2). Percentiles on 1 to 3 games are not meaningful, and the page must show the game count with every figure.
- Opponent rows mix rosters and eras: a 2021 game counts the same as one from this week. The `season` scope is the answer to that.
- The warning has never fired on real data (nothing is stale yet).
- The deployed job files come from this branch; the next daily run deploys from `main` again, so until this PR is merged that run will not include this table.
- The gates join the full table with a full recompute; fine at this size.

## Review focus for Codex
- That the SQL gates are independent of the PySpark (tagging of scopes, percentile formula, tie-breaking for the latest abbreviation).
- Scope rules: play-in and Cup games only in `all` and `season`.
- NULL handling and row counts per group.

## Open questions for the owner
1. Is "no year-by-game-type cross" fine, or do you want rows like "2024-25 playoffs"?
2. OK to go on to `player_vs_opponent` (about 700,000 rows with the six headline stats)?

## Owner walkthrough
- **What changed:** one more table in Databricks, `team_vs_opponent`. The app page looks the same; nothing reads this table yet.
- **What it holds:** for every pair of teams (say New York against Boston), the same eight measures as the team table, but only for games between those two. Each figure comes in groups, and every group is labelled: all games ever, one season at a time (like 2024-25), regular-season games only, or playoff games only.
- **What to look at yourself:** in Databricks open `workspace.nba_v2_gold.team_vs_opponent` and filter `team_tricode = 'NYK'` and `opponent_tricode = 'BOS'` and `stat = 'pts'`. You should see 9 rows (all, six seasons, regular season, playoffs). The `all` row should say 28 games, 13 wins and a points average of 109.571.
- **Be careful reading it:** look at the `games` column first. A playoff group with 1 game, or this season with 1 game, tells you very little.
- **What the new files mean:** `gold_team_vs_opponent.py` is the recipe, `team_vs_opponent_gates.sql` is the second independent calculation that stops the build if the two disagree, `team_vs_opponent_warnings.sql` lists oddities that are not errors, `test_gold_team_vs_opponent.py` is the practice exam with hand-worked answers.
