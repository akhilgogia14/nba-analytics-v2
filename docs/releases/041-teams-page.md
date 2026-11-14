# Release 041: the Teams page (offense first)

Date: 2026-11-14 (UTC)
Branch / PR: `feat/teams-page` (PR number added after opening); builds on PR #53 (release 040), which must be merged first
Author: (Claude Code)

## What changed
- A separate **Teams page**, at the address `#/teams`, with the Player page's structure at team level and offense first: a team picker, the Regular season / Playoffs toggle (one game type at a time, never a mix), then either **Averages** (six scorecards with their lines) or **Box scores** (the team's last 15 games), then an **Against an opponent** panel. The page opens on Averages, like the Player page.
- Six scorecards: **Points, Field goal %, 3-pointers made, 3-point %, Assists, Turnovers**. Each has the last-10 average and median, the season average, the "vs season avg" chip, the range bar and the line of the last 10 games. Percentages are written with a % sign and are total made over total attempted across the window (the same pooling as the gold table). For **turnovers a lower number is better**, so the chip shows a drop in green and a rise in red (the opposite of the other cards).
- Box scores table: date, game, result (W or L with the score, team points first), PTS, FG and FG%, 3P and 3P%, FT, offensive and total rebounds, assists, turnovers, and an average row (games won-lost, shooting averaged as made-attempted, percentages pooled). Steals, blocks and fouls are left for the defense step.
- Opponent panel: the team's games against one opponent, this season's if 7 or more, otherwise filled up to 7 from LAST season only and marked (dimmer, dashed divider, a sentence above), with result, FG%, 3P%, 3PM, AST and TOV.
- A **Players | Teams** switch in both pages' headers. They are plain links (`#/players`, `#/teams`), so the back button and bookmarks work. The team's colours, spotlight and court-line background work exactly as on the Player page.
- Shared parts were generalised, not copied: the scorecard and the sparkline now take any stat name, an optional number format and an optional "lower is better" flag; the Player page passes none of them and behaves as before.

## Why
Release 037, step 4b: the Teams page the owner asked for ("its own page, same structure as the player page at team level, offense first, same team colours").

## How to verify
- `cd app && npm test`: **127 passed** (118 before; 9 new: the address picks the page, the six cards and their order, % formatting, result text, pooled percentages in the average row, the notes, the notices, and a sparkline for team stats with its own names and format). `npx tsc -b`, `npx oxlint` and `npm run build`: clean.
- **Whole page in a simulated browser against the real tables, 25 of 25** (a local server, the owner's login): the page opens from `#/teams` on New York; the six cards in order with a line under each; big numbers 111.3 points, 44.3% FG, 15.1 threes, 36.5% from three, 27.3 assists, 12.9 turnovers (the same values release 038 checked against silver); the Averages pill pressed; "6 won, 4 lost"; Box scores shows 15 games plus the average row and removes the cards, the newest row is the Nov 11 loss to CLE ("L 107-115", 41-83, 49.4%, 14-39, 35.9%, 11-11); switching back restores the cards; the opponent picker lists the other 29 teams; New York against CLE gives 2 games this season plus 3 from last season, marked, with the "filled" sentence; Playoffs lists the 16 playoff teams and says playoff games only; Regular season restores 30 teams; choosing San Antonio changes the team and accent; the Players link goes to the Player page and back.
- **Not done:** nobody has seen the page in a real browser (there is no browser tool here); the routes have not been called as the app identity yet (the first deploy after merging #53 and this one covers that; I will check the live routes).

## Files added or changed
- New: `app/src/TeamsPage.tsx` (the page), `app/src/Root.tsx` (picks the page by address), `app/src/components/PageSwitch.tsx`, `TeamGameLog.tsx`, `TeamMeetings.tsx`, `app/src/lib/pages.ts`, `app/src/lib/teamPage.ts` (cards, notes, average row), `app/tests/teamPage.test.mjs`.
- Changed: `app/src/main.tsx` (starts `Root`), `app/src/App.tsx` (the page switch in the header), `app/src/api.ts`, `app/src/types.ts`, `app/src/components/Scorecard.tsx`, `Sparkline.tsx`, `app/src/lib/spark.ts`, `tips.ts` (generalised), `docs/NEXT.md`.

## Risks and things I am unsure about
- Look and feel are unchecked on a real screen: the 13-column table is wide (it scrolls sideways on a phone), and the header now holds the switch next to the title.
- The team picker reuses the player-based list (`/api/teams`): 30 teams in the regular season, 16 in the playoffs. A team with no playoff games in the latest run can still be reached only in Regular season mode.
- The playoff window of a team can be from an earlier year (the notice says so); the opponent panel for playoffs only has meetings if the teams met in the playoffs.
- Data stops at the latest games the source has published (Nov 11 today).

## Review focus for Codex
(Only if the owner asks.) That the generalised scorecard changed nothing on the Player page; the lower-is-better colour logic; the percentage pooling in the table's average row.

## Open questions for the owner
1. Is the order Averages first, Box scores second right for Teams too (it matches the Player page now)?
2. Should I add steals, blocks and fouls to the box score now, or wait for the defense step?

## Owner walkthrough
- **What you will see:** two buttons in the top right, **Players** and **Teams**. Click Teams. You get a page just like the player page, but for a whole team: pick a team (New York to begin with) and the page takes that team's colours. Under the team name you see six big numbers for its last 10 games: points, how often it hit its shots, threes made, how often it hit its threes, assists and turnovers. Each has a small line of the last 10 games and a "vs season avg" arrow. For turnovers, a down arrow is green, because fewer is better.
- **The second button, Box scores:** a table of the team's last 15 games: who it played, whether it won, the score, and its shooting and rebounding for that game, with an average at the bottom.
- **At the bottom:** pick another team to see how this team has done against them. If they have met fewer than 7 times this season, the table adds last season's games (dimmer, marked "Last season").
- **The Regular season and Playoffs buttons** work as on the player page and are never mixed.
- **What each new file does:** `TeamsPage.tsx` is the team page itself; `TeamGameLog.tsx` is the box-score table; `TeamMeetings.tsx` is the "against an opponent" table; `PageSwitch.tsx` is the two buttons; `Root.tsx` decides which page to show from the address; `teamPage.ts` holds the wording and the arithmetic.
- **What to check yourself:** open the page and click through: New York, then Boston; Box scores and back; pick Cleveland as the opponent; switch to Playoffs. Tell me what looks off, especially on a phone.
