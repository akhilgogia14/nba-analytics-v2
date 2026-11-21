# Release 087: A better baseline for minutes

Date: 2026-11-20
Branch / PR: feat/minutes-smoother
Author: (Claude Code)

## What changed
- **Minutes baseline on Predictions.** It was half his last-10 average and half his season average. Once he has played 5 games this season it is now a **weighted average of his games, newest counting most** (each game further back counts 25% less), over his last 10 games, or all of this season's games if that is more. Before 5 games, and for every other stat, nothing changes (still the half-and-half blend).
- **Typical miss for minutes** now comes from the back-test of this smoother, by minutes band: under 10: ±5.4, 10 to 20: ±5.6, 20 to 30: ±4.8, 30+: ±4.1, everyone ±4.9 (was 5.6, 5.9, 5.0, 4.1, 5.1).
- **Wording:** the intro under "What to expect" and the full table's note say minutes use a weighted average; the panel under the Minutes tile explains it instead of "half of each".
- Example: Brandon Miller's minutes baseline goes from 30.7 to 27.9 (his recent games are lower); Jalen Brunson's from 34.2 to 35.2.
- Files: `app/src/lib/outlook.ts` (`baselineFor`, `weightedRecent`, `usesSmoother`, the new minutes typical-miss row), `outlookChart.ts`, `OutlookTable.tsx`, `OutlookCharts.tsx`, `OutlookHeadline.tsx`; `scripts/analysis/backtest_minutes.py` (the back-test, read-only); `docs/predictions-backtest.md` (Result 6); tests in `app/tests/outlook.test.mjs`. No server, data or pipeline change.

## The back-test (held-out 2025-26 and 2026-27, 29,923 games; decay chosen on earlier seasons only)
- All players: miss 5.097 -> 4.915 minutes (-3.6%); rotation players -2.6%; 2025-26 -4.0%; 2026-27 so far -1.1%. Better by 0.18 minutes a game, standard error 0.011. The blend's lean (-0.16 minutes) is gone (+0.04).
- Players averaging 30+ minutes: a tie (4.114 vs 4.118). The gain is for players under 30 minutes.
- My earlier replay used a decay of 0.30; the proper run chose 0.25 on the training seasons (the curve is flat, 0.30 is within 0.002), so 0.25 is used.

## How to retract
One self-contained PR: click **Revert**. The minutes baseline and typical miss go back to the blend and the old figures. The back-test script and notes stay in the repo history only if you revert the whole PR.

## How to verify
- tsc, oxlint, build clean; 273 tests pass (5 new: the weights, blend before 5 games and smoother from 5, the season-longer-than-10 case, a missing minutes figure skipped, the new typical-miss row).
- Real pages, simulated browser, 12 checks pass for Brandon Miller (27.9) and Jalen Brunson (35.2): the tile, the panel wording, the full table and the other stats' "half of each" wording. Both minutes baselines match an independent SQL calculation of the weighted average from `player_season_games`.

## Risks
- The minutes gain does not cover injury returns or role changes, which stay the main miss; the page already says injuries and minutes changes are not in the baseline.
- Early in a season (fewer than 5 games) players still use the old blend.
- A figure that jumps (Miller 30.7 to 27.9) can surprise: the tile panel shows the games behind it.
- The back-test script needs Databricks Connect, so it is not run in CI.

## Owner walkthrough
Open Predictions and look at the Minutes tile. The number is now a weighted average: his most recent game counts most, the one before slightly less, and so on. Click the tile and the panel says so in one line, and shows the games. If a player has had his minutes drop lately, the number follows that sooner than before. The typical miss next to it is slightly smaller than before for most players (about 5 minutes instead of 5.1 to 5.9). The other tiles, points through steals, did not change.
