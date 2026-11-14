# Release 043: league-average line on the team sparklines, and steals, blocks and fouls in the team box score

Date: 2026-11-14 (UTC)
Branch / PR: `feat/team-league-line` (PR number added after opening)
Author: (Claude Code)

## What changed
- **Team box score:** three more columns, **STL, BLK and PF**, after TOV, with their averages in the average row. The numbers were already in `team_game_log`; no new data. (The table now has 16 columns and scrolls sideways on a narrow screen.)
- **League average on the scorecards:** every Teams-page scorecard sparkline now has a **dotted line at the league average** of that stat, next to the dashed line for the team's own season average. The card's top-right text also reads "league avg 113.3". A sentence under the cards explains the two lines, naming the season and how many team games the league figure covers.
- The league figure is the average **per team game for the latest season that has games of the chosen type** (regular season: 2026-27, 340 team games; playoffs: the latest playoffs, 2025-26, 170 team games). Percentages are **total made over total attempted** across the league, like the team's own figure. The dotted line's scale is included in the sparkline's scale, so it is always inside the box (a team far from the league average gets a flatter line).
- New route `/api/league/team-averages?type=regular-season|playoffs` (bad type: 400). It reads only `team_game_log` (a live aggregate, cached five minutes), so **no new table and no new grant**.
- The Player page is unchanged (a league average for a single player is not meaningful); the scorecard and sparkline just accept an optional league value.

## Why
The owner asked for steals, blocks and fouls in the team box score and its averages, and a league-average line on the spark charts "for each metric".

## How to verify
- `cd app && npm test`: **133 passed** (127 before; 6 new: the league SQL takes only the game type, reads only `team_game_log`, covers all 15 stats and pools percentages; the mapping and the no-games case; the sparkline's league line and scale; the average row's STL/BLK/PF; the explanatory note). `npx tsc -b`, `npx oxlint`, `npm run build`: clean.
- **League figures checked against an independent recompute from silver** (not the gold table): regular season 340 team games, 113.315 points, 45.818% FG, 13.309 threes, 35.143% from three, 26.135 assists, 14.779 turnovers, 5.05 blocks, 8.288 steals; playoffs (2025-26) 170 team games, 107.929, 45.174%, 11.947, 34.76%, 23.347, 13.512, 5.141, 8.041. The route returns the same numbers to the third decimal.
- **Whole page in a simulated browser against the real tables, 34 of 34** (the 25 from release 041 plus 9 new): all six cards show their league average (113.3, 45.8%, 13.3, 35.1%, 26.1, 14.8) and each has both a dotted league line and a dashed season line; the note under the cards names 2026-27 and 340 team games; the box score columns end TOV, STL, BLK, PF; New York's Nov 11 game shows 11 turnovers, 5 steals, 4 blocks, 21 fouls; the average row has values for the three new columns; Playoffs says "2025-26 playoff, 170 team games".
- **Not done:** nobody has seen it in a real browser; not deployed yet (merging deploys).

## Files changed
- `app/server/teamQueries.mjs`, `app/server/index.mjs` (the league route), `app/src/lib/spark.ts`, `app/src/components/Sparkline.tsx`, `Scorecard.tsx`, `TeamGameLog.tsx`, `app/src/TeamsPage.tsx`, `app/src/lib/teamPage.ts`, `app/src/api.ts`, `app/src/types.ts`; tests `app/tests/teamQueries.test.mjs`, `spark.test.mjs`, `teamPage.test.mjs`; `docs/NEXT.md`.

## Risks and things I am unsure about
- Early in the season the league average rests on few games (340 team games is about 11 games per team); it will move.
- The league average counts **every** team game, not a per-team average, so a team that has played more games weighs more; with all 30 teams within a game or two of each other this is negligible.
- A flat sparkline can result when a team sits far from the league line (the scale includes both lines). I chose truthful over pretty; tell me if you would rather the line stayed off-scale.
- **Interpretation to confirm:** "for the averages" was read as the box score's average row. Steals and blocks are in `team_form` and could also be scorecards; fouls are not. They were left out because defense was planned for later.

## Review focus for Codex
(Only if the owner asks.) The league SQL against the pooling rule; that the Player page output is unchanged.

## Open questions for the owner
1. Should steals and blocks (and later points allowed) get their own scorecards now, or wait for the defense step?
2. Is the dotted line readable enough on a real screen?

## Owner walkthrough
- **What you will see on the Teams page:** under each big number the little line of the last 10 games now has a second, dotted line across it. That dotted line is the league average for that stat, so you can see at a glance whether the team is above or below the typical team. The top-right of each card says the same in words ("league avg 113.3"), and a sentence under the cards explains dashed versus dotted.
- **In the Box scores view:** three new columns at the right, steals, blocks and fouls, with their averages in the bottom row.
- **What to check yourself:** open Teams, look at the six cards, and tell me whether the dotted line is easy to see in each team's colours. Then try Playoffs: the league figure there is from the latest playoffs, and the sentence says so.
