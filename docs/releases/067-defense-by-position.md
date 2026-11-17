# Release 067: Defense by position (Teams > Advanced stats)

Date: 2026-11-17
Branch / PR: feat/defense-grid
Author: (Claude Code)

## What changed
- New route `GET /api/teams/:team/defense?type=` (`app/server/defenseQueries.mjs`) and a new panel "Defense by position" at the bottom of the Teams > Advanced stats page.
- The panel groups the OPPONENT's players who played against the team as **starters** (started the game) and **bench**, by the **position the roster lists** (G, G-F, F-G, F, F-C, C-F, C, as written; "Not listed" when the roster has none). 16 rows.
- For one stat at a time (switch: points, rebounds, assists, 3-pointers, blocks, steals) each row shows: opposing player-games, the group's combined total per game against this team, the league figure, the difference, the 10th-90th range of the per-game total, per 36 minutes, the league per 36 and its difference.
- Per game = the group's combined total in one defended game, averaged over all the team's defended games (a game where the group had nobody counts as 0). Per 36 = the group's total over its total minutes, times 36. The team figures are its newest season of the game type; the league figures are every team over every season on record.
- Rows with fewer than 10 opposing player-games are muted and marked "few". The panel loads on its own, so a slow answer never holds up the rest of the page. The note is five bullets and says plainly that it has not yet been tested whether a team's pattern by position repeats.

## Why
Owner request (2026-11-17), the defense grid of NEXT item 30b with two owner decisions: use the listed position as is, and use "starter" (started the game) instead of "star". It reads the new `player_season_position` table (release 066).

## How to verify
- `npx tsc -b`, `npx oxlint`: clean. `npm test`: 185 passed (SQL shape and parameters, row mapping and order, thin-group rule, differences and missing values, number formats).
- Reconciliation on real data (separate query): across all 12,708 regular-season games the opposing players' points add up exactly to the team's points allowed (0 differences); NYK 2026-27 allows 104.0 per game and the league 113.8, both matching `team_game_log`; one cell by another route (NYK starting guards, 408 points in 13 games = 31.4 per game) equals the app's number.
- Simulated browser on real data (13 of 14 checks pass): 16 group rows under Starters and Bench; NYK starter G reads 27 player-games, 31.4 per game, league 29.6, +1.8; "few" appears on exactly the rows under 10 player-games; Blocks shows two decimals; choosing Boston loads Boston's grid; Playoffs gives no panel for a team with no playoff games without crashing. The 14th check (per-36 difference) failed only because my expected number used rounded values; from the raw numbers (17.5478 vs 19.0905) the page's -1.5 is right.
- After merge the deploy run is checked before saying it is live.

## Files added or changed
- Server: `app/server/defenseQueries.mjs` (new), `app/server/index.mjs`.
- App: `app/src/components/DefenseGrid.tsx` (new), `app/src/lib/defense.ts` (new), `app/src/TeamsAdvancedPage.tsx`, `app/src/api.ts`, `app/src/types.ts`.
- Tests and docs: `app/tests/defenseQueries.test.mjs`, `app/tests/defense.test.mjs`, `docs/NEXT.md`, this note.

## Risks and things I am unsure about
- **Not tested for repeatability.** A team's defense by position may be mostly noise over a part of a season, as the earlier splits were. Step 3 (the stability check) is the next piece; until then the panel says it is "what has happened so far".
- **Thin groups.** The hyphenated labels have few player-games (NYK this season: 4 to 5 per row), so per-game figures are lumpy and the 10th-90th range is mostly zeros. The "few" mark and the player-games column say so; the threshold of 10 is my choice.
- **Roster labels are season-long bio labels,** not the role a player had in a game; about 8% of played games have no label ("Not listed").
- **Starter or bench is not a defender assignment:** the table shows who scored against the team, not who guarded them (that needs matchup data we do not have).
- **Early season:** the team side is the newest season only (13 games for most teams now), so most rows are small until the season matures. The league side is every season.
- Not seen in a real browser (only a simulated one).

## Review focus for Codex
The SQL in `defenseQueries.mjs`: the zero-filling cross join (every group counted in every defended game) and the grouping key for the starter/bench split.

## Open questions for the owner
Whether the "few" threshold (10 opposing player-games) should be higher or lower, once you have seen it.

## Owner walkthrough
At the bottom of a team's Advanced stats page there is now a table called "Defense by position". It answers: when this team defends, how much do the other team's starting guards, starting forwards, starting centers and their bench players score, rebound, and so on, compared with what a typical team gives up to the same kind of player? Use the buttons above the table to change the stat. "Difference" is this team minus the league, so a plus means the team gives up more to that group. Rows tagged "few" rest on only a handful of games and should be read lightly. The position is the one the team roster lists for the player, written as it appears (so a guard-forward is its own row), and "Not listed" is players the roster has no position for. We have not yet checked whether a team's pattern here holds up from one stretch of a season to the next, so treat it as a description of what has happened so far.
