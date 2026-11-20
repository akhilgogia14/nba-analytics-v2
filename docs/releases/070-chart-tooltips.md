# Release 070: Tooltips on the Predictions charts

Date: 2026-11-20
Branch / PR: feat/chart-tooltips (built on feat/typical-miss, PR #89)
Author: (Claude Code)

## What changed
- In "The same games, drawn", hovering (or tapping, or tabbing to) a dot now shows a styled bubble: the value, the row, and the game ("19.0 points · Last 10 / Nov 2 vs BKN"). The dot grows and darkens while active. This replaces the slow plain browser hover text, which did not work by touch.
- Games with the same number in a row sit on the same spot, so one bubble lists all of them (newest first; after 5 it says "and N more").
- Tapping elsewhere or pressing Escape closes it. Each dot has a screen-reader label with the same text.
- Files: `app/src/components/OutlookCharts.tsx`, `app/src/lib/outlookChart.ts` (`dotGroups`, `tipGames`; dots now carry a `label`), `app/tests/outlook.test.mjs`.

## How to verify
- tsc, oxlint, build clean; 201 app tests pass (new: same-value games group, long lists are cut).
- Real data, simulated browser (Brunson): hover shows the tooltip with the right text, leaving hides it, a tap shows it, tapping elsewhere closes it, and the last-10 row's tooltips list exactly 10 games. 11 of 11 pass. Not seen as pixels.

## Risks
- Bubble position is clamped to 16-84% of the chart width; not eyeballed on a phone.

## Owner walkthrough
On the Predictions page, in each small chart, point at any dot (or tap it on a phone). A small dark bubble appears with the number and the game it came from, such as "19.0 points, Nov 2 vs BKN". If two games have the same number, both are listed in one bubble. Tap anywhere else to close it.
