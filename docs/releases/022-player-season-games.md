# Release 022: `player_season_games` (the grid behind the season hexagon chart)

Date: 2026-11-13 (UTC)
Branch / PR: `feat/gold-player-season-games` (PR number added after opening)
Author: (Claude Code)

## What changed
- New gold table `workspace.nba_v2_gold.player_season_games`, written in PySpark: **one row per player, per team, per team game**. It is the data behind the planned chart where each hexagon is one game of a season (coloured if the player played, grey if not).
- **Who gets a grid:** a player gets a grid for a team, season and game type if he played at least one game of that type for that team that season. The grid is then **all** of that team's games of that type that season, even if he played only one. Games he missed are filled in from the team schedule (`played = false`, stats empty).
- **Traded players** get a full grid for each team they played for, and `other_teams` names the other team(s) (for example `WAS`) so the page can show a note.
- **Game types are never mixed:** regular season, playoffs, play-in and NBA Cup are separate grids, each numbered from game 1.
- **"Played" rule (owner's, 2026-11-13):** any minutes, OR any box-score stat above 0, OR a non-zero plus/minus. Otherwise it is a did-not-play. This is wider than silver's own `played` flag (minutes above 0 only); the two differ on **4 rows** out of about 177,000 (players with 0:00 minutes but a stat). Silver is unchanged.
- Real data: **288,143 rows, 5,361 grids, 1,085 players** (regular season 275,540 rows; playoffs 11,864; play-in 670; NBA Cup 69). 144,826 rows are played games = the 144,822 in `player_game_log` plus those 4.
- Columns: ids, `season_label`, `game_type`, `player_name`, the game (`game_date`, `opponent_*`, `is_home`), `game_number` and `team_games` (place within the team's games of that type that season), `played`, `minutes`, `pts`, `reb`, `ast`, `fg3m`, `blk`, `stl` (empty when not played), `other_teams`.

## Why
The owner wants a season chart on the player page: one hexagon per team game (82 in a season), coloured by the stat, a border when the player beat their average, grey when they did not play, and a tooltip with the value and opponent. Silver only has a row for a missed game some of the time (Luka Doncic, 2025-26: his team played 82 games, silver has 65 rows for him, so 17 missed games have no row). The grid has to come from the team schedule.

## Decisions made without the owner
- Play-in and NBA Cup get grids too (same rule), so the page can offer them later. Regular season and playoffs are the ones planned for the page.
- The "other team" note only compares teams within the same season **and** game type (a player traded before the playoffs has a playoff grid for the new team only).
- The table has no "season average" column. The chart's "hit their average" border can be worked out in the app from the played rows (or added here later); which average (mean or median) is still the owner's call.

## How to verify
- `.venv/bin/python -m pytest -q`: **96 passed** (86 before). The 10 new tests use hand-worked values: a player who plays games 1, 2 and 5 of a 5-game season (plus a did-not-play row for game 3 and no row for game 4) gets 5 rows, played True/True/False/False/True, stats empty on the two missed games; a one-game player gets the whole 4-game grid; a traded player gets 4 + 3 rows with notes `BBB` and `AAA`; three teams list the other two alphabetically; the played rule (a rebound with 0 minutes, only a plus/minus, only a foul, minutes with no stats = played; nothing at all = not played); regular season and playoffs never mix and numbering restarts; separate seasons are separate grids with no cross-season note; a player who never played gets no grid; the latest name wins.
- Real data through Databricks Connect, read-only, before any write: all **14 gates pass** on the real output (source rows 288,143). Spot checks: Luka Doncic 2025-26 regular season = 82 rows for LAL, 64 played (silver minutes above 0: 64); AJ Johnson has an 82-game grid for DAL (23 played) and one for WAS (25 played), each noting the other team; Danilo Gallinari 2023-24 has three grids (WAS, DET, MIL).
- **22 corrupted copies of the real output** (duplicate row, null key, wrong game type, wrong season label, a row dropped, wrong opponent, date or home flag, wrong game number or team-game count, a whole grid with no played game, a played flag flipped either way, a played row dropped, a whole grid dropped, points +1, a missed game given a stat, minutes +1, a wrong, dropped or invented `other_teams`, a wrong name) each fired the expected gate; the untouched output fires none. Several corruptions also fire neighbouring gates (they overlap on purpose).
- Warnings on the real output: `completed_season_grid_not_82_games` fires 0 times (every completed season's regular-season grid has 82 games); `three_or_more_teams_in_one_season` fires for 89 grids (players with three or more teams in one season).
- **Real job run** (`databricks bundle deploy` from this branch, then `databricks bundle run silver_build`, 2026-11-13 16:05 UTC): `gold player_season_games` source rows 288,143, gates on source and on the table pass, inserted 288,143, updated 0, deleted 0, 89 new oddities logged (the three-or-more-teams warning), run_id `2026-11-13T160545Z`. The other four gold tables: 0 inserted, 0 updated, 0 deleted. Read back from the real table: Luka Doncic 2025-26 regular season = 82 rows, 64 played. The app identity was then granted `SELECT` on the table (owner approved; read back: `SELECT TABLE workspace.nba_v2_gold.player_season_games`). The app does not read it yet.

## Files added or changed
- `scripts/gold_player_season_games.py` (new): the PySpark table.
- `sql/gold/player_season_games_gates.sql` (new): 14 gates, recomputed from silver in plain SQL with the played rule spelled out again.
- `sql/gold/player_season_games_warnings.sql` (new): two oddity warnings.
- `tests/test_gold_player_season_games.py` (new): 10 tests.
- `scripts/silver_build.py`: one new entry in `TABLES` (key `person_id, team_id, game_id`, a Python table).
- `docs/NEXT.md`: step 16.

## Risks and things I am unsure about
- **Missed-game labels:** a grey hexagon means "no minutes and no stats", not "injured". The data does not say why on most rows, and the page should not claim a reason.
- **Trades:** a player's grid for the team he left shows grey for the games after the trade, exactly like a game he sat out. The note (`other_teams`) tells the reader why.
- **Ten-day and two-way players** who played one game get a full 82-game grid with one coloured hexagon. That is what was asked for, but it will look sparse.
- **Size:** about 288 thousand rows (about 19 columns). The daily job gets a little slower (the new table reads silver `player_game` and `team_game` once each); not timed.
- A game that exists in `player_game` but not in `team_game` would not appear in a grid; a gate (`played_game_missing_from_table`) would then fail the build loudly. It does not happen today.
- The silver `played` flag and this table's `played` differ on 4 rows. Nothing reads silver's flag for the chart; if you want one rule everywhere, silver would change (its rule is documented in `docs/spike-findings.md` section 9).

## Review focus for Codex
- The played rule in `played_rule()` against the gate SQL: is every stat column in both, and are NULLs treated the same?
- That a grid is exactly the team's schedule for that season and game type (join keys, season boundaries, play-in and cup).
- `other_teams`: ordering, same-season-same-type scope, and the gate's independent recompute.
- NULL handling: stats must be NULL (not 0) on missed games.

## Open questions for the owner
1. Decided 2026-11-13: the "hit their average" border uses the season **mean** (of the same season as the grid).
2. Done 2026-11-13 (owner approved): the app identity has `SELECT` on `player_season_games`. Grants live in Databricks, not in git.

## Owner walkthrough
- **What changed:** nothing you can see in the app yet. This adds one new table that holds, for every player and every team he played for in a season, a row for each of that team's games: 82 in a regular season. Games he played have his numbers (points, rebounds, assists, threes, blocks, steals, minutes). Games he did not play are listed but empty, so the chart can draw them grey.
- **Example:** Luka Doncic's 2025-26 regular season has 82 rows for the Lakers. 64 have his numbers; the other 18 are empty (17 of them were not in the source data at all, and are filled in from the Lakers' schedule). A player traded in the middle of a season has two sets of rows, one per team, and each set says which other team he was on.
- **What counts as "played":** any minutes, any stat above zero, or a non-zero plus/minus. A row with nothing at all counts as a game he missed.
- **What each new file does:** `scripts/gold_player_season_games.py` builds the table; `sql/gold/player_season_games_gates.sql` rechecks the answer from the raw tables in a different way and stops the build if anything disagrees; the warnings file lists odd-but-possible cases; the test file proves the logic on small made-up seasons.
- **What to check yourself:** the table is built. Open `workspace.nba_v2_gold.player_season_games` in Databricks, filter `player_name = 'Luka Dončić'`, `season_label = '2025-26'` and `game_type = 'regular-season'`: you should see 82 rows, 64 with `played = true`.
