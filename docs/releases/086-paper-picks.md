# Release 086: Paper picks (save a pick, get graded, see the record)

Date: 2026-11-20
Branch / PR: feat/picks
Author: (Claude Code)

## What changed
- **Save a pick from Predictions.** Open a stat tile; a small "Paper pick" box appears: Over or Under, the line you type (starts at the baseline rounded to .5), Save. It is for the player's next game. Saving the same player, game and stat again replaces the pick.
- **New "Picks" page** (fifth button in the header, `#/picks`). It lists every pick, open ones first. Once a game is final the page looks up the real box score and marks the pick Won, Lost, Push (landed exactly on the line) or Void (he did not play), showing "he had 28". A graded result is saved and never looked up again.
- **The record** at the top: wins-losses-pushes, hit rate (wins out of wins plus losses), open picks, and the record split into picks that went **with the baseline** and picks that went **against it**. That split is the paper-trading question: does the call you make beat the plain baseline?
- **Remove** asks first. **Download my picks (backup)** saves a JSON file.
- **Where picks live:** in this browser only (decision with the owner: browser now, a Databricks table later). A different device or cleared browser data starts empty, which the page says. Stored data is validated when read, so damaged or edited data is ignored rather than breaking the page.
- Header buttons now wrap onto a second line on a phone (five buttons no longer fit in one row).
- Nothing is sent anywhere: no betting-site link, no odds data, no money. Lines are typed by you.
- Files: `app/src/lib/picks.ts` (format, grading, record, safe reading), `app/src/components/AddPick.tsx`, `app/src/PicksPage.tsx`, small edits to `OutlookHeadline.tsx`, `PredictionsPage.tsx`, `PageSwitch.tsx`, `Root.tsx`, `lib/pages.ts`; tests in `app/tests/picks.test.mjs`. No server, data or pipeline change (grading uses the existing game-detail route).

## How to retract
One self-contained PR: click **Revert**. The Picks page and the pick box disappear. Picks already saved stay in your browser's storage and are ignored.

## How to verify
- tsc, oxlint, build clean; 268 tests pass (7 new: grading incl. pushes, line parsing, only-final-games-grade, record and hit rate, with/against-baseline split, replace and ordering, rejecting damaged stored data).
- Real data (Brandon Miller, Charlotte), simulated browser, 15 checks pass: four picks on his Nov 17 game at LAL graded 1 win, 2 losses, 1 push (hit rate 33%); the Nov 20 game stays Open; results saved; the form on Predictions saves "Under 22.5 points" with the baseline and replaces rather than duplicates; Remove asks first; damaged storage shows the empty state. The numbers he had (28 points, 2 rebounds, 4 assists, 0 steals) match an independent SQL query on `player_season_games`.
- Screenshots at 390px of the Picks page and the pick box looked at.

## Risks
- Browser-only storage: picks are lost if site data is cleared, and the phone and laptop have separate lists. Download the backup now and then.
- A game is graded only when the team result exists, so a game whose data lands late shows Open for a while.
- The hit rate on a small number of picks is noise; the page says so.
- Not tested on a real phone.

## Owner walkthrough
Go to Predictions, pick a player, click the Points tile. Under the title there is a "Paper pick" box: choose Over or Under, type the line you would take, press Save pick. Do that for a few stats. Open the new **Picks** button at the top: each pick is listed as Open until the game is over. The next time you open Picks after the game is final, each one says Won, Lost or Push and shows what he actually had, and the tiles at the top show your record and hit rate. "With the baseline" and "Against it" show how you did when you agreed with the app's number and when you went the other way. "Download my picks" saves a backup file.
