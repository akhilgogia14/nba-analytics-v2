# Release 035: box-score table without OREB and DREB

Date: 2026-11-13 (UTC)
Branch / PR: `feat/drop-oreb-dreb` (PR number added after opening)
Author: (Claude Code)

## What changed
- The Box scores table no longer shows the offensive and defensive rebound columns (OREB, DREB), nor their averages. REB (total rebounds) stays. The table is now 15 columns: Date, Game, S, MIN, FG, 3P, FT, REB, AST, STL, BLK, TOV, PF, +/-, PTS.
- Nothing else changed: the data (gold table and the `/log` route) still carries `oreb` and `dreb`, so the columns can come back without a data change.

## Why
The owner asked to drop them to make the table narrower (release 034 asked whether 17 columns were too many).

## How to verify
- `cd app && npm test`: **107 passed** (one assertion added: the average row has no OREB or DREB). `npx tsc -b`, `npx oxlint`: clean.
- Whole page in a simulated browser against real data, **21 of 21**: the headings read `Date Game S MIN FG 3P FT REB AST STL BLK TOV PF +/- PTS`; the newest Brunson game is `Nov 11 | vs CLE | S | 35 | 12-23 | 3-8 | 0-0 | 3 | 5 | 1 | 1 | 2 | 3 | -20 | 27`; OREB and DREB appear nowhere on the page; points still equal 2 x FG made + 3PM + FT made on all 15 rows; the first 10 games still average 26.5 points like the card.
- **Not done:** nobody has seen it in a real browser.

## Files changed
- `app/src/components/GameLog.tsx`, `app/src/lib/gamelog.ts`, `app/tests/gamelog.test.mjs`, `docs/NEXT.md` (not touched), this note.

## Risks and things I am unsure about
- A viewer can no longer see the offensive/defensive split in the table, though REB is the sum of the two in the data.

## Owner walkthrough
- **What you will see:** the same Box scores table with two fewer columns, so it is a little narrower. Rebounds appear as one column, REB.
- **What did not change:** everything else (the S marker, shooting splits, the average row, the Averages switch, the meetings table).
