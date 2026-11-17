# Release 063: bullet-point note and a back-to-back count on the Players Advanced tab

Date: 2026-11-17
Branch / PR: feat/players-note-and-b2b-line
Author: (Claude Code)

## What changed
- On Players > Advanced stats, "How to read this" is now five short bullets instead of a paragraph: league columns, player columns, last row, what we tested, and "games are compared as played".
- The "Tested" bullet carries the evidence from the stability check (release 062): over five seasons, a player's own split in one half of a season did not predict the other half, so the player columns are context, not a trait and not a forecast.
- The next-game panel has one more line: "Back-to-backs so far this season: played N of M team games" (or "Playoff back-to-backs ..."). It is a plain count, never a rate or a label, because availability on back-to-backs is the one personal signal that repeated a little (r +0.20 to +0.25) and it mixes habit with injury. Nothing is shown for a player whose team has had no back-to-backs yet.

## Why
The owner asked (2026-11-17) for the stability result to reach the page and for the note to be quick and easy to read as bullets.

## How to verify
- `npx tsc -b`, `npx oxlint`: clean. `npm test`: 174 passed (one new test for the count line: wording, "Playoff" prefix, singular "team game", empty when there are no back-to-backs, and no words like "rest", "%", "tends" or "usually").
- Real data, simulated browser through a local server: 18 of 18 checks pass, including five bullets with the evidence sentence, and the line reads "Back-to-backs so far this season: played 2 of 2 team games" for Jalen Brunson (same figure as the route and the table).
- After merge the deploy run is checked before saying it is live.

## Files added or changed
- `app/src/PlayersAdvancedPage.tsx`, `app/src/lib/playerContext.ts`, `app/tests/playerContext.test.mjs`, `docs/releases/063-players-note-and-b2b-line.md`.

## Risks and things I am unsure about
- Not seen in a real browser; the bullets are plain text in the page's muted colour.
- The Teams Advanced tab still has its own paragraph note; I left it as it was. Making it bullets too is a small follow-up if wanted.
- The count line counts all of the team's back-to-backs in the player's grid, including games before a traded player arrived and games missed to injury, like the "Share of team games played" row.

## Review focus for Codex
Whether the count line should be hidden for players with fewer than a few back-to-backs.

## Open questions for the owner
- Same bullet style for the Teams Advanced note?

## Owner walkthrough
On a player's Advanced stats page, the grey explanation paragraph is now five short bullets you can scan in a few seconds: what the league columns mean, what the player columns mean, what the last row means, what we tested (a player's own splits did not repeat across half-seasons, so treat them as context), and a reminder that opponents mix in. Under the player's name and next game there is one new line, such as "Back-to-backs so far this season: played 2 of 2 team games". It only counts what happened; it does not say the player rests on back-to-backs.
