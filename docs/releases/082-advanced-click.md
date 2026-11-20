# Release 082: Click an Advanced stats tile or table to see what is behind it

Date: 2026-11-20
Branch / PR: feat/advanced-click
Author: (Claude Code)

## What changed (owner request: "click on most things and explore what the data means"; last of the click-to-explore pages)
Both Advanced stats tabs (Teams and Players), in every comparison panel (Home vs away, Back-to-back vs rested, 2+ days vs 1 day, More vs less rested):
- **Click a league tile** and the arithmetic opens under the tiles: the two league averages, how many games each is built from, and the gap. Teams: "Points scored: Home 114.8 (average over 6,359 games) minus Away 112.8 (6,359 games) = +1.9 (worked out from unrounded figures)." Players: each side's figure against a player's own season average, then the difference; the "Share of games played" tile says how often players appeared in each situation. The note about unrounded figures shows only when subtracting the shown numbers would not give the shown gap. The league games themselves (thousands) are not listed.
- **"Show the games"** under each team or player table opens the games on each side of the comparison, newest first: date, home or away and opponent, a plain note on the rest ("1 day of rest", "back-to-back", "first game of the season"), then the stats (Teams: score with W or L, margin, FG%, 3-pointers, turnovers; Players: minutes, points, rebounds, assists, 3-pointers, blocks, steals, with "did not play" on games he missed). **It lists the games even when there are too few to compare** (the table says "Too few games to compare", the list still shows them). The phone shows the first columns; the laptop shows all.
- **Server:** two new read-only routes, `GET /api/teams/:team/context/games` and `GET /api/players/:id/context/games` (`TEAM_CONTEXT_GAMES_SQL`, `PLAYER_CONTEXT_GAMES_SQL`). They read the same gold tables as the tables above (`game_context`, `team_game_log`, `player_season_games`), with the same season and game filters, and return the situations each game falls into from the SAME rule the table uses (`BUCKET_ARRAY_SQL`, now shared with the grouped queries), so a game can never be on a different side in the list than in the table. No new table, grant or data change. Fetched the first time a list is opened, cached five minutes.
- Files: `app/server/contextQueries.mjs`, `app/server/playerContextQueries.mjs`, `app/server/index.mjs`, `app/src/api.ts`, `app/src/types.ts`, `app/src/lib/contextGames.ts`, `app/src/lib/useLazyLoad.ts`, `app/src/components/ContextGames.tsx` (new), `app/src/components/KpiTiles.tsx` (tiles can carry a clickable note), `app/src/TeamsAdvancedPage.tsx`, `app/src/PlayersAdvancedPage.tsx`, `app/tests/advancedClick.test.mjs`.

## How to retract
One self-contained PR: click **Revert** on the merged PR, or ask Claude to `git revert` the merge commit. The tiles go back to plain numbers and the games lists disappear.

## How to verify
- tsc, oxlint, build clean; 250 tests pass (eight new: one shared bucket rule, both SQL texts (same WHERE as the grouped tables), both mappers, side splitting, wording helpers, tile explanations including the unrounded-figures note).
- Real data (Charlotte; Brandon Miller): rebuilding every bucket from the new game lists reproduces the existing table exactly. Team, 9 buckets: game counts equal and the averages of points, points allowed, margin, 3-pointers and turnovers equal (0 mismatches); Player, 9 buckets: team games scheduled, games played, and the averages of points, rebounds, assists and minutes equal (0 mismatches). FG% in the table is made over attempted across all games, so the list shows each game's own FG% and the two are not expected to match.
- Simulated browser, 7 real checks pass: tiles are closed buttons; a Teams tile shows both league averages and the same gap as the tile; Home vs away lists 7 + 7 games with scores; Back-to-back (2 games) and rested (11) are both listed even though the comparison says too few; the Players share and stat tiles explain themselves with one open at a time; his 2 missed games are marked "did not play".
- Phone and laptop screenshots looked at; fixes made: the phone games table showed too many columns (3-pointers and turnovers are now laptop-only), and the unrounded-figures note was added after the Home 114.8 minus Away 112.8 = +1.9 reading looked wrong.

## Risks
- The Teams list can hold up to a full season (about 82 games) per panel, unpaged.
- A player who changed teams: the list follows his team games as the table does (same filters).
- FG% per game in the list is not the same calculation as the table's FG% (see above).

## Owner walkthrough
Open Teams, Advanced stats and look at "Home vs away". Click a tile such as "Points scored": a note opens showing how the league figure is made, home average minus away average over thousands of games. Under the team's own table, click "Show the games" to see each home game and each away game with the score and shooting, newest first, with how rested the team was. The same works on every comparison, and on the Players tab, where games the player missed are marked "did not play". Even a comparison that says "too few games" lets you open the few games there are.
