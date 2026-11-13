# Release 026: in Playoffs mode the pickers list only the latest playoffs

Date: 2026-11-13 (UTC)
Branch / PR: `feat/playoff-pickers` (PR number added after opening). **Includes PR #32 and #33's commits** (releases 024 and 025); merging any of them first is fine.
Author: (Claude Code)

## What changed
- With the page's toggle on **Playoffs**, the **Team picker lists only the teams that were in the latest playoffs** (2025-26: **16 teams**), and the **Player picker lists the players who played those playoffs for the chosen team**, most minutes first (the Knicks: 15 players, Brunson first at 36.9 minutes).
- Switching the toggle **keeps the current team and player when they are still listed**; otherwise it moves to New York (if listed) or the first team, and the player list loads for that team. Switching back to Regular season lists all 30 teams and this season's rosters again.
- The server's `/api/teams` and `/api/teams/:team/players` take `?type=regular-season|playoffs` (anything else is a 400, as for the form route). The playoff lists read `player_season_games`, which records the team a player actually played the playoffs for; the newest playoff season is looked up inside the playoff rows, so it becomes the new playoffs automatically once they start.
- The page waits for the new lists before asking for a player's data, so it never asks for a player who is not in the list.

## Why
The owner agreed that in Playoffs mode the pickers should not offer players with no playoff games (no dead ends).

## A correction to what I said before the build
I first said the latest playoffs had 28 teams. That was wrong. It came from `player_form`, where a player's team is his *current* team, so it counted teams that merely have a player with some playoff history. The table that records the playoff team (`player_season_games`) shows **16 teams** (13 to 15 players each). The owner chose to keep it as built (option 1).

## How to verify
- `cd app && npm test`: **69 passed** (66 before; 3 new). New: the playoff team and player SQL (one table, playoff rows only, the newest-playoffs-season subquery, one named parameter, `NULLS LAST` so a missing minutes figure sorts last), the same column counts as the regular lists, and the helpers that choose the SQL for the page's game type.
- `npx tsc -b`, `npx oxlint`: clean.
- Real data through the app's own server: regular season 30 teams (NYK 16 players, Brunson first); playoffs 16 teams, 13 to 15 players each, not in the latest playoffs: BKN, CHA, CHI, DAL, GSW, IND, LAC, MEM, MIA, MIL, NOP, SAC, UTA, WAS; NYK playoffs 15 players (Brunson 19 games, 36.9 minutes). A bad type is a 400 for both routes, and a bad team code is a 400.
- Whole page in a simulated browser against that server (8 of 8; the script is not in the repo): the page loads Brunson on NYK; Playoffs keeps Brunson and NYK and shows 16 teams; **every one of the 16 playoff teams opens a real playoff page for its first player** (no error, no "no playoff games" message); with Utah (not a playoff team) chosen, switching to Playoffs moves to New York with no error; switching back shows 30 teams again.
- **Not done:** nobody has seen it in a real browser, and it is not deployed.

## Files added or changed
- `app/server/queries.mjs`, `app/server/index.mjs`: the playoff lists, the helpers that choose them, the `type` parameter on both list routes.
- `app/src/api.ts`, `app/src/App.tsx`: the lists take the game type; the page keeps or moves the selection and waits for the lists.
- `app/tests/queries.test.mjs`: the new tests.
- `docs/NEXT.md`: step 20, and the later option below.

## Risks and things I am unsure about
- **Not seen on a screen.**
- **In Playoffs mode the other 14 teams and their players cannot be reached**, including older playoff history (for example Luka Doncic's 2024-25 playoff run with the Lakers, since the Lakers were not in the 2025-26 playoffs list). That is the cost of this choice. The owner wants to come back to this (see "Later" below).
- A player who is in the playoffs list but whose chart or cards have no data is not expected; the plain "no playoff games on record" message is still there as a safety net.
- Until the next playoffs start, the lists are last season's. After they start, the lists change by themselves.

## Later (owner's wish, parked 2026-11-13)
- **All 30 teams in both modes, with a team's players who have any playoff history** (so any player's older playoff runs can be reached). Needs a bigger query (a player's playoff history with that team, across seasons) and its own checks. Not started.

## Review focus for Codex
- That the playoff lists can only contain players who played a playoff game for that team that season (the grid exists only if he played).
- The page's selection logic after the toggle (keep, or move), and that no request is made for a player outside the list.

## Open questions for the owner
1. Deploy now (needs your "deploy"; it would ship #32, #33 and this together)?
2. After that, what next (see the list in my message)?

## Owner walkthrough
- **What you will see:** click Playoffs and the Team picker shrinks from 30 teams to the 16 that made last season's playoffs; the Player picker shows the players who played those playoffs for the team you choose, the most-used first. You will not be offered anyone with no playoff games.
- **If you were on a team that missed the playoffs** (say Utah) when you click Playoffs, the page moves you to New York. Click Regular season and all 30 teams are back.
- **What to check yourself:** open Brunson, click Playoffs: he stays selected and the cards show his 28.7 playoff points. Open the Team list: 16 teams, no Utah, no Dallas.
- **What is not possible yet:** looking at an old playoff run for a team that was not in the latest playoffs (for example Luka's 2024-25 run). That is parked for later.
