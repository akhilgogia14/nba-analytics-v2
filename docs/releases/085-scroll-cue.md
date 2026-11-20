# Release 085: Phone cue for tables that scroll sideways

Date: 2026-11-20
Branch / PR: feat/scroll-cue
Author: (Claude Code)

## What changed (UX plan: phone cue for sideways-scrolling tables)
- **New `ScrollX` box** (`app/src/components/ScrollX.tsx`) replaces the plain scrolling wrapper around 12 wide tables: Players and Teams Advanced tables, game logs, Defense grid and its drill-down, "Show the games" tables, roster, meetings, the combined-stats table and the Predictions full table.
- While there is more table to the right, a soft fade on the right edge and a small "Swipe for more →" note show. They go away at the end of the table, and never show when everything fits (laptops).
- No data, server or wording change.

## How to retract
One self-contained PR: click **Revert** on the merged PR. Tables scroll as before, without the cue.

## How to verify
- tsc, oxlint, build clean; 261 tests pass (no test changes; layout needs a real browser).
- Headless Chrome on real data: at 390px the cue appears on the Players combined-stats table, is gone after scrolling that table to the end, and does not appear at 1280px.
- On the Players Advanced page the tables fit at 390px, so no cue shows there. Tables inside closed fold-outs show the cue once opened.

## Risks
- The cue was checked in Chrome only, not on a real iPhone or Android.
- The fade colour matches the card background; a table placed on a different background would show a slightly different edge.

## Owner walkthrough
On your phone, open Players and scroll to the combined-stats table. The right edge fades and a small "Swipe for more →" pill sits in the corner. Swipe the table sideways and the pill and fade vanish when you reach the end. On a laptop nothing changes.
