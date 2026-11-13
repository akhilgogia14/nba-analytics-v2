# Release 036: the page opens on the Averages view

Date: 2026-11-13 (UTC)
Branch / PR: `feat/averages-first` (PR number added after opening)
Author: (Claude Code)

## What changed
- The page now opens on **Averages** (the six scorecards with their sparklines and legend). **Box scores** is the second pill and one click away; the order of the pills is now Averages, Box scores.
- Nothing else changed. The box-score games still load in the background, so switching is instant. The choice is not remembered between visits (it always opens on Averages).

## Why
The owner asked for the averages first (this reverses the default chosen in release 032).

## How to verify
- `cd app && npm test`: **107 passed** (the view-order test now expects Averages first and the default to be the cards). `npx tsc -b`, `npx oxlint`: clean.
- Whole page in a simulated browser against real data, **23 of 23**: on load Brunson's page shows six scorecards with sparklines and the legend and no table; the pills read Averages, Box scores with Averages pressed; clicking Box scores shows the table and removes the cards; the table, the averages row, the switch back and the Playoffs toggle all behave as in release 034 and 035.
- **Not done:** nobody has seen it in a real browser.

## Files changed
- `app/src/lib/gamelog.ts`, `app/src/App.tsx`, `app/tests/gamelog.test.mjs`.

## Owner walkthrough
- **What you will see:** open the page and you get the six big-number cards first, as before the box scores existed. Next to "Averages" there is a second button, "Box scores"; click it for the table of the last 15 games, click "Averages" to come back.
