# Release 079: Click a Defense row to see the players behind it

Date: 2026-11-20
Branch / PR: feat/defense-drilldown
Author: (Claude Code)

## What changed (owner request: "click on things and explore what the data means")
- **Every row in "Defense by position" is now a button.** Click one, for example "Bench · G", and it opens a list of every opposing player-game that went into that row: the player (his name links to his page), the game (date, his team home or away), minutes and the stat the page is showing (points, rebounds, assists, 3-pointers, blocks or steals), biggest first. A line says how many player-games from how many players, and the stat's total.
- **No minimum.** Every group opens, including the small groups in the fold-out and a group with one player-game. A group nobody has played says so. The 10-player-game bar still decides only which groups appear in the main ranked list (the owner chose "show everything in the drill-down").
- **The stat switch re-sorts the open list** without another request. One row is open at a time.
- **Phone:** the game and minutes sit under the player's name so the stat stays on screen; the laptop shows Player, Game, Min and the stat as columns.
- **Server:** one new read-only route, `GET /api/teams/:team/defense/players?type=` (`DEFENSE_PLAYERS_SQL` in `app/server/defenseQueries.mjs`). It reads the same three gold tables as the grid, with the same defended games, starter/bench rule and position labels, and returns one row per opposing player per game. No new table, grant or data change. The page fetches it the first time a row is opened (one request covers all groups).
- Files: `app/server/defenseQueries.mjs`, `app/server/index.mjs`, `app/src/api.ts`, `app/src/types.ts` (`DefenseLine`), `app/src/lib/defense.ts` (`linesForGroup`, `groupSummary`), `app/src/components/DefenseGrid.tsx`, `app/src/TeamsAdvancedPage.tsx` (passes team and game type), tests in `defense.test.mjs` and `defenseQueries.test.mjs`.

## How to retract
One self-contained PR: click **Revert** on the merged PR, or ask Claude to `git revert` the merge commit. The grid from release 078 comes back unchanged.

## How to verify
- tsc, oxlint, build clean; 233 tests pass (four new: the players SQL has named parameters only, the same tables and no limit; the row mapper; the group listing keeps small and empty groups; the group summary).
- Real data (Charlotte, 14 games): the route returns 159 player-games. For all 16 groups, the line count equals the grid's "player-games" and the points divided by 14 equals the grid's per-game figure; all lines together give 110.43 points per game, the headline 110.4.
- Simulated browser, 8 checks: rows are closed buttons; opening Bench · G lists 39 player-games from 34 players (284 points) sorted biggest first; names link to player pages; switching to Rebounds re-sorts; an empty group says nobody has played; a small group with 7 player-games lists them; clicking the open row closes it.
- Phone and laptop screenshots looked at; two layout fixes made (stat column pushed off the phone screen; header alignment).

## Risks
- The player link uses the team he played for in that game; a player traded since opens on that team's page.
- The route returns the team's whole newest season (about 160 rows at 14 games, around 1,700 at a full season), which is small, cached five minutes.
- The panel can be long (39 rows for Bench · G). It is not paged.

## Owner walkthrough
Open Teams, Advanced stats, scroll to "Defense by position" and click any row, such as "Bench · G +5.6". A list opens under it: every opposing player who played in that group against this team, the game, minutes and points, highest first. The total at the top of the list is what the row's per-game figure is built from. Click a name to open that player's page. Switch to Rebounds and the same list re-sorts by rebounds. Open "Show 12 small groups" and click any of them, even one with a single player-game. Click the row again to close it.
