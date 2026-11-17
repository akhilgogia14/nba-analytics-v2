# Release 066: gold table player_season_position (step 1 of the defense grid)

Date: 2026-11-17
Branch / PR: feat/player-season-position
Author: (Claude Code)

## What changed
- New gold table `player_season_position`: one row per player per season with the position the roster lists (G, F, C, G-F, F-C, C-F, F-G), exactly as written. Columns: `person_id`, `season`, `season_label`, `player_name`, `position`. Key (person_id, season).
- Built in PySpark (`scripts/gold_player_season_position.py`) from bronze `rosters`. Where a player has several snapshots in one season (the current season is appended each time it changes), the newest snapshot's label is used; an empty label is ignored, so a player with no usable label has no row.
- Registered in `scripts/silver_build.py`, so the daily job builds it after silver.
- Gates (`sql/gold/player_season_position_gates.sql`) and warnings (`..._warnings.sql`), recomputed from bronze and silver in plain SQL.

## Why
The defense-by-position grid (NEXT item 30b) needs each opponent player's position. The app can only read gold tables and the position lives only in bronze. Owner decisions (2026-11-17): use the listed position as it is (G-F stays its own group), and replace "star" with "starter" (a player who started the game, already in silver and gold as `started`).

## How to verify
- `pytest tests/test_gold_player_season_position.py tests/test_silver_build.py`: 28 passed (one row per player-season, newest snapshot wins, empty or null labels ignored and labels tidied, exact columns, registration, gate files present).
- Dry run on real bronze through Databricks Connect (read only): 3,000 rows (2021-22: 489, 2022-23: 474, 2023-24: 514, 2024-25: 499, 2025-26: 495, 2026-27: 529); G 1,189, F 911, C 291, G-F 235, F-C 177, C-F 116, F-G 81. All 7 gates pass, no warnings. Played regular-season games with no listed position: 8.03%, the same as the earlier probe.
- Corrupted copies: 10 deliberate breakages (duplicate row, dropped row, null key, label PG, lower-case label, null label, wrong but valid label, wrong season label, a whole season missing, an extra player-season) each fire the matching gate. A thin season (about 72% of games without a label) fires the coverage warning.
- Nothing is written to Databricks by this PR itself; the table appears when the job next runs.

## Files added or changed
- `scripts/gold_player_season_position.py`, `scripts/silver_build.py`, `sql/gold/player_season_position_gates.sql`, `sql/gold/player_season_position_warnings.sql`, `tests/test_gold_player_season_position.py`, `docs/NEXT.md`, this note.

## Risks and things I am unsure about
- The roster is one list per season, so a player traded or signed mid-season can be missing: 8% of played games (6.8% of minutes) have no listed position. The grid will show them as "Not listed" instead of guessing.
- The roster label is a bio label for the whole season, not the role played in a game. Starters and bench players of the same label can play different roles.
- The hyphenated labels make thin groups (bench F-G is about 11 games per defending team per season), so the grid will carry a games count on every cell.
- The coverage warning threshold (15% of a season's games) is my choice; today's worst season is about 8%.

## Review focus for Codex
The newest-snapshot rule (`_loaded_at`, then `_source_modified_at`) and whether the gate for it can be fooled by two snapshots loaded at the same instant with different labels (none exist today).

## Open questions for the owner
None for this step. Next: run the job so the table exists, then the app needs `SELECT` on it (I will show the exact statement and wait for your yes).

## Owner walkthrough
This adds one small table to the data warehouse that lists, for every player and every season since 2021-22, the position the team roster gives him: guard, forward, center, or a mix like guard-forward. We need it because the upcoming "how does each team defend each kind of player" screen has to know who is a guard and who is a center, and that information was only sitting in the raw data layer which the app cannot see. Nothing on the website changes yet. About 8% of games are played by someone with no listed position (usually players who joined a team mid-season), and the screen will say "Not listed" for those instead of guessing.
