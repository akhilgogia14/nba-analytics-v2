# Release 076: Predictions answer first

Date: 2026-11-20
Branch / PR: feat/predictions-headline
Author: (Claude Code)

## What changed (UX plan: Predictions headline answer first)
- **New "What to expect" row** right under the Next game card: one tile per stat (points, rebounds, assists, 3-pointers, blocks, steals, minutes). Each tile: the baseline as the big number, "typical miss ±X" (the back-tested miss for his minutes band), and "last 10: lowest to highest" of his own games. One short paragraph explains the baseline; the six bullets are gone from the top.
- **The 11-column table is now a fold-out, "All the numbers"**, closed by default, with the same table and a shorter, third-person "How to read this" inside. The vs-opponent columns stay (muted) in there.
- The charts ("The same games, drawn") are unchanged and sit below.
- Files: `app/src/components/OutlookHeadline.tsx` (new), `app/src/components/OutlookTable.tsx` (wrapped in a fold-out, copy shortened), `app/src/PredictionsPage.tsx`, `app/src/lib/outlook.ts` (`headlineTiles`), `app/tests/outlook.test.mjs`. No server, table or number changes.

## How to retract
Everything is in this one pull request. On GitHub, open the merged PR and click **Revert**, which opens a new PR that puts the page back exactly as it was (merging that deploys the old page). Or ask Claude to run `git revert` on the merge commit. No data or server changes are involved, so nothing else needs undoing.

## How to verify
- tsc, oxlint, build clean; 224 tests pass (two new: the tiles equal baseline / band miss / last-10 range; no games shows no figures).
- Real data (Brandon Miller): all seven tiles' baseline and last-10 range equal an independent calculation from the raw game rows; the full table is closed by default but still in the page; no first-person wording left (10 simulated-browser checks pass).
- Laptop and phone screenshots looked at. On a phone the tiles sit two per row; page height 3,312 (was 3,390).

## Risks
- Number formats still differ by stat (1 decimal for points, 2 for small counts); that is the planned copy pass.
- Page text elsewhere (the Next game card, chart captions) still has its old wording.

## Owner walkthrough
Open Predictions and pick a player. Right under the next-game card you now see seven tiles. The big number is our plain starting estimate for that stat; underneath it says how far off that kind of estimate has typically been, and the lowest-to-highest range of his last 10 games. The wide table that used to come first is still there: tap "All the numbers" to open it. The charts below it are the same as before.
