# Release 012: gold `player_form`, the first PySpark table

Date: 2026-11-12
Branch / PR: `feat/player-form-pyspark` (PR number added when opened)
Author: (Claude Code)

## What changed
- New gold table `workspace.nba_v2_gold.player_form`, written in PySpark (`scripts/gold_player_form.py`): one row per player per stat (long format), key `(person_id, stat)`, 11,924 rows = 1,084 players x 11 stats (pts, reb, ast, pra, pr, pa, ra, fg3m, blk, stl, minutes). All players with at least one played game are in, including the 622 who have not played this season.
- Per row: the last-10 window (games in it, first date, how many are from before the current season, how many are not regular season), mean, median, 10th and 90th percentile (exact, linear interpolation), min and max; for 3PM, BLK and STL the share of games at 0, 1, 2 and 3+; season-to-date games and mean; the player's latest name and team and `last_game_date` / `last_season_label` (absolute dates, so a stale row can be told from a fresh one without rewriting rows every day).
- The build script supports "Python tables": an entry with `"python": "<module>"` takes its rows from `build(spark)` in `scripts/<module>.py`. It becomes a temporary view and the rest of the build (gates, MERGE, change feed, run log, oddities) is unchanged. The command line skips such a table (it needs Spark); the Databricks job builds it.
- Gates stay SQL: `sql/gold/player_form_gates.sql` (10 gates) recompute everything from `player_game_log` with their own percentile formula; `player_form_warnings.sql` logs windows that span more than a year.
- Housekeeping: `.venv` is now Python 3.12.15 (the old 3.9 one is `.venv39`); `pyspark==3.5.9` pinned in `requirements-dev.txt` for local tests; the job runs on serverless environment version 3 (was 2); `.gitignore` covers all `.venv*/` folders; `CLAUDE.md` Python line updated.

## Why
PLAN.md core screen: the range for each stat and the 0/1/2/3+ bars for small counts, with sample size and window labels. The owner also wanted to try PySpark in the Databricks workflow (decision 2026-11-12: trial on this table).

## Decisions (owner, 2026-11-12)
- Trial of PySpark for `player_form`. After the trial: new gold tables continue in PySpark; silver and the existing SQL gold table stay SQL.
- All players with any stats; long format.

## How to verify
- Local: `.venv/bin/python -m pytest -q` 67 passed (59 earlier + 8 new Spark tests with hand-worked values: a 12-game player across two seasons gives p10 3.9, median 7.5, p90 11.1, 2 games from before the season, 2 not regular; shares 0.4 / 0.2 / 0.1 / 0.3). Five deliberate breaks of the PySpark code were each caught.
- Real data, read-only through Databricks Connect, before any write: 11,924 source rows, all 10 gates pass. Eight corruptions of the output were each caught by the right gate (9-game window, wrong quantiles, a count stat missed, a stat missing, season mean + 1, earlier-season label + 1, stale last date, one player dropped).
- Job, first run (3 min 49 s, environment version 3): all five tables built, `player_form` created with 11,924 rows, gates pass on the table, 60 oddities logged. Second run (2 min 47 s): `inserted 0, updated 0, deleted 0` for all five tables. `_build_log` shows `player_form` versions None to 1, then 1 to 2.
- Hand check against raw rows (Jalen Brunson, last 10 games): points mean 25.9, median 23.5, p10 19.0, p90 33.5; 3PM share at 0 is 0.1 and at 3+ is 0.5; minutes mean 33.476; window start 2026-10-20. Stored values are identical.
- 622 players have a window made entirely of games from before this season (1,084 minus the 462 who have played in 2026-27); their rows say so through `l10_games_before_current_season`, `last_game_date` and `last_season_label`.

## Files added or changed
- `scripts/gold_player_form.py`: the PySpark transform (`transform` is pure DataFrame code; `build(spark)` reads the log).
- `sql/gold/player_form_gates.sql`, `player_form_warnings.sql`.
- `scripts/silver_build.py`: Python-table support; `tests/test_gold_player_form.py`, `tests/conftest.py` (Spark fixture), `tests/test_silver_build.py` (file check for Python tables).
- `databricks.yml` (environment version 3), `requirements-dev.txt`, `.gitignore`, `CLAUDE.md`, `docs/NEXT.md`, this note.

## Trial notes: SQL versus PySpark on this table (for the owner's decision)
- Easier in PySpark: one block in a loop covers all 11 stats, with the count-stat extras added for three of them. Adding a stat is one name in a list.
- Harder or slower: the independent SQL gates for the same logic needed a 65-line unpivot (`stack`) and a hand-written percentile; local tests need a Spark session (the test run went from 0.3 s to about 15 s); a dry run on real data needs Databricks Connect in a separate environment; two setup snags (Spark workers using the wrong Python; Connect needing a `pyarrow` pin).
- Same speed: both are Spark. The job took 2 min 47 s for five tables, against 2 min 36 s for four before.

## Risks and things I am unsure about
- Local tests run Spark 3.5.9; Databricks serverless reports Spark 4.2 (ANSI mode on by default). The tests set ANSI on, but a behaviour difference could still appear only in the job.
- Percentiles use linear interpolation on the sorted window (so p10 of 10 games sits between the first and second value). Some tools use "nearest rank" and would show different numbers; the app should say which.
- `l10_games_before_current_season` is relative to the latest season in the data, so when the first game of a new season is played, that column changes for most players once (about 12,000 rows updated that day, not deleted).
- 440 players last played before 2025-26, so their rows are old; the app must filter on `last_game_date` or `last_season_label`.
- 197 players have fewer than 10 games ever, so their windows are short; `l10_games` says how short.
- Count-stat shares over 10 games are noisy (steps of 0.1); the app shows the sample size next to them.
- The 60 "window spans over a year" oddities include people returning from long absences; some may be data gaps rather than injuries (not checked).
- Databricks Connect is not part of the repo; its environment is in a scratch folder and needs `databricks-connect==16.4.2` plus `pyarrow==17.0.0`.

## Review focus for Codex
The window and ranking logic in `transform`, the percentile call, the label arithmetic (earlier-season relative to the latest season), and whether the SQL gates really share nothing with the PySpark code.

## Open questions for the owner
Both answered 2026-11-12: new gold tables are written in PySpark (existing SQL tables stay as they are), and `.venv39` and `.venv312` were removed from disk (both git-ignored, 43 MB and 377 MB).

## Owner walkthrough
- **What this does:** it adds a summary table with one line per player per statistic, for example "Jalen Brunson, points". The line tells you his average, his middle value and the range his points fell in over his last 10 games (the 10th to 90th percentile, the middle 80% of games), plus how many games that covers and where they came from. For three-pointers, blocks and steals it gives the share of games with 0, 1, 2, or 3 or more, because a range doesn't make sense for small counts.
- **Why every player is in:** a star returning from injury has a line before his first game back. The `last_game_date` column shows how old the line is, so the app can grey it out.
- **What you would see:** in Databricks, `workspace.nba_v2_gold.player_form` with 11,924 rows. It updates after silver in the daily job.
- **What is new under the hood:** this is the first table written in PySpark (Python code on the Spark engine) instead of a SQL file. It does the same kind of work. The checks are still SQL and recompute the answers a different way, so one mistake can't hide in both.
- **What to check yourself:** `SELECT stat, l10_games, l10_mean, l10_median, l10_p10, l10_p90, l10_share_0, l10_share_3plus FROM workspace.nba_v2_gold.player_form WHERE player_name LIKE '%Brunson%' ORDER BY stat`.
