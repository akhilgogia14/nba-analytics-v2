# Release 068: Predictions page (first version, no model)

Date: 2026-11-18
Branch / PR: feat/predictions-page
Author: (Claude Code)

## What changed
- A fourth page, "Predictions" (`#/predictions?team=NYK&player=1628973`), next to Today's games, Teams and Players. It has the same team and player pickers; the player stays in the address.
- **Next game card:** the chosen player's team's next game with the opponent, home or away, rest and schedule facts (the same facts as the Advanced stats tab).
- **Table "What his past games say":** one row per stat (points, rebounds, assists, 3-pointers, blocks, steals, minutes). A Baseline column, then Min, Avg and Max under three views of his past games: his last 10 games, this season, and his last 10 against the next opponent (from any season). Each heading carries its game count. The opponent columns are muted. A five-bullet "How to read this" sits above it.
- **Charts "The same games, drawn":** one small card per stat, three rows on one shared scale: a thick line from his lowest to his highest, a dot per game (hover shows the date, home or away, opponent and number), a white tick at the average, and a dashed line at the baseline.
- **Baseline** = half his last-10 average plus half his season average, the "plain blend" baseline of `docs/MODELING.md` rung 0. Its weights were not recorded in v1, so 50/50 is my choice and the page says so. Regular season only for now.
- No new table, route or grant: it reads the existing games, season, meetings and context routes. New code: `app/src/PredictionsPage.tsx`, `app/src/components/OutlookTable.tsx`, `app/src/components/OutlookCharts.tsx`, `app/src/lib/outlook.ts` (min, average, max, baseline), `app/src/lib/outlookChart.ts` (chart positions).

## Why
Owner request (2026-11-18): a prediction page that starts with, for the player's next matchup, each stat's min, max and average as a table and chart, with the AI/ML part to come later. This is the baseline rung of the model ladder, and it shows what the data supports before a model is fitted.

## How to verify
- `npx tsc -b`, `npx oxlint`, `npm run build`: clean. `npm test`: 198 passed (13 new: min/avg/max, gaps skipped and not counted as zero, the blend, the three routes' games in one shape, season games from all team grids and only played games, number formats, the page's address, and the chart layout: one shared scale, baseline on the scale, hover text, gaps, identical values, empty).
- Real data (Jalen Brunson, next game away at MIN), simulated browser through a local server: 9 checks for the shell (four buttons, pickers, the address, three views loaded, switching player and team, the Players page unchanged), 8 for the table and 10 for the charts, all pass. The baseline and all 9 min/avg/max figures for every stat match an independent SQL calculation (70 numbers); the position of every average tick, min-to-max line and the baseline in all 7 charts matches the same SQL numbers. Example, points: baseline 27.3; last 10 19.0 / 27.9 / 38.0; season 19.0 / 26.7 / 38.0; vs MIN 11.0 / 20.4 / 28.0.
- After merge the deploy run is checked before saying it is live.

## Files added or changed
- New: `app/src/PredictionsPage.tsx`, `app/src/components/OutlookTable.tsx`, `app/src/components/OutlookCharts.tsx`, `app/src/lib/outlook.ts`, `app/src/lib/outlookChart.ts`, `app/tests/outlook.test.mjs`.
- Changed: `app/src/Root.tsx`, `app/src/components/PageSwitch.tsx`, `app/src/lib/pages.ts`, `docs/NEXT.md`, this note.

## Risks and things I am unsure about
- **It is not a forecast from a model.** It describes past games. The v1 back-test found that opponent history, home/away and rest added almost nothing over the plain blend, which is why the opponent view is muted and the page says so.
- **Min and max are single games.** With 10 to 13 games they are wide and lumpy; the dots show how few games there are. A narrower range (for example the 10th to 90th) needs more games or a model.
- **Overlap:** early in a season "last 10" and "this season" are nearly the same games.
- **What is not in the numbers:** injuries, a minutes change, a new role, who else is playing. A player returning from injury or just traded can be misleading.
- **The charts have not been seen as pixels** (only the structure was checked). Spacing, colours and legibility on a phone are for the owner's look.
- A player with no next game on the schedule gets the table without the opponent view ("no games").
- Regular season only: no playoff switch yet.

## Review focus for Codex
`chartLayout` (shared scale, baseline included in it, equal-values case) and `seasonGames` (combining a traded player's team grids, newest first).

## Open questions for the owner
1. Should the baseline weights stay 50/50 until a back-test picks them?
2. Do you want a Playoffs switch on this page, as on the others?
3. Next rung: add the opponent's defense for his position (from the new defense grid) as context next to each stat, or go straight to a back-test of this baseline against what actually happened?

## Owner walkthrough
There is a new button at the top, "Predictions". Pick a team and a player and the page shows his next game (who, where, how rested). Below it a table lists each stat (points, rebounds, assists, 3-pointers, blocks, steals, minutes). The Baseline column is a simple starting guess: half his recent form (last 10 games) and half his season average. Then, for three sets of his past games (the last 10, this whole season, and his last 10 against the team he plays next) you see the lowest, the average and the highest he has had. Under the table, each stat is drawn as a small chart: every dot is one game, the thick line stretches from his worst to his best, the white tick is his average, and the dashed line is the baseline. If the dots in the three rows sit in the same place, the views agree; if the "vs the opponent" row is off to one side, that is what happened against that team, which the page treats as context, not a better guess. This is not a computer-learning forecast yet; it is the honest starting point that any future model will have to beat.
