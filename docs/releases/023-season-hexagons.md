# Release 023: the season hexagon chart on the player page

Date: 2026-11-13 (UTC)
Branch / PR: `feat/season-hexagons` (PR number added after opening). **Stacked on PR #30** (release 022, the table it reads): merge #30 first.
Author: (Claude Code)

## What changed
- New "Season" panel on the player page, between the scorecards and the combined-stats table. **One hexagon per team game, in date order (82 in a regular season).**
- A stat picker (Points, Rebounds, Assists, 3-pointers, Blocks, Steals) recolours the chart.
- **Played games** are coloured in five steps from the player's lowest to highest game of that stat, in the team's accent colour (key: "Less ... More"). **A bright border** marks a game where he reached his **season mean** (owner's choice, 2026-11-13) for that stat. **Games he missed** are dark grey. In a season in progress the **games not played yet** are dashed empty outlines up to 82.
- **Tooltip** (hover, keyboard focus, or tap): the value and opponent on top, the date, home or away and the season mean underneath, for example `8 REB ✓ · vs GSW` over `Oct 21 · home · season mean 7.5`; a missed game says `Did not play · @ LAC`.
- **Regular season / Playoffs switch** (shown when he has both). They are separate grids with separate averages; they are never blended.
- **Traded players** get one tab per team, most recent team first, and a note ("Also played for DET, WAS this season ..."). The season mean covers all the teams together.
- New server route `GET /api/players/:id/season` reading `workspace.nba_v2_gold.player_season_games` (the app identity's new `SELECT` grant). Bad id gives 400; a player with no games gives an empty list. A failure there shows a message in the panel only; the rest of the page keeps working.
- The latest season each player has games in (per game type) is shown, so a player with no playoffs this year shows his last playoff run, labelled with its season.

## Why
The owner asked for the chart in the style of the activity heatmap in the example dashboard: pick a stat, one hexagon per game of the season, colour by how many, a border when he beat his average, grey when he did not play, and a tooltip with the value and opponent.

## Decisions made without the owner (please confirm or change)
- Five colour steps, scaled to that player's own range for that stat and game type (so each chart shows his own highs and lows; the same colour is not the same number for two players).
- "Reached his mean" = at or above the season mean over the games he played.
- Games not played yet appear only for the regular season (a playoff run has no fixed length).
- A hexagon for a game he missed does not say why (injury, rest, trade); the data does not say on most rows.
- Play-in and NBA Cup games are not on the page (the table has them).

## How to verify
- `cd app && npm test`: **56 passed** (40 before). New: 12 tests for the hexagon maths and wording (hexagon positions and sizes for 82, corners, season mean and colour range, the five colour steps with hand-worked values, the border rule, the empty slots, the tooltip text, a traded player's shared mean) and 4 for the query and mapper (named parameter only, latest season looked up inside each game type, column order, a traded player's grids in the right order).
- `npx tsc -b`, `npx oxlint`, `npm run build`: clean.
- Real data through the app's own server running locally (read through the warehouse): Luka Doncic: 2026-27 regular season 13 team games, 11 played; 2024-25 playoffs 5 games, 5 played. Danilo Gallinari: 2023-24 three 82-game grids (MIL 17 played, DET 6, WAS 26) and a 6-game playoff grid with 3 played. Jalen Brunson: 11 of 11 this season; 2025-26 playoffs 19 of 19. Bad id: 400. Unknown player: `{"grids":[]}`.
- Simulated-browser check of the real component with that real data (30 of 30 passed; the script is not in the repo): 82 hexagons, 13 real games and 69 empty slots for Luka; 2 grey missed games and 11 coloured; 6 of his 11 games have the bright border, which is exactly the number at or above his points mean (38.64); hover, keyboard focus, Escape and tap-away behave; Rebounds recolours it and the tooltip says REB; Playoffs shows 5 hexagons and no empty slots; Gallinari shows tabs MIL, DET, WAS, the note, and a season mean over all three teams.
- **Not done:** nobody has seen it in a real browser (this session has none), and it is not deployed.

## Files added or changed
- `app/server/queries.mjs`, `app/server/index.mjs`: the season query, its row mapper, and the route.
- `app/src/lib/hex.ts` (new): hexagon geometry, colour steps, season mean, the border rule, empty slots, tooltip wording.
- `app/src/components/SeasonGrid.tsx` (new): the panel (picker, switches, tabs, chart, tooltip, key).
- `app/src/App.tsx`, `app/src/api.ts`, `app/src/types.ts`: load the season with the player and show the panel.
- `app/tests/hex.test.mjs` (new), `app/tests/queries.test.mjs`: the tests above.
- `docs/NEXT.md`: step 17.

## Risks and things I am unsure about
- **Never seen on a screen.** Colours, hexagon size (14 per row: about 25 pixels each on a 360-pixel phone, small to tap), the border thickness and the tooltip position are my best guess. You are the visual check; tell me what to change.
- A grey hexagon means "no minutes and no stats". For a traded player the games after he left a team are grey on that team's tab, the same as a game he sat out; the note says why.
- The chart colours depend on the player's own range, so a player with an even season (all 2 to 4 rebounds) still gets the full range of colours. The tooltip always has the real number.
- The page's player list only has players who played this season; a player with no games this season cannot be picked yet (listed as open in `docs/NEXT.md`).
- Answers are cached for five minutes in the server, as for the other routes; the table changes once a day.
- This branch contains PR #30's commits until #30 is merged.

## Review focus for Codex
- `SEASON_SQL`: the latest-season subquery per game type, the named parameter, the two game types only.
- That no code path combines regular-season and playoff games (grids are per game type; the mean and the colour range are computed per game type).
- `buildCells` and `hexTip`: missed games never show a value; a missing value is never drawn as a zero.
- Keyboard and screen-reader use of the hexagons (buttons with full-sentence labels).

## Open questions for the owner
1. After you look at it: hexagon size, colours, border, anything that feels off?
2. Deploy now (needs your "deploy"), or after more changes?
3. Next in the agreed order: the other dashboard pieces (stat cards with sparklines, range pills, last-10 games table) and `player_vs_opponent`. What first?

## Owner walkthrough
- **What you will see:** under the six range-bar cards there is a new panel called "Season". At the top, pills let you pick Points, Rebounds, Assists, 3-pointers, Blocks or Steals. Below is a honeycomb of small hexagons, one for every game your team plays in the season, left to right, top to bottom, in date order: 82 in a full regular season.
- **How to read it:** a coloured hexagon is a game the player played. The brighter it is, the more of that stat he had, compared with his own best and worst game. A hexagon with a bright white edge means he got at least as many as his season average that night. A dark grey hexagon is a game he did not play. A faint dashed outline is a game that has not happened yet.
- **Tooltip:** put the mouse over a hexagon (or tap it on a phone) and a small label shows the number and the opponent, for example "11 REB ✓ · vs BOS", with the date, home or away and his season average underneath.
- **Playoffs:** if the player has been in the playoffs, a second button switches to the playoff games. They are always shown separately from the regular season, as you asked.
- **Traded players:** a player who was on two or three teams in a season gets one button per team. Pick a team and you see all of that team's games, with the games he played for the other teams in grey, and a line saying which other teams he played for.
- **What each new file does:** `hex.ts` does the arithmetic (where each hexagon goes, which colour, whether it gets the border, the tooltip words); `SeasonGrid.tsx` draws it and handles the clicks; `queries.mjs` and `index.mjs` fetch the games from the new table; the two test files prove the arithmetic and the data handling on small made-up seasons.
- **What to check yourself:** after a deploy, open Luka Doncic (Lakers): the Season panel should show 13 coloured or grey hexagons and 69 dashed outlines (the games still to come), 11 of 13 played. Pick Rebounds and watch the colours change. Open Danilo Gallinari (2023-24) if he appears in a team list, or any player traded this season, to see the team buttons.
