# Release 040: the data routes for the Teams page

Date: 2026-11-14 (UTC)
Branch / PR: `feat/team-routes` (PR number added after opening)
Author: (Claude Code)

## What changed
- Four new routes in the app server, all read-only, all taking a three-letter team code and `?type=regular-season` (default) or `?type=playoffs` (anything else: 400):
  - `/api/teams/:team/form`: the scorecard numbers for all 15 stats from `team_form` (last-10 mean, median, p10, p90, min, max, season mean) plus the team's facts (name, games in the window, wins in the window, how many window games are from earlier seasons). A team with no playoff games gets `{"none": true}`; an unknown regular-season team gets 404.
  - `/api/teams/:team/games`: the last 10 games played, oldest first (for sparklines), from `team_game_log`.
  - `/api/teams/:team/log`: the last 15 games played, newest first (the box-score table), with the full team box score.
  - `/api/teams/:team/meetings?opp=NYK`: the team's games against one opponent, this season's if 7 or more, otherwise filled up to 7 from LAST season only (older seasons never shown), each marked this or last season. Same rule as the player page; the rule now lives in one shared function (`pickMeetings`).
- Percentages are worked out per game (made / attempts x 100, empty when there were no attempts); the games carry the same stat names as `team_form` so a sparkline can use either.
- Code: `app/server/teamQueries.mjs` (SQL and mapping), four routes in `app/server/index.mjs`. No page yet and no change to the player page. The existing `/api/teams` and `/api/teams/:team/players` are unchanged.
- The two SELECT grants (approved by the owner 2026-11-14) were run first and confirmed with `SHOW GRANTS`: the app identity can now read `team_form` and `team_game_log`, nothing more.

## Why
Release 037, step 4a: the Teams page needs its data. This is the data side only; the page (4b) comes next.

## How to verify
- `cd app && npm test`: **118 passed** (107 before, 11 new: parameters only as named values, the window sizes, only the two granted tables, the mapping, percentages, empty-not-zero, the order of games, and the meetings rule in four cases). `npx tsc -b` and `npx oxlint` are clean.
- A local server reading the **real tables** (as the owner's login, not the app identity): New York form 200 (10 games in the window, 6 wins, season FG% 43.648 and 3P% 36.242, the same numbers release 038 checked against silver); games 200 (10 games, oldest 2026-10-23, newest the 2026-11-11 loss to CLE 107-115); log 200 (15 games, box score of that game: 41-83 FG, 14-39 3P, 33 assists); meetings against CLE 200 (scope `filled`: 2 this season, 3 last season, nothing older); playoffs meetings against SAC 200 (scope `none`); playoffs form 200 (`l10Games` 10, last game 2026-06-13, i.e. last season's run); unknown team 404; lowercase team, bad type, missing or bad opponent: 400.
- **Not done yet:** the routes are not called by any page and have not been called as the app identity (the deploy after merge covers that; I will check the live routes then). Nobody has seen anything in a browser, since there is no page yet.

## Files added or changed
- `app/server/teamQueries.mjs`, `app/server/index.mjs`, `app/tests/teamQueries.test.mjs`, `docs/NEXT.md`.

## Risks and things I am unsure about
- The regular-season last-15 window runs into last season while a team has played fewer than 15 games this season (New York has 11), as the player page does; the games carry their season label so the page can show it.
- A team's playoff window can be from an old season (like the player page); `lastGameDate` says so and the page must too.
- The team picker will reuse `/api/teams` (a list built from players), which is fine for 30 teams; it can move to the team tables later.

## Review focus for Codex
(Only if the owner asks.) Parameter use in the SQL, and that the meetings rule matches the player page.

## Open questions for the owner
None.

## Owner walkthrough
- **What changed:** behind the scenes only; the page looks the same. The app can now answer team questions: "how has this team shot over its last 10", "show its last 15 games", "how did it do against that team".
- **What to check yourself:** nothing yet. The Teams page (next step) will be the first thing you see.
