# Release 080: Click a hexagon to open that game

Date: 2026-11-20
Branch / PR: feat/hex-click
Author: (Claude Code)

## What changed (owner request: "click on most things and explore what the data means")
- **Clicking a hexagon on the season chart opens that game under the chart:** the date, home or away and opponent, the team's final score with W or L (and overtimes), whether he started or came off the bench, and his full line as 12 small tiles (minutes, points, rebounds, assists, 3-pointers, field goals, free throws, steals, blocks, turnovers, fouls, plus/minus). The line above the tiles says how far the chosen stat was above or below his season average. The clicked hexagon is outlined. **Close** (or choosing another hexagon) clears it.
- **A game he missed** says "Did not play" and still shows the team's result. **A game not yet played** shows its date and home or away.
- **"See all his games against X"** inside the panel opens his page following that opponent (the opponent filter from release 074/075), so the cards, hexagons and Predictions switch to X.
- Hover still shows the quick bubble; a click replaces it with the panel (so the bubble no longer clips at the left edge on a phone). Keyboard: Enter or Space opens the game.
- **Server:** one new read-only route, `GET /api/players/:id/game/:gameId` (`GAME_DETAIL_SQL`, `mapGameDetail`, `validGameId` in `app/server/queries.mjs`). It reads his row in `player_season_games` (the same 23 columns as the Box scores table, mapped by the same function) and joins the team's score from `team_game_log` on the game and the team he played for. Bad ids are refused (400), no row is a 404. No new table, grant or data change; fetched on click only and cached five minutes.
- Files: `app/server/queries.mjs`, `app/server/index.mjs`, `app/src/api.ts`, `app/src/types.ts` (`GameDetail`, `GameResult`), `app/src/lib/gameDetail.ts` (`resultText`, `detailTiles`, `againstAverage`), `app/src/components/SeasonGrid.tsx` (the panel), `app/src/components/KpiTiles.tsx` (optional narrower tile width), `app/src/App.tsx` (passes the player id), `app/tests/gameDetail.test.mjs`.

## How to retract
One self-contained PR: click **Revert** on the merged PR, or ask Claude to `git revert` the merge commit. The chart goes back to hover-only bubbles.

## How to verify
- tsc, oxlint, build clean; 240 tests pass (seven new: game-id check, the SQL, the row mapper for played, missed and no-result games, result text, the 12 tiles, the comparison with the season average).
- Real data (Brandon Miller and Naz Reid, Charlotte): the route's points equal the chart's for the played game; the box shows 36 minutes, 18 points, 7-21 shooting, started; the result 110-103 equals the sum of the 10 Charlotte players' points (110) and the 10 Brooklyn players' points (103) in that game, from an independent query. A missed game returns `played: false` with the result; a bad id gives 400 and an unknown game 404.
- Simulated browser, 7 checks: no panel before a click; a played game shows date, opponent, W 110-103, "Started", the 12 tiles and the average line; the clicked hexagon is marked; the link carries `team`, `player` and `opp=BKN`; a missed game and a scheduled game open their own versions; Close clears it.
- Phone and laptop screenshots looked at; three phone fixes made (bubble clipped at the left edge, tiles three to a row, shooting splits no longer wrap).

## Risks
- A player who changed teams: the result is joined on the team he played for in that game, so it is that team's score.
- If the team game log has no row for a game, the panel shows his line with no result rather than wrong numbers.
- Tile values no longer wrap anywhere `KpiTiles` is used (other tiles are short numbers, so no visible change expected).

## Owner walkthrough
Open Players, pick a player, and scroll to the season chart. Click any hexagon: a panel opens underneath with that night's game, the final score, and his whole stat line. The line above the tiles tells you whether the chosen stat (for example points) was above or below his season average. Click a hexagon he missed and it says he did not play; click an empty one in the future and it shows the scheduled game. Under the panel, "See all his games against X" jumps to that opponent, so the rest of the page lines up with it. Press Close to put the panel away.
