# Release 075: Season hexagons light up the opponent

Date: 2026-11-20
Branch / PR: feat/hexagons-opponent
Author: (Claude Code)

## What changed (UX plan, part 2 of the universal opponent filter)
- **Players Overview, season chart:** with an opponent set (and the "vs ATL" switch on), every game against them is drawn in the opponent's colors (fill from the same five-step ramp by stat value, plus an outline in their bright color, so it stands out even for black/white/grey teams). Games still to come against them are dashed outlines in their color. All other upcoming games stay grey outlines, now with a bubble (opponent, date, home or away). The legend adds "games vs ATL" and "games vs ATL still to come". If there are none, a short note says so.
- **Server:** `/api/players/:id/season` now adds `upcoming` (id, date, opponent, home or away) to the regular-season grid of his current team, from the `game_slate` schedule (one extra query; if it fails the grid simply has none). A traded player's earlier-team grids get an empty list. Playoffs are unchanged (no schedule).
- Files: `app/server/queries.mjs` (`UPCOMING_SQL`, `addUpcoming`), `app/server/index.mjs`, `app/src/types.ts`, `app/src/lib/hex.ts`, `app/src/components/SeasonGrid.tsx`, `app/src/App.tsx`, tests in `hex.test.mjs` and `queries.test.mjs`. No table or grant changes (`game_slate` is already readable by the app).

## How to verify
- tsc, oxlint, build clean; 222 tests pass (scheduled games fill empty slots in order, "vs opponent" for played/missed/scheduled, bubble text, `addUpcoming`, the SQL's only inputs).
- Real data, three players (including a traded one): the scheduled list equals an independent query of `game_slate` for the team (ids, dates, opponents), traded player's older grid gets none. Laptop screenshots of CHA with ATL (red) and BKN (near-black team, white outline) were looked at.

## Risks and things to know
- **The stored 2026-27 schedule has 80 games per team (1,200 games), not 82**, so the last two slots of each grid have no opponent and no bubble. The grid still shows 82 slots as before. Worth checking whether the schedule source is incomplete.
- Some games dated Nov 18-19 are still "not final" in the schedule, so they show as scheduled until the daily sync catches up.
- Not checked on a phone screenshot (the chart is an image that scales to the screen).

## Owner walkthrough
On a player's page, pick an opponent (from Today's game, a roster, or the "Against an opponent" picker). The season chart of hexagons now marks that opponent: games he already played against them get an outline in their team color, games coming up against them are dashed outlines in their color, and everything else looks as before. Tap or hover a dashed hexagon to see the opponent and date. Flip the switch above the cards to "Recent form" to turn the highlight off.
