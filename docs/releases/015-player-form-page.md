# Release 015: the Player form page (first real screen)

Date: 2026-11-13 (UTC; deployed at 01:53 UTC)
Branch / PR: `feat/player-form-page`, PR #22
Author: (Claude Code)

## What changed
- The app now shows the first real screen, built from the "Scorecards" mock-up the owner chose: a Team dropdown, then a Player dropdown (most minutes first), then six scorecards (points, rebounds, assists, 3-pointers, blocks, steals) and a table of combined stats and minutes.
- Each scorecard shows the last-10 average, the median, a range bar (middle 80% of games as a band, lowest to highest as a thin line) and the season average. 3-pointers, blocks and steals also show the share of games with 0, 1, 2 and 3+.
- Warnings in amber for: fewer than 10 games on record, games in the window from before this season, games that are not regular season, and a player who has not played for more than 7 days.
- Four colour themes (Paper is the default, plus Midnight, Graphite, Aurora). The choice is remembered in the viewer's browser only.
- Three new server endpoints, all reading only `player_form`: `GET /api/teams`, `GET /api/teams/:team/players`, `GET /api/players/:id/form`. Inputs are checked (team = three capital letters, player id = digits) and passed to SQL as named parameters. Answers are cached for 5 minutes.
- Deployed to the Databricks App `nba-player-form` (same link as release 014). No new grants were needed.

## Why
PLAN.md step 6 (simple visuals from gold) and the owner's decision to build the Scorecards design. The page needs only the existing gold table `player_form`, so no new table was added.

## Decisions made without the owner (please confirm or change)
- Default theme: Paper (the owner called the current colours "okay").
- Team-level and opponent views are NOT in this release. They need new gold tables (team form, player vs opponent) and move to the next step.
- Auto-deploy from GitHub was not tried; the deploy is still a manual upload.

## How to verify
- `cd app && npm test`: 13 passed (6 server tests: input checks, SQL uses named parameters, row mapping; 7 page-logic tests: bar geometry worked by hand for Brunson's points, a stat that goes below zero, all zeros, share labels, dates, team names). Three deliberate breaks of the server code (a looser team check, a value glued into the SQL text, the median read from the mean's column) were each caught by the matching test.
- `npm run build`: type-check plus bundle in 62 ms, 236 kB JavaScript (74 kB gzipped). `npm run lint`: no warnings.
- Server-side render of the real components with live API data, 6 of 6 checks passed (Brunson's points card: 26.5, median 25.5, middle 80% 19.0 to 33.5, low 19.0, high 38.0, season avg 26.0; his 3-pointer shares include `1 · 20%` and `3+ · 60%`; the combined table shows 34.8 for points + rebounds + assists; Koa Peat's all-zero steals show `0 · 100%`; a missing stat shows a message; the first paint shows both dropdowns and all four themes).
- Local server on real data: `/api/teams` returned 30 teams (464 current-season players); `/api/teams/NYK/players` returned 16 players, Brunson first; `/api/players/1628973/form` matched the mock-up and the earlier hand check.
- Live app after the deploy (CLI token, deployment `SUCCEEDED`, build 23 s, security scan no findings): same answers as local for all three endpoints; `/api/teams/nyk/players`, `/api/teams/NYK' OR 1=1/players` and `/api/players/abc/form` returned HTTP 400; `/api/players/999999999/form` returned 404; `/` served the built page (title "Player form"); without a token every request returns 401.

## Files added or changed
- `app/server/queries.mjs` (new): the three fixed SQL statements, input checks, row mapping.
- `app/server/index.mjs`, `app/server/databricks.mjs`: new routes with a 5-minute cache; SQL parameters supported.
- `app/src/App.tsx`: the page and its state (team, player, theme, loading and error handling).
- `app/src/components/Scorecard.tsx`, `CombosTable.tsx`: the card and the table.
- `app/src/lib/geom.ts` (bar maths, share labels), `format.ts` (dates, team names, labels), `themes.ts` (the four palettes), `styles.ts`.
- `app/src/api.ts`, `app/src/types.ts`: calls to the server and the shapes of the data.
- `app/index.html`, `app/src/index.css`: page title, fonts, global styles.
- `app/tests/queries.test.mjs`, `app/tests/geom.test.mjs`, `app/package.json` (`npm test`): the tests.
- `docs/NEXT.md`: step 13c done, 13d added.

## Risks and things I am unsure about
- **I have not seen the page.** I could not open a browser. The tests, the build and a server-side render of the real components with live data pass, but the dropdown behaviour in a browser, the spacing, colours, fonts and the phone layout are unchecked. The owner's first look is the real test.
- The page loads fonts (Inter, Sora, Fraunces) from Google Fonts in the viewer's browser. If blocked, it falls back to system fonts.
- The player list only includes players who played in the current season (464 of 1,084). Everyone else is not selectable.
- "Current season" is the newest season label in `player_form`. After the offseason starts the list stays on the last season until a new season's first game is played.
- Early in a season the last-10 window reaches into last season; the page says so, and the numbers still mix seasons.
- The 5-minute cache is per app instance and is lost on restart. The gold tables change once a day, so staleness is at most a few minutes after a daily update.
- The app still stops about 24 hours after a start or redeploy (Free Edition). Deployed at 01:53 UTC on 2026-11-13, so expect it to stop around 01:53 UTC on 2026-11-14. Restart: `databricks apps start nba-player-form`.
- The deployed code is a manual copy of this branch's `app/` folder. It is not updated automatically by merging.
- Accessibility was written in (labels on dropdowns, buttons for themes, text alternatives for the bars) but not tested with a screen reader or colour-contrast tool; the Midnight, Graphite and Aurora palettes were chosen by eye.

## Review focus for Codex
- `app/server/queries.mjs` and `index.mjs`: that no user input reaches the SQL text, error messages shown to the browser, and the cache.
- `app/src/lib/geom.ts`: bar positions for edge cases (all zeros, negative values, a single game).
- That nothing secret is in the repo or in the logs.

## Open questions for the owner
1. After looking at the page: what should change first (layout, sizes, wording, theme)?
2. Next build: team form and player vs opponent gold tables (to bring back the Opponent dropdown and the team-level view), or more polish on this page first?
3. Should 622 players who have not played this season be reachable too (for example a "show all players" option)?
4. Do you want auto-deploy from GitHub tried, so merging updates the app?

## Owner walkthrough
- **What changed:** the app is no longer a single line of text. Open the link (https://nba-player-form-7474644725065164.aws.databricksapps.com, sign in to Databricks when asked) and you see a page called "Player form".
- **What you see:** at the top, two dropdowns. First pick a team (New York is chosen at the start), then a player (the one who plays the most minutes is chosen for you). Below that, the player's name, the dates of the last 10 games, and six cards.
- **How to read a card:** the big number is the average over the last 10 games. The bar underneath shows how spread out the games were: the shaded band is where the middle 80% of games fell, the thin line runs from the worst game to the best game, the tick is the middle game, and the dot is the average. For 3-pointers, blocks and steals there is also a coloured strip saying how often the player had none, one, two, or three or more.
- **The amber notes** appear only when something needs care: a player with few games, games that come from last season, games that are not regular season, or a player who has not played for over a week.
- **The Theme buttons** at the top right change the colours. Paper is plain and light, Midnight is dark blue with a glow, Graphite is dark with gold, Aurora is light with a purple tint. Your choice is remembered on that browser.
- **What the new files are:** `App.tsx` is the page itself. `Scorecard.tsx` draws one card, and `CombosTable.tsx` draws the table at the bottom. `geom.ts` does the maths that places the dot and band on the bar (and has tests). `themes.ts` has the four colour sets. `queries.mjs` is the list of three questions the website is allowed to ask the database, with checks so nobody can slip anything else in.
- **What is not here yet:** the Opponent dropdown and the team-level view from the mock-up. They need new tables first.
- **What to check yourself:** pick a few teams and players. Try the four themes. Look at it on your phone. Open Koa Peat on Phoenix (few games, a warning should show) and Jokić on Denver. Tell me anything that looks wrong or feels off, in your own words.
