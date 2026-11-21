# Release 088: Road-game wording and the 80-game note

Date: 2026-11-21
Branch / PR: feat/road-game-wording
Author: (Claude Code)

## What changed
- **One wording for a road stretch.** The Today's games chip "Road trip · game 4" is now **"4th straight road game"**, and the Teams next-game note "game 4 of a road trip" says the same. The chip still shows only for the away team from the 3rd road game on. The homestand note ("game N of a homestand") is unchanged.
- **A note on the 80-game season total.** The stored 2026-27 schedule lists 80 games per team, not 82: game ids 0022601201 to 0022601230 (30 games, 2 per team) have no teams yet, and 6 of them are empty placeholders that silver leaves out on purpose. They are expected to be set once the NBA Cup group stage is decided (early December). The player Season chart (the only place the 80 shows, "played 12 of 80 team games so far") now adds "The last 2 games of the 82 are added to the schedule once the NBA Cup is decided." while the total is exactly 80, and drops it when it is not.
- Files: `app/src/lib/slate.ts`, `app/src/lib/context.ts`, `app/src/lib/gameType.ts` (`seasonTotalNote`), `app/src/components/SeasonGrid.tsx`; tests in `slate.test.mjs`, `context.test.mjs`, `gameType.test.mjs`. No server, data or pipeline change.

## How to retract
One self-contained PR: click **Revert**.

## How to verify
- tsc, oxlint, build clean; 274 tests pass (1 new for the note, 2 updated for the wording).
- Read-only counts in Databricks (2026-11-21): bronze `schedules` for 2027 has 1,200 real regular-season games plus 6 placeholders; every one of the 30 teams has exactly 80. 2025-26 had the full 1,230.
- After the Cup final (about Dec 12), check again: if a team still shows 80, that is a real gap.

## Risks
- The note shows whenever a chart's total is exactly 80, including a traded player's grid for a team that happens to have 80. That is unlikely and the sentence stays harmless.
- That the last 2 games are Cup-related is an inference from the unassigned ids and dates, not something the schedule file states.

## Owner walkthrough
Open Today's games: a team on its 3rd or later straight road game now shows "3rd straight road game" instead of "Road trip · game 3". The Teams next-game line reads the same way. Open any player's page and look under the season chart: it now says the last 2 games of the 82 come once the NBA Cup is decided, for as long as the chart shows 80 games. Nothing else moved.
