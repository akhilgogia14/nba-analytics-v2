# Release 050: Today's games opens first

Date: 2026-11-14
Branch / PR: feat/today-first
Author: (Claude Code)

## What changed
- The app now opens on **Today's games**. An empty or unknown address (`#`, `#/`, `#/other`) opens it; `#/teams` and `#/players` still open their own pages, with the chosen team carried as before.
- The header buttons are now in the order Today's games, Teams, Players.

## Why
The owner asked for it ("make it the first page") after the page went live (release 049).

## How to verify
- `npx tsc -b`, `npx oxlint`, `npm test` (146 passed; the address tests now expect `today` for an empty or unknown address and `teams` for `#/teams?x=1`).
- Simulated-browser run on real data (17 checks, all passed): an empty address shows today's 5 games with the Today button selected; the buttons read "Today's games | Teams | Players"; `#/teams` still opens Teams; the earlier 15 checks (day arrows, toggle, team links, Players buttons) still pass.
- The deploy run after merge is checked before saying it is live.

## Files added or changed
- `app/src/lib/pages.ts`: which page an address means (default `today`). `app/src/Root.tsx`: comment only. `app/src/components/PageSwitch.tsx`: button order.
- `app/tests/teamPage.test.mjs`, `app/tests/slate.test.mjs`: the default changed. `docs/releases/050-today-first.md`, `docs/NEXT.md`.

## Risks and things I am unsure about
- Old bookmarks to the bare address now land on Today's games, not Teams (`#/teams` bookmarks are unaffected).
- A mistyped address such as `#/team` now shows Today's games instead of Teams.
- When Today's games has no games on a day (off-season), the first screen says so and the arrows and buttons still work.

## Review focus for Codex
`parseHash` default and the tests that pin it.

## Open questions for the owner
- Should the Regular season / Playoffs choice carry between pages? (still open)

## Owner walkthrough
When you open the app it now starts on the list of today's games. The header has three buttons in this order: Today's games, Teams, Players. Nothing else changed: every page works as before, and links such as a team's name still jump to its Teams page. The only file that matters is `pages.ts`, which decides which page an address means.
