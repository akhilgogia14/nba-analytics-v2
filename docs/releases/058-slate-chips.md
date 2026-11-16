# Release 058: schedule chips on Today's games

Date: 2026-11-16
Branch / PR: feat/slate-chips
Author: (Claude Code)

## What changed
- Each team's row on a Today's games card can now carry small chips with plain schedule facts for that game: Back-to-back, 3 in 4 nights (else 4 in 6 nights), Rested · N days (3 or more days off), Road trip · game N (away team only, 3rd game or later of the trip), and Rest edge +N (only on the more rested team, when it has 2 or more extra days of rest than the opponent).
- Each chip opens that team's Advanced stats tab. A team with nothing unusual gets no chips and no empty strip.
- The `/api/games` query now LEFT JOINs `game_context` for the home and the away team of each game. A game with no context row still shows, with no chips.

## Why
Today's games had scores and links only. `game_context` (release 051) already holds the rest facts per team per game, and the Advanced stats tab (053) explains what they mean league-wide, so the chips are the cheapest, most visible use of that data. Chosen with the owner (plan shown and approved 2026-11-16).

## How to verify
- `npx tsc -b`, `npx oxlint`: clean. `npm test`: 165 passed (8 new in `tests/slate.test.mjs`: the join, the mapping, every chip rule and threshold, home never gets a road-trip chip, no empty chips).
- Real data, read-only: the exact new query for Nov 14 (5 games) and Nov 17 (5 games): every game once, none missing context, playoffs 0 games.
- Simulated browser against real data through a local server (10 checks pass): Nov 17 POR@MIN shows both teams Back-to-back, home also 3 in 4 nights, away Road trip game 3; NYK@TOR shows only Road trip game 3 (matches the Advanced tab); UTA@LAC shows no chips; a played day (Nov 14) shows chips; Playoffs shows the plain message with no chips; a chip leads to that team's Advanced stats tab.
- After merge, the deploy run and the live `/api/games` are checked before saying it is live. No new table, no new grant: the app identity already has SELECT on `game_context`.

## Files added or changed
- `app/server/slateQueries.mjs`, `app/src/types.ts`, `app/src/lib/slate.ts` (the chip rules and thresholds), `app/src/TodayPage.tsx`, `app/tests/slate.test.mjs`, `docs/releases/058-slate-chips.md`.

## Risks and things I am unsure about
- I have not seen the chips drawn in a real browser, only checked their text and links in a simulated one. Colours (amber for tiring, teal for rested, grey for road trip) are worth a look on a phone.
- The thresholds (3 days, 2 days, game 3) are my choice and live in one place in `lib/slate.ts`.
- The chips state facts only. The league-wide size of each effect is on the Advanced tab; per-team effects were not stable (see the stability check), so nothing here implies a team-specific effect.
- Rest edge is shown only on the more rested team, so a game can show it on one side only.

## Review focus for Codex
The LEFT JOIN: whether a duplicate `game_context` row for a (game, team) could ever double a game on the page (the table's gates say the key is unique).

## Open questions for the owner
- Keep or drop the Road trip chip once you have seen it on a real day?

## Owner walkthrough
On Today's games, under a team's name you may now see small rounded labels. "Back-to-back" means the team also played yesterday. "3 in 4 nights" means its third game in four nights. "Rested · 3 days" means three or more days off. "Road trip · game 3" means the visiting team's third game in a row away from home. "Rest edge +2" means this team had at least two more days of rest than the other. A team with nothing unusual shows no labels. Tap a label to open that team's Advanced stats page. The labels are facts about the schedule, not predictions.
