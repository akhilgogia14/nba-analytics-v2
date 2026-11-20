# Release 069: Typical miss on the Predictions page

Date: 2026-11-19
Branch / PR: feat/typical-miss
Author: (Claude Code)

## What changed
- Predictions table: a new "Typical miss" column right after Baseline (for example "±5.9" for Jalen Brunson's points). The same figure appears on each chart card ("Baseline 27.9 · typical miss ±5.9"), in the chart's text description, and a sixth bullet in "How to read this" says who it is for.
- The figure is how far the baseline was from what actually happened, on average, when it was tested on every game of 2025-26 and 2026-27 so far (`docs/predictions-backtest.md`), by the player's average minutes over his last 10 games: under 10, 10 to 20, 20 to 30, and 30 and up (everyone, if he has no last-10 games). The note names the band ("players averaging 30+ minutes").
- The numbers are constants in `app/src/lib/outlook.ts` (`TYPICAL_MISS`, `MISS_BANDS`), generated from the back-test results; nothing new is computed when the page loads.
- The back-test script gained the minutes-band table (`scripts/analysis/backtest_baseline.py`, section 7) and was rerun; the write-up has a new Result 5.

## Why
Owner request (2026-11-19): show how far to lean on the baseline. A first version used two groups (rotation and others); on a real bench player it showed "±3.6" on a baseline of 0.0 points, which cannot be right, so it was split into four minutes bands.

## How to verify
- `npx tsc -b`, `npx oxlint`, `npm run build`: clean. `npm test`: 200 passed (the figures are pinned to the back-test; more minutes means a bigger miss on every count stat and a smaller one on minutes; the band follows average minutes with its lower edge included; no last-10 games gives the all-players figure).
- Real data, simulated browser through a local server: Brunson (34 minutes a game) shows the 30+ band for all seven stats (points ±5.9, rebounds ±2.1, assists ±1.8, 3-pointers ±1.16, blocks ±0.61, steals ±0.87, minutes ±4.1); Jaden Akins (almost no minutes) shows the under-10 band (points ±2.9); the baseline and the nine min/avg/max numbers per stat still match an independent SQL calculation; the note and the chart section name the band. 9 of 10 checks pass; the tenth still expected the earlier two-group figure (±5.2) and the page correctly shows ±5.9.
- After merge the deploy run is checked before saying it is live.

## Files added or changed
- `app/src/lib/outlook.ts`, `app/src/components/OutlookTable.tsx`, `app/src/components/OutlookCharts.tsx`, `app/tests/outlook.test.mjs`, `scripts/analysis/backtest_baseline.py`, `docs/predictions-backtest.md`, `docs/NEXT.md`, this note.

## Risks and things I am unsure about
- **It is an average over a band,** not a measurement for this player: a player who scores very little misses by less than his band's figure, and an erratic star by more. The note says so. Even the lowest band shows ±2.9 points.
- **It is the mean absolute miss,** so some games miss by more and some by less (the page says so); it is not a range that holds the result a set share of the time (that is the min-to-max range, which holds it 80 to 95% of the time).
- **Frozen numbers:** they come from the back-test of 2026-11-18/19 and do not update as the season goes on; rerun `scripts/analysis/backtest_baseline.py` and update the constants to refresh them.
- **Conditional on playing:** the miss is for a game he plays, not for whether he plays.
- Not seen as pixels (only structure).

## Review focus for Codex
Whether `missBand` edge cases are right (exactly 10, 20 and 30 minutes go to the higher band, as in the back-test's `lo <= minutes < hi`).

## Open questions for the owner
None.

## Owner walkthrough
On the Predictions page, next to the Baseline there is now a "Typical miss" number such as "±5.9" for points. It means: when we tested this same baseline on past games, it was off by about that much on average. It is bigger for players who play a lot (they score more, so a miss is bigger in points) and smaller for bench players, so the number depends on how many minutes the player averages, and the note says which group it is using. Treat it as a rough "how much to trust the baseline": if the baseline says 27.9 points and the typical miss is 5.9, a game of 22 or 34 would not be surprising. It is an average, so some nights are further off.
