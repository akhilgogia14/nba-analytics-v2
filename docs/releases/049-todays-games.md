# Release 049: Today's games page

Date: 2026-11-14
Branch / PR: feat/today-page
Author: (Claude Code)

## What changed
- A third page, **Today's games** (`#/today`), reached from a third button next to Players and Teams. Teams stays the page that opens first.
- It lists the games on one day (today in US Eastern time to start): both teams with their logos, the score once the game is final (the loser dimmed), or "Not played yet".
- Arrows move one day back or forward; "Back to today" appears when you have moved. The same Regular season / Playoffs buttons as the other pages (never mixed).
- Each team in a game is a link to its Teams page, with a **Team** and a **Players** button that open that team's Teams page or Players page (the team carries across, as in release 046).
- New route `/api/games?date=YYYY-MM-DD&type=regular-season|playoffs` reading gold `game_slate` (release 048). A bad date or type gets a 400 before it reaches SQL.

## Why
The owner asked for a landing view of the day's games with a quick way into each team (release 046 plan). The data comes from `game_slate`, built and granted in release 048.

## How to verify
- `npx tsc -b`, `npx oxlint`, `npm test` (146 passed: 136 before, 10 new), `npm run build`: all clean.
- Real data through a local server (read-only, token not printed): Nov 13 has 9 games, all final; Nov 14 has 5, none final; Nov 15 has 9, none final; playoffs on Nov 15 is empty; bad date (`2026-02-30`), missing date and bad type give HTTP 400.
- Simulated-browser run (jsdom, 15 checks, all passed): `#/today` opens the page; Today shows the 5 games not yet played; Previous day shows Yesterday with 9 final games and both scores, the loser dimmed; Next day twice shows Tomorrow with 9 games to come; Playoffs shows "No playoff games on ..." and Regular season brings the games back; "Back to today" returns; a team link opens its Teams page, the Players button opens the Player page on that team; an empty address still opens Teams.
- Not seen in a real browser by anyone yet.

## Files added or changed
- `app/server/slateQueries.mjs`: the fixed SQL, date check and row mapping. `app/server/index.mjs`: the `/api/games` route.
- `app/src/TodayPage.tsx`: the page. `app/src/lib/slate.ts`: Eastern date, day arithmetic, headings, status and winner.
- `app/src/lib/pages.ts`, `Root.tsx`, `components/PageSwitch.tsx`: the third page and button. `api.ts`, `types.ts`: the new call and type.
- `app/tests/slate.test.mjs`: 10 tests. `docs/releases/049-todays-games.md`, `docs/NEXT.md`.

## Risks and things I am unsure about
- "Today" uses the US Eastern calendar date. A game that ends after midnight Eastern is still listed on the schedule's date, and the page shows it on that date.
- The schedule's data has no tip-off times, so games are in game-id order, not time order.
- Preseason games (67 in the table) are not offered; the page has only Regular season and Playoffs, so a preseason day shows "No regular-season games".
- The 5-minute answer cache means a score can show up to 5 minutes after the daily job lands it.
- The Regular season / Playoffs choice is not shared between pages (decided as a default; easy to change).
- Not looked at in a real browser; phone width is untested apart from the layout rules (cards stack in one column below the medium breakpoint).

## Review focus for Codex
The date validation (server and client), the Eastern-time "today", the SQL parameters, and the page's loading and error states.

## Open questions for the owner
- Should the Regular season / Playoffs choice carry between pages?
- Should the page open on Today's games (replacing Teams as the first page)?

## Owner walkthrough
There is a new button, "Today's games", next to Players and Teams. It opens a page with a card for each game on the chosen day. Each card has the away team on top and the home team below, with the score once the game is over, and "Not played yet" before that. Use the arrows to look at yesterday or tomorrow, and "Back to today" to jump back. Click a team's name or logo to open that team's page, or use the small Team and Players buttons next to each team. Nothing here is stored or changed in your data: the page only reads the schedule table built last time. Please look at it on your phone and tell me what feels off. New files: `TodayPage.tsx` is the page, `slate.ts` holds the date helpers, and `slateQueries.mjs` is the one question the server asks the database.
