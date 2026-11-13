# Release 030: meetings fill from last season only

Date: 2026-11-13 (UTC)
Branch / PR: `feat/meetings-last-season` (PR number added after opening)
Author: (Claude Code)

## What changed
- In the "Against an opponent" panel, games from **older than last season are no longer shown**. When there are fewer than 7 meetings this season, the table is topped up with **last season's meetings only**, each tagged `Last season · 2025-26`, dimmed and separated by the dashed line, as before.
- With no meeting this season, the table shows last season's meetings (up to 7). If there are none this season or last, it says so: "No games against LAL in 2026-27 or last season."
- If he has some meetings this season and none last season, the table is just this season's (no "plus 0 from last season").
- Changed on the owner's answer to the open question in release 029.

## Why
The owner chose "fill it with the last season", so a player's older history no longer appears in the table.

## How to verify
- `cd app && npm test`: **97 passed** (new or rewritten: fill from last season only, older seasons dropped, fill stops at 7, only-older gives none with the season named, some-this-season-and-none-last is plain, and the wording for each case). `npx tsc -b`, `npx oxlint`: clean.
- Real data, Jalen Brunson: BOS regular season = 1 this season + 4 from last season (5 rows, the 2 older rows are gone); LAL regular season = his 2 meetings from last season; BOS playoffs = 6 from the 2024-25 playoffs; CLE playoffs = the 4 from the latest playoffs; LAL playoffs = none. Whole page in a simulated browser: 14 of 14.
- **Not done:** not deployed; nobody has seen it in a real browser.

## Files changed
- `app/server/queries.mjs` (the choosing logic), `app/src/lib/meetings.ts` (the sentence and tag), `app/src/types.ts`, `app/src/components/Meetings.tsx` (comment), `app/tests/queries.test.mjs`, `app/tests/meetings.test.mjs`, `docs/NEXT.md`.

## Risks and things I am unsure about
- The table can now be short (LAL above has only 2 rows) where earlier it showed 7. That is the owner's choice, and the sentence above the table says why.
- "Last season" in Playoffs mode means the playoffs before the latest ones.

## Owner walkthrough
- **What changed on screen:** the "Against an opponent" table never reaches back further than last season any more. If Brunson has met Boston once this season, you see that game plus his games against them from last season, tagged "Last season · 2025-26".
- **Shorter tables:** if he played a team only twice last season and not at all this season, you see those two games and the sentence above the table says so, instead of padding with older games.
- **Nothing else changed.** Pick a team, flip Regular season / Playoffs, and the rest works as before.
