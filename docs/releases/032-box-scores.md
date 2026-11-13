# Release 032: box scores by default, with a switch to the average cards

Date: 2026-11-13 (UTC)
Branch / PR: `feat/box-scores` (PR number added after opening)
Author: (Claude Code)

## What changed
- **The page now opens on a box-score table** instead of the six KPI cards: the player's last 15 games played, newest first, whatever the opponent. Columns: date, game (`vs`/`@` opponent), MIN, PTS, REB, AST, 3PM, BLK, STL, and an "Average of these 15" row at the bottom.
- **A "Box scores | Averages" switch** (two pills, like the Regular season / Playoffs ones) sits above it. "Averages" shows the six cards with their sparklines and legend exactly as before.
- It follows the page's Regular season / Playoffs toggle (never mixed). A game from an earlier season shows its year, and the sentence above the table names both seasons when the 15 games span two.
- New server route `GET /api/players/:id/log?type=` (last 15 games played, newest first; a bad type is a 400). It reads `player_season_games`: **no new table, no new grant.**

## Why
The owner asked to see the last 10 to 15 games, any opponent, when the page loads, with a way to switch to the KPI boxes.

## How to verify
- `cd app && npm test`: **104 passed** (99 before the new box-score tests; 5 new in `gamelog.test.mjs` and 2 in `queries.test.mjs`). `npx tsc -b`, `npx oxlint`: clean.
- Whole page in a simulated browser against real data, **15 of 15** (the script is not in the repo): the table is the default; 15 rows plus the average row; no cards on load; the first row equals the route's newest game (Nov 11, vs CLE, 27 points); the average row is the mean of the 15 games (points 25.8); switching to Averages shows the six cards and sparklines and hides the table; the first 10 box-score games average to the card (26.5 = 26.5); back to Box scores works; Playoffs switches the table to playoff games and keeps Box scores selected.
- **Not done:** nobody has seen it in a real browser; not deployed (merging deploys it, see release 031).

## Files added or changed
- `app/server/queries.mjs`, `app/server/index.mjs`: the 15-game query (the same query as the sparklines' with a longer window), its mapper, the route.
- `app/src/components/GameLog.tsx` (new), `app/src/lib/gamelog.ts` (new): the table, the average row, the sentence.
- `app/src/App.tsx`, `app/src/api.ts`: the switch (default Box scores), the fetch, hiding the cards and legend in the box-score view.
- `app/tests/gamelog.test.mjs` (new), `app/tests/queries.test.mjs`, `docs/NEXT.md`.

## Risks and things I am unsure about
- **Only six stats plus minutes.** A fuller box score (field goals, free throws, turnovers, fouls, plus/minus) needs `player_game_log` and a new SELECT grant for the app; not done.
- A swipe gesture was mentioned; this is a switch only.
- Which view is chosen is not remembered when the page is reloaded (it always opens on Box scores).
- Unseen on a real screen: column widths on a phone (the table scrolls sideways if it is too wide).

## Later
- Fuller box score (needs a grant). Remember the chosen view. A "show 10 / 15" choice.

## Review focus for Codex
- `GAMELOG_SQL` (the same text as the sparklines' query but for the limit) and that the table's first 10 games are the same games the cards describe.

## Open questions for the owner
1. Is 15 the right number, and are six stats enough for now, or do you want the fuller box score?

## Owner walkthrough
- **What you see on load:** below the player's name there are two pills, "Box scores" (selected) and "Averages". Under them is a table: one row per game, newest at the top. Each row shows the date, who the game was against (`vs` = home, `@` = away), the minutes, and his points, rebounds, assists, threes, blocks and steals. The bottom row is the average of those 15 games.
- **To see the cards:** click "Averages". The six big-number cards with the little lines come back, as they were.
- **Regular season or playoffs:** the page's other toggle switches the table between the two. They never mix.
- **If a player's 15 games reach back into last season,** those rows show the year and the sentence above the table says so.
- **What each new file does:** `GameLog.tsx` draws the table; `gamelog.ts` works out the average row and the sentence; the changes in `queries.mjs` and `index.mjs` fetch the 15 games.
