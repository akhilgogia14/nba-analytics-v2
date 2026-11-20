# Release 081: Click a Predictions tile to see the games behind it

Date: 2026-11-20
Branch / PR: feat/predictions-click
Author: (Claude Code)

## What changed (owner request: "click on most things and explore what the data means")
- **Each tile in "What to expect" is now a button.** Click one (for example Points, 20.7) and a panel opens under the tiles: **where the number comes from** (last-10 average with its low and high, season average and how many games, "half of each" = the baseline), the **typical miss** explained in one sentence (the back-test, and which minutes group the player is in), and **every game behind it**, newest first, each with its figure, a bar scaled to his highest game, and whether it counts in the last 10, the season, or both (season-only games are faded).
- **Against the opponent** is a closed fold-out in the panel: his last meetings with the chosen opponent and their average, marked as not part of the baseline.
- One tile is open at a time; clicking it again, another tile, or **Close** changes or removes the panel. The open tile has an accent border; on a phone the panel scrolls into view.
- **No server or data change.** The page already holds every game behind each tile (last 10, season, opponent), so the click only reorganizes what is loaded. The panel and the tile use the same two averages, so they cannot disagree (`behindTile` in `app/src/lib/outlook.ts`).
- Files: `app/src/components/OutlookHeadline.tsx` (buttons and panel), `app/src/lib/outlook.ts` (`behindTile`, `Behind`, `BehindRow`), `app/src/PredictionsPage.tsx` (passes the opponent), `app/tests/outlook.test.mjs`.

## How to retract
One self-contained PR: click **Revert** on the merged PR, or ask Claude to `git revert` the merge commit. The tiles go back to plain numbers.

## How to verify
- tsc, oxlint, build clean; 242 tests pass (two new: the panel's baseline equals the tile's and each game appears once with the right window flags; gaps and no-games cases).
- Real data (Brandon Miller): independent calculation from the raw API data gives last-10 average 21.5, season average 19.917 over 12 games, baseline 20.708 for points; rebounds 4.7. The panel shows 21.5, 19.9 over 12 games, "half of each, 20.7"; 12 distinct games, 10 marked last 10, all 12 in the season. 9 simulated-browser checks pass (tiles closed at first, open, switch tile, opponent fold-out closed, Close).
- Phone and laptop screenshots looked at.

## Risks
- The panel lists up to every game of the season (about 82 at a full season) in one list; it is not paged.
- The typical-miss sentence repeats the band wording from the paragraph above the tiles; the figures are the existing back-test constants.

## Owner walkthrough
Open Predictions and pick a player. Under "What to expect", click any tile, such as Points. A panel opens with the arithmetic behind the big number: his last-10 average, his season average, and the half-and-half baseline. Below are the games themselves, newest first, with a bar for each, so you can see which big or small games pull the number around. Faded bars are games that count only in the season average. Open the "Against ATL" line to see his earlier games against that opponent, which are shown for reference but are not in the baseline. Click the tile again or press Close to put it away.
