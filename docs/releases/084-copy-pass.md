# Release 084: Copy pass, one number format per kind of number

Date: 2026-11-20
Branch / PR: feat/copy-pass
Author: (Claude Code)

## What changed (UX plan item 8: "remove first-person text, one number format per stat")
- **First-person wording:** a search of every user-visible string in the app found none left (the "my choice" and "I" wording was reworded in releases 076 to 078 as those pages were redone). Nothing to change there.
- **One rule for numbers, applied on every page:**
  1. **A single game's number is a whole number.** A game's points, the lowest and highest game ("low 5, high 39"), the game rows and dots, chart axis ends. Minutes in a single game are rounded. Percentages keep one decimal.
  2. **An average, baseline or typical miss has one decimal, for every stat.** Before, Predictions wrote 3-pointers, blocks and steals with two decimals (2.83, 0.63) while the scorecards, roster and Advanced stats used one (2.8, 0.6). Predictions now matches (2.8, 0.6).
- **Where it changed:**
  - Predictions: the tiles ("last 10: 0 to 5", not "0.00 to 5.00"; baseline 2.8), the "where it comes from" panel (low and high and every game row whole), the full table (min and max whole, average one decimal), the charts (dot tooltips and axis ends whole).
  - Player scorecards, the Teams scorecards and the combined-stats table: "low" and "high" and "low to high" are whole numbers ("low 5, high 39", not "low 5.0, high 39.0"). The tooltip on the bar says the same.
- **Captions:** the Predictions subtitle no longer says "not a fitted model" (now "A baseline built from past games, not a forecast model yet"); the chart caption under "The same games, drawn" is shorter and no longer repeats the typical-miss sentence already shown above the tiles. The Next game card and the other captions read plainly and are unchanged.
- **Two exceptions, on purpose:** the league-effect tiles on the Advanced tabs stay at two decimals (the effects are tiny; one decimal would show 0.0 for most), and the Defense grid keeps two decimals for 3-pointers, blocks and steals in its per-group figures (a group's total per game is small; one decimal would hide most differences between groups).
- Files: `app/src/lib/geom.ts` (`f0`), `app/src/lib/outlook.ts` (`fmtGame`, digits), `app/src/lib/tips.ts`, `app/src/components/Scorecard.tsx`, `CombosTable.tsx`, `OutlookHeadline.tsx`, `OutlookTable.tsx`, `OutlookCharts.tsx`, `app/src/PredictionsPage.tsx`, tests in `outlook.test.mjs`, `tips.test.mjs`, `geom.test.mjs`.

## How to retract
One self-contained PR: click **Revert** on the merged PR, or ask Claude to `git revert` the merge commit. The old formats and captions come back; no data or server change is involved.

## How to verify
- tsc, oxlint, build clean; 261 tests pass (three new: whole-number helper, single game against average formats, the range tooltip).
- Real pages (Brandon Miller, Charlotte), simulated browser, 10 checks pass: every Predictions tile has a one-decimal baseline and typical miss and a whole-number last-10 range; the panel shows one-decimal averages, whole low and high and whole game rows; the full table has one-decimal baseline, miss and averages with whole min and max for all three views; the chart caption and page subtitle read as above; the six player scorecards show whole low and high; the Teams scorecards show whole counts and one-decimal percentages with a % sign.
- Screenshots of the Predictions tiles and charts looked at.

## Risks
- A baseline of 0.6 blocks no longer shows the second decimal (0.63); the typical miss for blocks (±0.6) is now as precise as the figure itself.
- An average that happens to be a whole number still shows one decimal ("1.0"), by design: it is an average, not a single game.
- The Defense grid's two decimals on three stats are an exception to the one-decimal rule (see above); say if you want it changed.

## Owner walkthrough
Nothing new to click. Look at Predictions: the big numbers are averages with one decimal on every stat, and "last 10: 0 to 5" shows whole numbers because it is single games. Open a tile and the games listed are whole numbers too. On the Players and Teams pages the "low" and "high" under each scorecard are whole numbers now ("low 5, high 39"). The text under "The same games, drawn" is shorter.
