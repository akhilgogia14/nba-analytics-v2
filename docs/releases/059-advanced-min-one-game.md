# Release 059: a team's own split shows from its first game

Date: 2026-11-16
Branch / PR: feat/advanced-min-one-game
Author: (Claude Code)

## What changed
- On Teams > Advanced stats, a team's own columns now show a figure as soon as the team has 1 game in a situation (the minimum was 8, so most back-to-back cells read "too few games" this early in the season).
- The game count is now in each team column heading, for example "Team Back-to-back (2)", so a one-game figure reads as one game. The page already printed the counts above each table.
- An empty cell (no games in that situation yet) now says "no games yet" instead of "too few games".
- The "How to read this" note says a figure from one or two games is a single result, not a pattern.

## Why
The owner asked (2026-11-16, "i think we should make it 1 to track"): early in a season every team has 0 to 4 back-to-backs (65 of 374 team-games league-wide so far, 19%, as normal), so with a minimum of 8 the team columns were empty. I had recommended leaving 8 (the stability check, release 052, found a team's own split does not repeat from one half of a season to the next); the owner chose to track from the first game. The league columns, which are the steady part, are unchanged.

## How to verify
- `npx tsc -b`, `npx oxlint`: clean. `npm test`: 165 passed (`MIN_TEAM_GAMES` is 1; a test shows a 1-game side produces a figure with its count, and a side with 0 games stays empty).
- Real data, simulated browser through a local server: 21 of 21 checks pass; NYK's back-to-back column now shows numbers with "(2)" in its heading and no "too few games".
- After merge the deploy run is checked before saying it is live.

## Files added or changed
- `app/src/lib/context.ts` (the minimum), `app/src/TeamsAdvancedPage.tsx` (headings, empty-cell wording, note), `app/tests/context.test.mjs`, `docs/NEXT.md`, `docs/releases/059-advanced-min-one-game.md`.

## Risks and things I am unsure about
- A one- or two-game figure can swing a lot (a single blowout moves a back-to-back average by 10 points). It is shown muted, labelled with its count, and the note says so, but it can still be over-read. Raising the minimum again is a one-number change (`MIN_TEAM_GAMES`).
- The stability check applies only to full seasons; it says nothing about how reliable a team's first few games are, which is the case this change shows.

## Review focus for Codex
Whether anything else relied on the old minimum of 8 (for example the highlighted panels).

## Open questions for the owner
None.

## Owner walkthrough
On a team's Advanced stats page, the grey "Team" columns used to stay empty until a team had played at least eight games in a situation, which is why you saw "too few games". They now fill in from the first game. Each grey column heading shows how many games it is based on, for example "Team Back-to-back (2)", so you can see at a glance that the number comes from two games. A cell with no games at all says "no games yet". The league columns are the same as before. The grey numbers are for tracking how this team's season is going, not for predicting the next game.
