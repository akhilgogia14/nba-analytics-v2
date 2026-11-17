# Release 064: "Against an opponent" shows the last 10 meetings, however far back

Date: 2026-11-17
Branch / PR: feat/meetings-last-10
Author: (Claude Code)

## What changed
- On the Players page and the Teams page, the "Against an opponent" table now shows the last 10 meetings with the chosen opponent, newest first, from any season. Before: all of this season's meetings, topped up to 7 from last season only (release 030).
- Games from earlier seasons are tagged "Earlier · 2024-25" in the Season column, dimmed, and set off by a dashed line; the current season's games are plain.
- The words above the table say what you are looking at, for example "The last 10 games against BOS: 1 in 2026-27, plus 9 from earlier seasons (2023-24 to 2025-26), which are marked." If fewer than 10 meetings exist in the data (it starts in 2021-22), it says "All N ... on record".
- Regular season and playoffs are still never mixed: the table follows the page's game-type switch and reads one game type only.
- One shared rule (`pickMeetings`) now serves both pages; the old "last season only" code is gone.

## Why
The owner asked (2026-11-17): "for against opp can we please have the last 10 meeting regardless how far it has to go back". This reverses the 2026-11-13 decision that only last season could fill the table.

## How to verify
- `npx tsc -b`, `npx oxlint`: clean. `npm test`: 173 passed (the old tests that pinned "7" and "last season only" were rewritten: the SQL asks for 10 and does not restrict by season, 10 is the cap, fill from any earlier season, the oldest game is the one cut, fewer than 10 shows all, never met gives none, the note wording on both pages, the new tag).
- Real data through a local server: Jalen Brunson vs BOS (regular season) returns 10 games, one from 2026-27 and the rest back to 2023-24, newest first; vs TOR 10 games back to 2024-25; NYK as a team vs BOS the same ten games; playoffs vs BOS returns the 6 playoff games of 2025 and no regular-season games.
- Simulated browser on real data (7 of 7 checks): the player table has 10 rows (9 tagged earlier, 1 dashed separator), the note reads as above, the Playoffs switch gives only playoff games, and the team table matches.
- After merge the deploy run is checked before saying it is live.

## Files added or changed
- Server: `app/server/queries.mjs` (the limit and `pickMeetings`/`mapMeetings`), `app/server/teamQueries.mjs`.
- App: `app/src/lib/meetings.ts` (the wording), `app/src/lib/teamPage.ts`, `app/src/types.ts`, comments in `app/src/components/Meetings.tsx` and `TeamMeetings.tsx`.
- Tests and docs: `app/tests/queries.test.mjs`, `app/tests/teamQueries.test.mjs`, `app/tests/meetings.test.mjs`, `app/tests/teamPage.test.mjs`, `docs/NEXT.md`, this note.

## Risks and things I am unsure about
- Not seen in a real browser (only a simulated one).
- Rosters and teams change, so an old meeting can feature a different supporting cast, and a player's old meetings may be for another team; the table still shows the team the player played for in each game. Old games are dimmed and labelled with their season so this is visible.
- In Playoffs mode the "current" season is the newest season with any playoff game, so last spring's playoffs count as "the current season" until the next playoffs begin.
- The data starts in 2021-22, so a matchup with few meetings (especially in the playoffs) shows fewer than 10.

## Review focus for Codex
Whether anything else still relies on the old `kind === 'last'` value or the removed `MEETINGS_MIN` and `MEETINGS_LIMIT` constants.

## Open questions for the owner
None.

## Owner walkthrough
On the Players page and the Teams page, pick an opponent in the "Against an opponent" box. You now always get that opponent's last 10 meetings, going back as many seasons as it takes, instead of only this season plus a few from last year. Games from earlier seasons show a small "Earlier · 2024-25" tag, appear a bit faded, and a dashed line shows where the current season ends. The sentence above the table tells you how many are from this season and which seasons the rest come from. If two teams have met fewer than 10 times since 2021-22, you see all of them. Regular-season and playoff games stay separate, following the switch at the top of the page.
