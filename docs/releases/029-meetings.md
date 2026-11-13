# Release 029: games against an opponent (the meetings panel)

Date: 2026-11-13 (UTC)
Branch / PR: `feat/meetings` (PR number added after opening)
Author: (Claude Code)

## What changed
- **A new panel, "Against an opponent"**, under the season chart. Pick an opponent from the dropdown (the 29 other teams) and it lists the player's games against that team: date, season, the game (`NYK vs BOS` or `NYK @ BOS`) and the six stats (PTS, REB, AST, 3PM, BLK, STL).
- **How many games:** every meeting from the current season if there are 7 or more. If there are fewer, the list is **filled up to 7 with his most recent earlier meetings, last season first**. If there are none this season, it is simply the last 7 meetings.
- **Earlier-season games are obvious:** each carries a badge in the Season column (`Last season · 2025-26`, or the season such as `2023-24` for older ones), shows the year in its date, is dimmed, and a dashed line marks where the earlier games start. A sentence above the table says it in words, for example: "1 game against BOS in 2026-27, plus 4 from last season and 2 from older seasons to fill it out. The earlier games are marked."
- It follows the page's Regular season / Playoffs toggle (the two are never mixed), and the chosen opponent is kept when the toggle or the player changes. Nothing is shown until an opponent is chosen.
- New server route `GET /api/players/:id/meetings?type=&opp=` (a missing or malformed opponent is a 400). It reads `player_season_games`: **no new table, no new grant.** The `player_vs_opponent` gold table is dropped until a screen needs it.

## Why
The owner asked for as many games as possible from this season against an opponent, filled in from last season when there are few, with the earlier games clearly marked. The owner also asked for the last 5 to 7 meetings when the player has not played that team this season.

## How to verify
- `cd app && npm test`: **96 passed** (80 before; 16 new). New: the query's safety (named parameters only, one table, one game type, played games only, capped), its column order, `previousSeasonLabel`, the choice of games (7 or more this season: all and nothing earlier; fewer: topped up to 7 newest first with each game marked this/last/older; none this season: the last 7; never met: none), nulls and booleans, and the wording above the table.
- `npx tsc -b`, `npx oxlint`: clean.
- **On real data** (Jalen Brunson): BOS regular season gives 1 game this season plus 4 from last season and 2 older (7 rows); LAL regular season gives the last 7 (none this season); CLE playoffs gives 4 from the latest playoffs plus 3 earlier; LAL playoffs is "never met".
- **Whole page in a simulated browser against real data: 14 of 14** (the script is not in the repo): the picker starts empty and lists 29 teams, the table rows equal the route's, earlier rows carry the badge and are dimmed with the year, the toggle keeps the opponent.
- **Not done:** nobody has seen it in a real browser, and it is not deployed.

## Files added or changed
- `app/server/queries.mjs`, `app/server/index.mjs`: the meetings query, the choosing logic, the route.
- `app/src/components/Meetings.tsx` (new): the picker and the table. `app/src/lib/meetings.ts` (new): the sentence above the table and the season badge.
- `app/src/App.tsx`, `app/src/api.ts`, `app/src/types.ts`: the opponent choice, the fetch and the panel.
- `app/tests/queries.test.mjs`, `app/tests/meetings.test.mjs` (new): the tests.
- `docs/NEXT.md`.

## Risks and things I am unsure about
- **How far back the fill goes.** The fill takes the most recent earlier meetings, so when last season had too few it reaches into older seasons (BOS above: 4 from last season, 2 older). Those are marked as older seasons, but if the owner wants "last season only", it is a one-line change.
- "This season" in Playoffs mode means the latest playoffs, so "last season" there means the playoffs before it.
- A team that changed its abbreviation in the past is matched by its team id; this has not been tried on such a team.
- The look (badge, dimming, dashed divider) is a best guess and unseen.

## Later
- Opponent-level summary (averages and ranges against a team) is the dropped `player_vs_opponent` table; build it only if a screen needs it.
- A last-10-games table for the same panel style; range pills.

## Review focus for Codex
- `mapMeetings` and the SQL's `is_current` and `current_season` columns: "this season" and "last season" for each game type.

## Open questions for the owner
1. Fill from older seasons too when last season has too few, or last season only?
2. After you look: is the badge and dimming clear enough?

## Owner walkthrough
- **What you will see:** below the season chart, a new box titled "Against an opponent" with a dropdown. Choose a team, for example Boston, and a table appears with the player's games against them: the date, which season, who was home, and his points, rebounds, assists, threes, blocks and steals.
- **How it fills:** if he has played that team at least 7 times this season you see only those. If he has played them fewer times, the table is filled up to 7 with earlier games, newest first, starting with last season.
- **How you tell the old games apart:** the earlier games are dimmer, show the year in the date, have a small tag like "Last season · 2025-26" and are separated by a dashed line. The sentence above the table also says how many games came from where.
- **Regular season / Playoffs:** the page's toggle switches the table between the two; they never mix. Your chosen team stays selected when you switch.
- **What each new file does:** `Meetings.tsx` draws the box and the table; `meetings.ts` writes the sentence and the tag; the changes in `queries.mjs` and `index.mjs` fetch the games and decide which ones to show.
