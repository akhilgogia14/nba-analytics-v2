# Release 019: `team_form` and `player_form` split by game type (and the app follows)

Date: 2026-11-13 (UTC; tables rebuilt 13:37 and 13:38, app redeployed 13:41)
Branch / PR: `feat/form-by-game-type`, PR #26
Author: (Claude Code)

## What changed
- `workspace.nba_v2_gold.team_form` and `player_form` now have one row per team or player, **game type** and stat. Game types: `regular-season`, `playoffs`, `play-in`, `nba-cup`. A "last 10 games" window is the last 10 games of that type, so regular-season and playoff games are never averaged together.
- `team_form`: 680 rows (30 teams; regular season 30, playoffs 28, play-in 21, NBA Cup 6; 8 stats each). `player_form`: 21,582 rows (1,085 players; regular season 1,084, playoffs 518, play-in 292, NBA Cup 68; 11 stats each).
- Removed the column `l10_games_not_regular` (always 0 once types are separate). The three-pointers/blocks/steals shares are now per game type too.
- Name, team and abbreviation come from the latest game of any type. `last_game_date`, `l10_first_date` and `last_season_label` are of that type, so an old playoff window says it is old.
- The app now reads only the regular-season rows (all three queries filter on `game_type`), so the page looks the same. The "N of these games are not regular-season games" notice is gone (it can no longer apply). A playoffs view will come later as an explicit switch.
- The old `team_form` (240 rows) and `player_form` (11,935 rows) were dropped and rebuilt (owner approved each drop). The app identity's `SELECT` on `player_form` was granted again (owner approved).

## Why
The owner's rule: a regular-season game and a playoff game must never be blended (games change in the playoffs). Release 018 did this for `team_vs_opponent`; this release does it for the two form tables, as agreed.

## Decisions made without the owner (please confirm or change)
- Play-in and NBA Cup games are their own game types, not dropped or merged.
- `total_games` on the page's data is now regular-season games only (Brunson: 374, was 454 with playoffs and others). The page does not show it today.
- The regular-season window is the last 10 regular-season games, so early in a season it still reaches back into last season (the page's existing "from before this season" notice covers that).
- `player_game_log` still has rolling "prior last 10" columns that blend game types. Nothing reads them yet; they will matter for the back-tests (modeling) and need the same split then.

## How to verify
- `.venv/bin/python -m pytest -q`: 86 passed (81 before this release) (hand-worked values for both tables, including: regular-season points 1..10 give p10 1.9 and p90 9.1; the separate playoff window of 11 and 12 gives mean 11.5; windows capped at 10 per type; a playoff window from an earlier season is labelled). `cd app && npm test`: 15 passed, type-check and build pass.
- Real-data checks through Databricks Connect before writing anything (all gates pass on the real output; every deliberate break fired the right gate):
  - `team_form`: 20 breaks, including playoffs folded into regular season (56 facts rows flagged) and game types swapped.
  - `player_form`: 21 breaks, including playoffs folded in (1,036 facts, 1,771 stats, 347 shares rows flagged). One break (dropping a player's playoff rows) printed no failure at first because I picked a player with no playoff rows; with a player who has them (id 2544, 11 rows) the gate fired.
  - Spot checks against raw tables: NYK window, regular season (10 games, 6 wins, points 111.3, allowed 103.2, 2026-10-23 to 2026-11-11) and playoffs (10 games, 9 wins, points 114.1, 2026-05-10 to 2026-06-13); Brunson regular season (374 games, window points 26.5, rebounds 2.9, threes 2.8) and playoffs (79 games, points 28.7, rebounds 3.8, threes 2.4, 2026-05-10 to 2026-06-13).
- Real job run (`databricks bundle deploy`, `databricks bundle run silver_build`): `gold player_form` source rows 21,582, gates on source and table pass, inserted 21,582 (run_id `2026-11-13T133727Z`); `gold team_form` 680, pass, inserted 680 (run_id `2026-11-13T133813Z`). 5 new oddities for `player_form` (regular-season windows spanning over 365 days: long absences); 0 for `team_form`.
- New app queries run locally on the rebuilt table: 30 teams, NYK 16 players with Brunson first, his points 26.5 / median 25.5 / 19.0 to 33.5 / low 19 / high 38 / season 26.0, threes shares 0.1, 0.2, 0.1, 0.6 (identical to before); bad team and bad id 400; unknown player 404.
- Live app after the redeploy (CLI token, deployment `01f1df67ec661d12bf89bc86d843d2dc`, SUCCEEDED, 13:41:26 UTC): same answers, same 400/404 codes, 401 without a token.

## Files added or changed
- `scripts/gold_team_form.py`, `scripts/gold_player_form.py`: windows and season blocks per game type.
- `sql/gold/team_form_gates.sql`, `player_form_gates.sql` (+ warnings): independent recompute per team or player and game type; two-way comparison for facts so a missing row also fails; a new `game_types_wrong` gate.
- `tests/test_gold_team_form.py`, `tests/test_gold_player_form.py`: rewritten for the new shape.
- `scripts/silver_build.py`: new keys for both tables.
- `app/server/queries.mjs`, `app/src/App.tsx`, `app/src/types.ts`, `app/tests/queries.test.mjs`: regular-season rows only; the not-regular notice removed; tests check the SQL and the column order.
- `docs/NEXT.md`: step 13e.

## Risks and things I am unsure about
- **The app was broken for roughly 8 to 10 minutes** (from the `player_form` drop at about 13:33 UTC until the redeploy at 13:41). This was expected and announced; the exact drop time was not recorded.
- The workspace job files come from this branch; the next daily run (16:17 UTC) deploys from `main`. Until this PR is merged that run has the old table code against the new tables and would fail on those two tables. Merge before then, or re-run the job after merging.
- Playoff windows can be old (a past season's run). The data says so through dates, but the page does not show playoffs yet.
- The app still stops about 24 hours after a deploy (Free Edition): expect a stop near 13:41 UTC on 2026-11-14. Restart with `databricks apps start nba-player-form`.
- The app's deployed copy is still a manual upload; its warehouse link and grants live in Databricks, not in git.

## Review focus for Codex
- That no code path can put two game types in one row (the window partition, the season block, the gates' recompute).
- The two-way comparison in the facts gates; the share columns per game type.
- The app queries: every one filters on game type, the minutes join matches the game type.

## Open questions for the owner
1. Next in the agreed order: the look-and-feel PR (headshots, logos, team colors, tooltips), then `player_vs_opponent`, then the data-features PR (games table, last-updated, opponent filter, playoffs switch). Still right?

## Owner walkthrough
- **What changed:** the two "recent form" tables now keep regular-season games and playoff games apart. Before, a player's "last 10 games" could mix both. Now there are separate rows for the last 10 regular-season games and the last 10 playoff games (and tiny ones for play-in and NBA Cup).
- **What the app looks like:** the same as before. It shows the regular-season rows only. The amber note about "games that are not regular season" is gone because that can no longer happen.
- **What to look at yourself:** open `workspace.nba_v2_gold.player_form` in Databricks, filter `player_name = 'Jalen Brunson'` and `stat = 'pts'`. You see up to four rows, one per game type. `regular-season` shows the last 10 regular-season games (26.5 points); `playoffs` shows his last 10 playoff games (28.7 points), with `l10_first_date` and `last_game_date` of May and June 2026, so you can see that window is last season's run.
- **How to read it:** always check the dates and `l10_games` of a row. A playoff row can be old, and a play-in or Cup row has only a few games.
- **What the files mean:** the `gold_*_form.py` files are the recipes, the `*_gates.sql` files are the independent second calculation that stops the build if the two disagree, the test files are the practice exams with answers worked out by hand, and the `app/` changes make the page read only the regular-season rows.
