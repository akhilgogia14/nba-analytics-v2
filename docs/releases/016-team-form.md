# Release 016: gold `team_form` (first of three new gold tables)

Date: 2026-11-13 (UTC; table first built 03:03 UTC)
Branch / PR: `feat/gold-team-form`, PR #23
Author: (Claude Code)

## What changed
- New gold table `workspace.nba_v2_gold.team_form`: one row per team per stat, 240 rows (30 teams x 8 stats). Stats: points, rebounds, assists, 3-pointers made, blocks, steals, points allowed (what the opponent scored) and margin (points minus points allowed).
- For each row: the last-10-games window (average, median, 10th and 90th percentile, lowest, highest), the season average, and labels saying what the window is made of (how many games, first date, how many are from before this season, how many are not regular season, how many were wins).
- Written in PySpark (`scripts/gold_team_form.py`), as agreed. Its quality checks are separate SQL that recomputes the answer from `team_game` with its own percentile formula, so one mistake cannot be repeated in both places.
- Added to the daily job (`TABLES` in `scripts/silver_build.py`), so it refreshes every day after silver.
- The app does not read it yet. That needs a new `SELECT` grant for the app identity, which I will ask about one grant at a time when the page work starts.

## Why
PLAN.md step 7 and the 13d plan: the team-level view and the Opponent dropdown need team numbers first. This is the simplest of the three new tables, so it goes first. `team_vs_opponent` and `player_vs_opponent` follow, one PR each, with the opponent figures labelled by year and by regular season or playoffs.

## Decisions made without the owner (please confirm or change)
- A team's last 10 games cross into earlier seasons when the season is young, with the labels above (same rule as `player_form`).
- "Margin" and "allowed" are included as stats because a team scorecard needs defence as well as offence.
- Teams are only kept if they have at least one game; all 30 do.

## How to verify
- `.venv/bin/python -m pytest -q`: 74 passed (7 new for this table). Hand-worked values checked in a test: a 12-game team gives points mean 107.5, 10th percentile 103.9, median 107.5, 90th percentile 111.1; allowed mean 97.5; margin always 10; 5 wins; 2 games from before the season; 2 not regular season; season mean 108.5. Six deliberate breaks of a scratch copy of the code (9-game window, wins inverted, margin reversed, allowed = own points, 80th instead of 90th percentile, season mean over all seasons) were each caught by a test.
- Dry run on real data through Databricks Connect: 240 source rows, all 10 gates pass. New York example: last 10 games 6 wins, points mean 111.3, allowed 103.2, margin 8.1, 11 games this season.
- Corrupted copies of the real output (15 cases, from a 9-game window and wrong percentiles to a dropped team, a duplicated row, a null key and a stale date) each fired the expected gate; the untouched output fires none.
- Real job run (`databricks bundle deploy`, `databricks bundle run silver_build`, SUCCESS, about 4 minutes): `gold team_form` source rows 240, gates on source and on table all pass, inserted 240, updated 0, deleted 0, 0 new oddities, `_build_log` run_id `2026-11-13T030312Z`. The other five tables in the job changed nothing.

## Files added or changed
- `scripts/gold_team_form.py` (new): the PySpark table (`transform` is pure and unit-tested, `build` reads `team_game`).
- `sql/gold/team_form_gates.sql` (new): 10 gates, an independent recompute.
- `sql/gold/team_form_warnings.sql` (new): flags a team with no game in 30 days (fires for every team in the offseason, which is expected).
- `tests/test_gold_team_form.py` (new): 7 tests.
- `scripts/silver_build.py`: one new entry in `TABLES`.
- `docs/NEXT.md`: step 13d split into its parts.

## Risks and things I am unsure about
- The no-game warning has only run on in-season data, so it has never fired for real. It is simple SQL, but untested on real data.
- The gates read `team_game` in full and sort each team's 10 games; fine at 13,550 rows, worth a look if the data grows a lot.
- Percentiles are rounded to 3 decimals; the gates allow 0.0015 of difference for that rounding.
- Window labels do not say whether a team played a back-to-back or had rest; not included yet.
- The workspace job files were deployed from this branch; the next daily run deploys from `main` again. Until this PR is merged that run will not include `team_form`, and the table will simply stay as built.

## Review focus for Codex
- That the SQL gates really are independent of the PySpark (percentile formula, window ordering, tie-breaking on `game_id`).
- Season rules: latest season taken from the data (2027 = 2026-27), teams with no game this season.
- NULL handling for `season_mean` and the label counts.

## Open questions for the owner
1. Are these eight stats right for a team card, or do you want others (for example field-goal percentage)?
2. OK to go straight on to `team_vs_opponent` next?

## Owner walkthrough
- **What changed:** there is one new table in Databricks, `team_form`, in the gold schema. Nothing on the app page looks different yet.
- **What it holds:** for every NBA team, a short summary of its last 10 games on eight measures: points scored, rebounds, assists, 3-pointers, blocks, steals, points allowed and margin of victory. Think of it as the team version of the player cards. For each measure you get the average, the middle game, a typical-worst and typical-best game, the lowest and highest, and the average for this season.
- **Labels:** each row also says how many games the window really has, the first date, how many wins, and how many of those games came from last season or were playoffs or other special games. Early in a season the last 10 games can reach back into last season, and the labels say so.
- **What to look at yourself:** in Databricks, open `workspace.nba_v2_gold.team_form` and filter `team_tricode = 'NYK'`. You should see 8 rows. Pick `pts`: the last-10 average should be 111.3 and the wins 6 as of the 2026-11-13 build.
- **What the new files mean:** `gold_team_form.py` is the recipe that builds the table. `team_form_gates.sql` is a second, independent calculation that checks the recipe's answers every day and stops the build if they disagree. `team_form_warnings.sql` lists things that are odd but not wrong. `test_gold_team_form.py` is the practice exam for the recipe, with answers worked out by hand.
