# Release 046: the chosen team carries between Players and Teams, and Teams opens first

Date: 2026-11-14 (UTC)
Branch / PR: `feat/team-carry-over` (PR number added after opening)
Author: (Claude Code)

## What changed
- **The chosen team carries over.** The chosen team is written into the address (`#/teams?team=BOS`, `#/players?team=BOS`), and the Players | Teams links include it, so choosing Boston on one page and clicking the other page's button shows Boston there. Picking a different team on either page updates the address (without adding back-button steps).
- **Teams is the first page.** An empty address, or one the page does not recognise, now opens the Teams page (on New York unless the address names a team). `#/players` still opens the Player page.
- Because the team is in the address, a link or bookmark to a team's page works (`#/teams?team=MIA`); this is also what the planned landing page will link to. An address with a team that is not in the list (a typo) falls back to New York and the address is corrected. Only three capital letters are accepted from the address.
- Not carried (on purpose, ask if you want it): the Regular season / Playoffs choice and the Averages / Box scores view. Each page still starts on Regular season and Averages.

## Why
The owner asked for the selected team to carry over between the two pages and for the Teams page to load first.

## How to verify
- `cd app && npm test`: **136 passed** (133 + 2 from release 044 + 1: the address parsing and building, only valid teams accepted, a link built from an address gives the same team and the other page, and Teams as the default). `npx tsc -b`, `npx oxlint`, `npm run build`: clean.
- **Both pages in a simulated browser against the real tables, 11 of 11:** an empty address opens Teams on New York and writes `#/teams?team=NYK`; choosing Boston writes `#/teams?team=BOS` and the Players link then points at `#/players?team=BOS`; clicking Players shows the Player page with Boston selected (Jayson Tatum first, address `#/players?team=BOS`); choosing Miami there updates the address and the Teams link; clicking Teams shows Miami Heat; a link to `#/players?team=SAS` opens the Player page on San Antonio; `#/teams?team=ZZZ` falls back to New York and the address is corrected.
- **Not done:** not seen in a real browser; not deployed (merging deploys).

## Files changed
- `app/src/lib/pages.ts` (address parsing, building and remembering), `app/src/components/PageSwitch.tsx`, `app/src/Root.tsx`, `app/src/TeamsPage.tsx`, `app/src/App.tsx`, `app/tests/teamPage.test.mjs`, `docs/NEXT.md`.

## Risks and things I am unsure about
- The address is rewritten (not added to) as teams are picked, so the back button goes to the previous page, not the previous team. That is deliberate; say if you want each team to be a back-button step.
- Someone who bookmarked the old default (the empty address) will now land on Teams, not Players.

## Review focus for Codex
(Only if the owner asks.) That the address is the only input (`parseHash`) and is validated before use.

## Open questions for the owner
1. Should the Regular season / Playoffs choice also carry over between the pages?

## Next (planned, not built): the "Today's games" landing page
The schedule data already holds, per game, the date, both teams, whether it is final and the final score. **It has no tip-off time**, so the page can list the day's games, show scores for finished ones, and link each team, but cannot say "7:30 PM".
1. **Gold table `game_slate`** (PySpark, with gates, warnings, tests and corrupted-copy checks like the others): every game of the latest season (not only the next week, so nothing is deleted day to day and the delete guard is not an issue), from silver `game`: game id, date, season type, both teams' ids and codes, final flag and scores. One new table and **one new SELECT grant** for the app identity; the exact statements will be shown and each needs a yes.
2. **The landing page** (`#/today`): today's games in US Eastern time (or the next game day when there are none), each game a card with both teams; clicking a team opens its Teams page (`#/teams?team=XXX`); each team also gets a **Team** and a **Players** button (Teams page / Player page for that team).

## Owner walkthrough
- **What you will see:** open the app and you land on the Teams page. Pick Boston, click "Players" in the top right, and the Player page opens already on Boston. Pick a Miami player's team there, click "Teams", and you are on Miami Heat. The web address changes as you pick teams, which is how it remembers; you can copy it to open the same team later.
- **What to check yourself:** try the switch a few times in both directions, on a phone too.
