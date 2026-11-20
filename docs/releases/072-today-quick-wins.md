# Release 072: Today's games quick wins

Date: 2026-11-20
Branch / PR: feat/today-quick-wins
Author: (Claude Code)

## What changed (from the UX review, `docs/ux-review.md`, and the owner's feedback)
- **Chip wording:** "3 in 4 nights" is now "3rd game in 4 nights" and "4 in 6 nights" is "4th game in 6 nights" (the count includes tonight's game, from the data's own count; the old wording stays only if the count is missing).
- **Team button removed** from every team row; the team name already opens the Teams page. The Players button stays.
- **Season scoring line** under each team: "CHA · scores 100.1 · allows 110.4" (average points scored and allowed per game, season so far, however few games; hover shows "Average points per game over 14 games in 2026-27").
- Server: the slate query now also returns games in the last 4 and 6 days; one extra fixed query reads each team's season averages from gold `team_game_log` (already readable by the app; no new table or grant). Files: `app/server/slateQueries.mjs`, `app/server/index.mjs`, `app/src/TodayPage.tsx`, `app/src/lib/slate.ts`, `app/src/types.ts`, `app/tests/slate.test.mjs`.

## How to verify
- tsc, oxlint, build clean; 204 tests pass (new: chip labels, the averages query and mapping, the text line).
- Real data (today's 9 games, simulated browser against the live warehouse): all 18 team lines match an independent SQL average and game count; the seven crowded-stretch chips match the data (3rd game in 4 nights x4, 4th game in 6 nights x3); no Team button; every team still has Players and a name link. A browser screenshot of the page was checked by eye.
- After merge the deploy run is checked before saying it is live.

## Risks
- A team with very few games shows a noisy average (as the owner asked: season average however small the sample); the hover text gives the game count.
- Playoff view: averages are from playoff games only, so early in a series they are few.

## Owner walkthrough
On Today's games, each team now has a small grey line under its name with how many points it scores and allows per game this season. The odd "3 in 4 nights" tag now reads "3rd game in 4 nights", which means tonight is its third game in four days. The extra "Team" button is gone; click the team's name to open its page.
