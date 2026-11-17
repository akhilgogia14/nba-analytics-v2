# Release 061: Advanced stats tab on the Players page

Date: 2026-11-16
Branch / PR: feat/players-advanced
Author: (Claude Code)

## What changed
- The Players page now has two tabs, Overview and Advanced stats (`#/players/advanced?team=NYK&player=1628973`), like the Teams page. The Overview page is unchanged apart from the two buttons.
- The Advanced tab picks a team, a player and a game type, then shows the player's team's next game (the same plain-words facts as on Teams) and four comparisons: home vs away, back-to-back vs rested, 2+ days of rest vs 1 day, more vs less rested than the opponent. Each has seven stats (points, rebounds, assists, 3-pointers, blocks, steals, minutes) and a last row, "Share of team games played".
- League columns are "vs own average": each played game's stat minus that player's own season average (same season and game type), averaged over every player and every season on record (player-seasons with at least 20 games played). The player columns are his own averages this season, with the number of games played in each column heading, plus "played N of M" for the team's games in that situation.
- No new table and no new grant. A new route `/api/players/:id/context` joins `player_season_games` and `game_context` per request (both already readable by the app); the situation rules are the same code as the Teams tab (`BUCKETS_SQL`, now exported).
- Same minimum as Teams: a player's own figure shows from 1 game played; a situation with no games played says "no games yet".

## Why
Plan item 30, step 5. The owner approved the design and the "vs own average" league columns (2026-11-16): a plain league average would mislead because stars are more likely to sit a back-to-back, so who plays changes the average; measuring each player against himself removes that.

## How to verify
- `npx tsc -b`, `npx oxlint`: clean. `npm test`: 173 passed (9 new in `tests/playerContext.test.mjs`: parameters only, same tables and no new one, same buckets, played-games-only averaging, own-average rule and the 20-game minimum, mapping, difference rule, availability text, the new address, league number format).
- Real data, read-only. Player query (Jalen Brunson, 2026-27): 13 of 13 team games played; back-to-back 2 of 2 (32.5 points, 35.1 minutes); home 24.9 vs away 28.8 points. League query: 9 situations, all-games row is exactly 0.00 on every stat as it must be. An independently written query (own averages in a separate CTE, no window functions, no bucket explode) gave the same numbers: back-to-back 21,656 played, 36,760 scheduled, +0.27 points, +0.58 minutes; home +0.05; away -0.05; 2+ days -0.13; rest edge + -0.06.
- Simulated browser through a local server on real data: 15 of 15 checks pass (tabs on both pages, the address carries team and player, next-game facts, four panels with seven stats and the games-played row, column headings show games played, signed two-decimal league numbers, choosing another player, Playoffs mode, the Teams Advanced tab still works).
- After merge the deploy run is checked before saying it is live.

## Files added or changed
- Server: `app/server/playerContextQueries.mjs` (new), `app/server/index.mjs`, `app/server/contextQueries.mjs` (one export).
- App: `app/src/PlayersAdvancedPage.tsx` (new), `app/src/lib/playerContext.ts` (new), `app/src/components/TeamTabs.tsx`, `app/src/lib/pages.ts`, `app/src/lib/context.ts` (`difference` made generic), `app/src/Root.tsx`, `app/src/App.tsx` (the two buttons), `app/src/api.ts`, `app/src/types.ts`.
- Tests and docs: `app/tests/playerContext.test.mjs`, `app/tests/context.test.mjs`, `docs/NEXT.md`, this note.

## Risks and things I am unsure about
- Not seen in a real browser (only a simulated one); the table is wide (7 columns) and scrolls sideways on a phone.
- The league effect for players is small: for example, a second-night back-to-back is +0.27 points and +0.58 minutes over a player's own average, and players played 58.9% of team games on back-to-backs vs 59.6% rested. A positive back-to-back figure is probably partly who is healthy enough to play that night (a selection effect), not evidence that back-to-backs help; the page note says to read it as context. I did not run the half-season stability check for player splits; given the team result (release 052), a single player's own split should be treated as even less reliable.
- "Share of team games played" counts every team game in the grid, including games a traded player's team played before he arrived and games missed to injury or rest. The note says so. The player route uses the newest season of the game type across the league, so a player who did not play this season shows "nothing to split".
- The league query reads about 210,000 grid rows and took about 2 seconds; both results are cached for 5 minutes like the Teams tab.

## Review focus for Codex
The window-function own-average in `LEAGUE_PLAYER_CONTEXT_SQL` (partition per person, season and game type, and the 20-game filter), and whether a duplicate grid row per player and game could ever double a game (the grid's gates say the key is unique).

## Open questions for the owner
- Do you want the same stability check for player splits (first half of a season vs the second) before leaning on the player columns?
- Does the Players overview need the player carried when you click Overview from the Advanced tab? Right now it carries the team only (the overview picks the first player in the list).

## Owner walkthrough
On the Players page there are now two small buttons under the header: Overview and Advanced stats. Overview is the page you know. Advanced stats opens a new view for the same team and player. At the top it names the player and describes his team's next game in plain words ("Away at Toronto, game 3 of a road trip, 1 day of rest..."). Below are four tables, each comparing two situations: home against away, a back-to-back against rested, two or more days of rest against one, and more rested against less rested than the opponent. Each table lists seven stats. The left half is the league: for every player in the league over five seasons, how much a stat moves away from that player's own average in that situation, so a small plus or minus. The right half, in grey, is this player's own averages this season, with the number of games they are based on in the heading. The last row of each table says how many of his team's games he actually played in that situation, for example "2 of 2". It cannot tell you what he will do next; it shows how his games have gone.
