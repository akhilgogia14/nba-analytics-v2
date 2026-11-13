# Release 034: the fuller box score on the page

Date: 2026-11-13 (UTC)
Branch / PR: `feat/fuller-box-score-app` (PR number added after opening)
Author: (Claude Code)

## What changed
- The box-score table (the page's default view) now shows a full box score for each of the last 15 games: Date, Game (`vs`/`@`), **S** (marks a game he started), MIN, **FG**, **3P**, **FT** (made-attempted, like `12-23`), OREB, DREB, REB, AST, STL, BLK, TOV, PF, +/- (with its sign) and PTS.
- The bottom row is the average of those games for every column (makes and attempts averaged separately, such as `9.1-20.3`), and the S cell there counts how many of the games he started.
- The `/api/players/:id/log` route returns the 11 extra columns (`box`: started, fgm, fga, fg3a, ftm, fta, oreb, dreb, tov, pf, plusMinus) next to the six stats. The sparklines and the average cards use their own query and are unchanged.
- **No new grant:** the data is in `player_season_games`, which the app already reads (filled by the job run in release 033).

## Why
The owner asked for the fuller box score (field goals, free throws, turnovers, fouls, plus/minus) in the box-score view.

## How to verify
- `cd app && npm test`: **107 passed** (104 before; the log-query and mapper tests were rewritten for the new columns and the helper tests extended: made-attempted, signed plus/minus, the average row, starts). `npx tsc -b`, `npx oxlint`: clean.
- Whole page in a simulated browser against real data, **21 of 21** (the script is not in the repo): the column headings in order; the newest Brunson game reads `Nov 11 | vs CLE | S | 35 | 12-23 | 3-8 | 0-0 | 0 | 3 | 3 | 5 | 1 | 1 | 2 | 3 | -20 | 27`, equal to the route and to the table in Databricks; on all 15 rows OREB + DREB = REB and 2 x FG made + 3PM + FT made = PTS (read off the page); the S markers match the route; the first 10 games still average 26.5 points like the card; the switch and Playoffs still work.
- Through the route for Brunson, LeBron James and a bench player (regular season and playoffs): 0 violations of the two arithmetic rules.
- **Not done:** nobody has seen it in a real browser; the width on a phone is a guess (the table scrolls sideways).

## Files added or changed
- `app/server/queries.mjs`, `app/tests/queries.test.mjs`: the log query and mapper. `app/src/components/GameLog.tsx`, `app/src/lib/gamelog.ts`, `app/src/types.ts`, `app/src/api.ts`, `app/src/App.tsx`, `app/tests/gamelog.test.mjs`. `docs/NEXT.md`.

## Risks and things I am unsure about
- **A wide table.** 17 columns is a lot on a laptop and more on a phone; it scrolls sideways there. If it feels crowded, the first thing to trim is probably OREB and DREB (REB stays).
- A missing figure in the source shows as a dash and is skipped (not counted as 0) in the average.
- Games where he did not play are not in the table at all (it lists games played).

## Later
- Shooting percentages, a sticky date column on narrow screens, colouring plus/minus, remembering the chosen view.

## Review focus for Codex
- `mapGameLog` (column positions against `GAMELOG_SQL`) and that the first 12 columns equal the cards' query.

## Open questions for the owner
1. Is 17 columns too many? Which would you drop?

## Owner walkthrough
- **What you see:** the same Box scores table, now with a full box score on every row: shots made and tried (12-23 means 12 of 23), threes, free throws, rebounds split into offensive and defensive plus the total, assists, steals, blocks, turnovers, fouls, plus/minus (+5 means his team outscored the other team by 5 while he played) and points. An "S" at the start of a row means he started that game.
- **The bottom row** is the average of the 15 games, column by column. The number in the S column there is how many of the 15 he started.
- **Everything else is as before:** the Averages switch, Regular season / Playoffs, the meetings table.
- **What changed behind it:** the page now asks the database for 11 more numbers per game, which release 033 added and filled.
