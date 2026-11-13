# Release 027: a line under each scorecard (the last 10 games), and a "vs season avg" chip

Date: 2026-11-13 (UTC)
Branch / PR: `feat/sparklines` (PR number added after opening)
Author: (Claude Code)

## What changed
- **Each of the six scorecards now has a small glowing line chart** of the games behind it: one point per game of the window (up to 10, oldest on the left), a soft fill under the line, a **dashed line at the season average** and a dot on the latest game, in the team's colour.
- **Hover, keyboard focus or tap a point** for its value, opponent, date and home or away, for example `27 PTS · vs CLE` over `Nov 11 · home`.
- **A change chip** next to the average: `↑ 0.5 vs season avg` (green), `↓ 0.2 vs season avg` (red), or `level with season avg`. It is the card's own last-10 average minus its own season average, so it uses the numbers already on the card. In **Playoffs** mode there is no season average yet, so there is no chip and no dashed line.
- It follows the page's Regular season / Playoffs toggle and the team and player pickers.
- New server route `GET /api/players/:id/games?type=regular-season|playoffs` (anything else is a 400) returning the player's last 10 games played of that type, oldest first, from `player_season_games`.
- **No new grant was needed.** I first expected to need `SELECT` on `player_game_log`, but `player_season_games` (which the app already has) holds every game with the six stats, the opponent and the date.
- If the line's data cannot load, the cards still show without it (the line is an extra).

## Why
The owner asked for the dashboard feel of the example: stat cards with a small line chart. The range pills (5 / 10 / 20 / season) from my earlier proposal are **not** in this release; see "Later".

## How to verify
- `cd app && npm test`: **80 passed** (69 before; 11 new). New: the line geometry with hand-worked values (10, 20, 30 with a season average of 20 gives the points (8,48), (150,28), (292,8) and the dashed line at 28; a season average outside the values stays inside the box; all-equal values run flat through the middle; one game sits in the middle; a game with no figure is left out), the change chip (`26.5` vs `26.0` is `↑ 0.5`; `2.8` vs `2.636` is `↑ 0.2`; a difference under 0.05 is "level"; nothing without both numbers), the tooltip words, and for the server: the games query (named parameters only, one table, one game type by parameter, played games, newest first, `LIMIT 10`, column order) and the mapper (newest-first rows leave oldest first, numbers and booleans converted, a gap stays null).
- `npx tsc -b`, `npx oxlint`: clean.
- **The line equals the card.** For every player listed in both modes, the 10 games behind the line were compared with the card's own numbers from `player_form` (same number of games, same first and last date, and the average of each of the six stats within 0.0015). Result: **694 player-and-mode checks (464 regular season, 230 playoffs), 0 window-size mismatches, 0 other mismatches.**
- Whole page in a simulated browser against real data (16 of 16; the script is not in the repo): six lines on Brunson's page, 10 points each, the same 10 games the card header names; a chip on each card (`↑ 0.5 vs season avg` for points, which is 26.5 against 26.0); the dashed season line on every card; hover on the latest point shows `27 PTS · vs CLE`; focus and Escape work; Playoffs: the lines reload with the 10 playoff games (May 10 to Jun 13, 2026), no chip and no dashed line; back to Regular season: they return; a short window (Tarris Reed Jr., 8 games, points average 2.0) draws exactly 8 points.
- **Not done:** nobody has seen it in a real browser, and it is not deployed.

## Files added or changed
- `app/server/queries.mjs`, `app/server/index.mjs`: the games query, its mapper, the route.
- `app/src/lib/spark.ts` (new): the line geometry, the change chip, the tooltip words.
- `app/src/components/Sparkline.tsx` (new): the line, the fill, the dashed line, the dot and the hover points.
- `app/src/components/Scorecard.tsx`: shows the line and the chip. `app/src/App.tsx`, `app/src/api.ts`, `app/src/types.ts`: load the games with the player and game type.
- `app/tests/spark.test.mjs` (new), `app/tests/queries.test.mjs`: the tests above.
- `docs/NEXT.md`: step 21.

## Risks and things I am unsure about
- **Not seen on a screen.** The line's height, glow, colours and the chip's green and red are my best guess.
- The line shows the same 10 games as the card because both use the owner's "played" rule. The two sources (`player_form` and `player_season_games`) could in principle drift if a rule changed in one; the comparison above is the safeguard, and it is worth re-running after any change to either table.
- The local development server's borrowed login went stale once during the big comparison (HTTP 403); a restart fixed it. This is a laptop-only quirk (the deployed app uses its own identity).
- With fewer than two games in the window there is no line (one game is not a line).

## Later
- **Range pills (5 / 10 / 20 games / Season).** The card's numbers (average, median, ranges) come from `player_form`, which has only a 10-game window, so changing the window needs the gold table to compute 5 and 20 (and a season window) too. Not started.
- A last-10-games table (rows, like the example's sessions table) can reuse the same route.

## Review focus for Codex
- That the line and the card can never show different games (the query's `played` and ordering against `player_form`'s window).
- `sparkLayout`: the season average is always inside the box; gaps are dropped, not drawn as zero.

## Open questions for the owner
1. After you look: are the line, the chip colours and the dashed line what you pictured?
2. Next: range pills (needs gold columns), the last-10-games table, auto-deploy from GitHub, or `player_vs_opponent`?

## Owner walkthrough
- **What you will see:** under the big number on each of the six cards there is now a small line chart. Each point is one of the player's last 10 games, oldest on the left, newest on the right (marked with a dot). The faint dashed line across it is his season average, so you can see at a glance which recent games were above or below his normal level.
- **The little arrow:** next to the big number is a chip like "↑ 0.5 vs season avg". It means his last-10 average is 0.5 higher than his average over the whole season (green for up, red for down). "level with season avg" means within about 0.05.
- **Hover or tap a point** to see that game: the number, the opponent ("vs" for home, "@" for away), and the date.
- **Playoffs:** click Playoffs and each card shows a line of his last 10 playoff games. There is no arrow and no dashed line there, because no playoff games have been played yet this season, so there is no season average to compare with.
- **What each new file does:** `spark.ts` works out where each point goes and what the chip and pop-up say; `Sparkline.tsx` draws the line; the new server route fetches the 10 games.
- **What to check yourself:** after a deploy, open Jalen Brunson (Knicks): points should show "↑ 0.5 vs season avg" and a line of 10 points ending with a dot at his latest game (27 points against Cleveland on Nov 11). Hover the dot to see it.
