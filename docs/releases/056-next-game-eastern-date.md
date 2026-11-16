# Release 056: "Next game" follows the US Eastern date

Date: 2026-11-16
Branch / PR: fix/next-game-eastern-date
Author: (Claude Code)

## What changed
- On the Teams > Advanced stats tab, a team's "Next game" is now the first unplayed game dated today or later in US Eastern time. A game stays "next" until Eastern midnight after its date, then the following game takes over.
- Before: the page compared the game date with yesterday's UTC date (`current_date() - 1`), so a game that had been played could stay "next" for up to about 24 hours after its Eastern date, until its box score arrived.

## Why
Seen after release 053 went live: NYK's next game still read "Nov 15 at TOR" at 21:40 Eastern on Nov 15 (UTC date already Nov 16) and would have kept reading it long after the game ended. The owner asked for the fix.

## How to verify
- `npm test`: 158 passed (one new test pins the Eastern-date rule and that `current_date()` is not used).
- Real data, read-only, against `game_context`, with the clock set in the query: real clock (Nov 15, 9 PM Eastern) -> Nov 15 at TOR; simulated 2026-11-16 03:00 UTC (10 PM Eastern Nov 15) -> Nov 15 at TOR (still "next"); simulated 06:00 UTC (1 AM Eastern Nov 16) -> Nov 17 at TOR; simulated 23:00 UTC Nov 16 -> Nov 17 at TOR.
- After merge, the deploy run is checked before saying it is live.

## Files added or changed
- `app/server/contextQueries.mjs` (the query), `app/tests/context.test.mjs` (one test), `docs/releases/056-next-game-eastern-date.md`.

## Risks and things I am unsure about
- The source has no tip-off times, so a game that finished in the evening still reads "next" until Eastern midnight; it just no longer lasts longer than that.
- An unplayed game dated before today (a postponement, or a late box score) is skipped rather than shown; the following game is shown instead.

## Review focus for Codex
`from_utc_timestamp` use and the `>=` boundary on the Eastern date.

## Open questions for the owner
None.

## Owner walkthrough
The "Next game" box on the Advanced stats tab used a clock set to UTC, a few hours ahead of New York, so it kept showing a game that had already been played. It now uses New York's calendar, the same one the schedule uses. A game remains the "next game" until midnight New York time on its date, and then the following game appears. Only one query changed.
