# Tier 2 findings (step 8)

Date checked: 2026-11-07. Read-only. Method: Databricks SQL (`read_files`) through the read-only Unity Catalog external location `nba_r2_raw`, on the starter warehouse. Nothing was written to R2, Databricks tables or the repo. The checks ran on the **2025 season only** (a full season); other seasons and the in-progress 2027 season were not checked.

## 1. Connection result (step 7)

- Databricks Free Edition serverless can reach R2 and GitHub over HTTPS (network test, 2026-11-07).
- It can also read R2 through Unity Catalog: credential `nba_r2_ro` (Cloudflare API token type, read-only R2 token) and external location `nba_r2_raw` at `r2://nba-bucket@<account-id>.r2.cloudflarestorage.com/raw`, created with `--read-only`.
- Why `--read-only` mattered: created without it, Databricks also tests writing, and the read-only token fails that test with "Could not access location".
- Verified reads: 2025 schedule 1,400 rows and 2025 player box scores 35,114 rows through `read_files`, identical to the local counts.
- A second route also works: a notebook using `boto3` and keys from the secret scope `nba-v2-r2`. Kept as a fallback.

## 2. The 11 tier 2 tables (2025)

| Table (release tag) | One row per | Verified unique key | Rows | Columns |
|---|---|---|---|---|
| `nba_stats_pbp` | event in a game | `(game_id, order_index)` | 689,823 | 50 |
| `nba_stats_shots` | field-goal attempt | none found (section 3.4) | 235,140 | 20 |
| `nba_stats_possessions` | possession | `(game_id, possession_number)` and `(game_id, period, number_in_period)` | 276,525 | 36 |
| `nba_stats_game_lineups` | row aligned with a pbp row | none (section 3.5) | 689,823 | 15 |
| `nba_stats_lineups` | lineup x season type x measure type x per mode | `(group_id, team_id, season_type, measure_type, per_mode)` | 44,940 | 183 |
| `nba_stats_player_season_stats` | player x team x season type x measure type x per mode | `(player_id, team_id, season_type, measure_type, per_mode)` | 8,318 | 211 |
| `nba_stats_team_season_stats` | team x season type x measure type x per mode | `(team_id, season_type, measure_type, per_mode)` | 552 | 179 |
| `nba_stats_game_rosters` | player listed for a game (see section 3.6) | `(game_id, player_id)` | 11,024 | 12 |
| `nba_stats_standings` | team (snapshot) | `(team_id, season_type)` | 30 | 95 |
| `nba_stats_rosters` | team and player (snapshot) | `(team_id, player_id)` | 499 | 19 |
| `nba_stats_officials` | official in a game | `(game_id, official_id)` | 4,034 | 8 |

"Verified unique key" means: rows equal distinct keys, and no key part is empty, null, or `0` for ids. All the keys above passed. Column lists are in the Databricks `DESCRIBE` output; re-run `DESCRIBE QUERY SELECT * FROM read_files(...)` to see them.

## 3. Findings

1. **Clean schemas.** `_rescued_data` (a column `read_files` adds to catch values that do not fit the file's schema) is empty in every row of every table. It is not in the source files.
2. **Play-by-play key.** `action_number` is not unique: 689,823 rows but 653,071 distinct `(game_id, action_number)` pairs. 36,752 pairs hold two rows each. They are linked events, for example a turnover (`order_index` 46) and the steal that goes with it (47) sharing `action_number` 64. Use `order_index`.
3. **Coverage differs between tables.** Play-by-play has 1,400 games, the same as the 2025 schedule, which includes preseason and all-star games. Box scores, shots and game rosters cover regular season, playoffs, play-in and the Cup final (shots: 1,230 + 84 + 6 + 1 = 1,321 games). Play-by-play has no date and no season-type column; get both from the schedule on `game_id`.
4. **Shots.** 235,140 rows equal the play-by-play field-goal rows (`is_field_goal = 1`) in the games that have shots, exactly. The raw play-by-play total (248,509) is higher only because it includes preseason and all-star games. Shots has no id column. 8 rows are exact whole-row duplicates (235,132 distinct rows), and the best key candidate `(game_id, period, clock, person_id, x_legacy, y_legacy)` has 32 repeated rows. Shots has no `order_index`, so a row cannot be tied to its play-by-play row with certainty.
5. **`game_lineups`.** Same row count as play-by-play and no `order_index`. Joining it to play-by-play on `(game_id, action_number)` returns 763,327 rows instead of 689,823. Deduplicating is unsafe because 80 of the 653,071 `(game_id, action_number)` pairs have different lineups in their two rows. Play-by-play and possessions already carry the five offensive and five defensive players, so this table looks redundant.
6. **`game_rosters` is not a full roster.** 1,301 games, a median of 9 players a game (1 to 14). It shares zero `(game, player)` pairs with the player box scores. 91.8% of its rows match an injury-report row for the same player and game, and 91.6% were marked "Out" at some point. So it is most likely the list of players who did not dress. This is an inference: nothing in the table says so.
7. **Stacked splits.** Lineups, player season stats and team season stats keep several views in one table, told apart by `season_type` (regular-season, playoffs), `measure_type` (base, advanced, misc, scoring, usage, defense, opponent seen so far) and `per_mode` (pergame, totals). A query that does not filter these will mix them. Player season stats: 569 players per split in the regular season, 219 in the playoffs. Team season stats: 30 teams and 16 playoff teams per split.
8. **Snapshots without history.** Standings (30 rows, regular season only), rosters and the season-stats tables have no date column; each file is a snapshot that the source overwrites as the season goes on.
9. **Play-by-play formats.** `clock` is text such as `PT08M29.00S`; `seconds_remaining` is numeric (0.0 to 720.0). `score_home` and `score_away` are text. Periods run 1 to 6 (5 and 6 are overtimes).
10. **Possessions.** 694 of 276,525 rows have `count_as_possession = false`.
11. **Injury report link rate (2025, 215,095 rows).** 22,455 rows (10.4%) have an empty `person_id`; 19,611 of them are "NOT YET SUBMITTED" placeholders. About 2,800 rows (1.3%) are real entries with no player match.

## 4. Rules for bronze and silver

1. Bronze keeps every row as delivered, plus load metadata (source file, checksum, loaded_at, run id). No cleaning in bronze.
2. Fail or alert if any `_rescued_data` is not empty.
3. Play-by-play key is `(game_id, order_index)`. Never join on `action_number` alone.
4. Do not use `game_lineups` for now. Take lineups from the player columns in play-by-play and possessions.
5. Shots: keep all rows in bronze; in silver drop only exact whole-row duplicates, and do not build a key from the six-column candidate.
6. Always filter `season_type`, `measure_type` and `per_mode` when reading the stacked season-stat tables.
7. Get dates and season type for play-by-play from the schedule; drop preseason and all-star games before joining to box scores.
8. Treat standings, rosters and season stats as dated snapshots: bronze appends each load with its load time so history builds up.
9. Do not call `game_rosters` a roster in any table or screen until the meaning is confirmed.
10. Injury report: ignore "NOT YET SUBMITTED" rows and rows without a player.

## 5. Not verified

- Seasons other than 2025, and how the in-progress 2027 files behave.
- Nulls and value ranges in non-key columns.
- What `game_rosters` really lists, and why 80 lineup rows disagree inside an `action_number`.
- How to tie a shot row to its play-by-play row.
- The meaning of the less obvious columns (`x_legacy`, `lineup_source`, the `sp_work_*` stats).
- Whether Auto Loader, `COPY INTO` and Delta Change Data Feed work on Free Edition with this external location.
