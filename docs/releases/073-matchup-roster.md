# Release 073: Opponent in the address, matchup strip, roster with last-10 averages

Date: 2026-11-20
Branch / PR: feat/matchup-roster
Author: (Claude Code)

## What changed (UX plan, `docs/ux-review.md`; owner decisions of 2026-11-20)
- **Opponent in the address:** `#/teams?team=CHA&opp=ATL` (also carried by Players and Predictions links). Same strict check as the team (three capital letters, anything else ignored; an opponent equal to the team is dropped). Pages that rewrite the address keep the opponent that is in it.
- **Today's games:** each team name and a **Roster** button (replacing the Players button) open the Teams page with the OTHER team in the game as the opponent; Roster also scrolls to the roster.
- **Teams Overview:** a matchup strip ("CHA vs ATL", with a Clear opponent button); the "Against an opponent" panel starts already filled with the last 10 meetings; a **roster table** under it: each player's last-10 averages (minutes, points, rebounds, assists, 3-pointers, blocks, steals) and "Starts" (games started of his last 10 played), starters first; a name opens his Players page with team and opponent kept. On a phone the name is pinned and the table scrolls sideways with a hint. Regular season only (playoffs show one line saying so).
- **Players page:** the opponent picker starts from the address (so the meetings panel is already set).
- Server: new `/api/teams/:team/roster` (one fixed query on `player_form` plus `player_season_games`; no new table or grant). Files: `app/server/queries.mjs`, `app/server/index.mjs`, `app/src/lib/pages.ts`, `app/src/lib/roster.ts`, `app/src/components/TeamRoster.tsx`, `TeamsPage.tsx`, `App.tsx`, `TodayPage.tsx`, `PageSwitch.tsx`, `TeamTabs.tsx`, `types.ts`, `api.ts`, `app/tests/matchup.test.mjs`.

## How to verify
- tsc, oxlint, build clean; 210 tests pass (address helpers, links, the roster query shape and mapping, the text format).
- Real data, simulated browser (CHA vs ATL): strip, picker pre-set, meetings loaded without choosing, address keeps the opponent; **16 of 16 roster rows match an independent last-10 calculation from the game rows (0 mismatches)**, starters first; every name links with team and opponent; clicking Brandon Miller opens his page with ATL chosen; Clear opponent removes it; Today's Roster buttons and name links point each side of a game at the other. 10 of 10 pass.
- Looked at laptop and a true phone-size (390px) screenshot; the phone table showed only part of MIN at first, so it was tightened (shorter "10/10", smaller text, wrapping names).

## Risks
- The opponent now travels and pre-fills the **meetings panels**, but the player cards, hexagons and Predictions do not change with it yet (that is the universal filter, next).
- "Players" on Today's games is now "Roster" and goes to the Teams page, per the owner's "roster flow and button"; the old route to the Players page is now through a roster name.
- Starts use `played` games only and the roster is this season's players (same rule as the player picker); a player traded mid-season shows on his latest team.

## Owner walkthrough
From Today's games, click a team's name or its new Roster button. You land on that team's page already set against its opponent: a strip says "CHA vs ATL", the "Against an opponent" panel already lists the last 10 meetings, and under it is the team's roster with each player's last-10 averages and how many of those games he started. Click a player to open his page, still set against that opponent. "Clear opponent" resets it.
