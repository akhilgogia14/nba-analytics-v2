# Source spike findings

Date checked: 2026-11-05. Read-only. Files were downloaded to a temp folder outside the repo; nothing was written to R2 or committed.

## 1. Where the data lives

- Repo: `sportsdataverse/sportsdataverse-data`. Files are GitHub Release assets, one release per dataset (tag = dataset name).
- Tags used so far: `nba_stats_player_boxscores`, `nba_stats_team_boxscores`, `nba_stats_player_game_logs`, `nba_stats_schedules`, `nba_stats_injury_report`.
- Each release holds one file per season in three formats (`.parquet`, `.csv`/`.csv.gz`, `.rds`) back to 1997. We use `.parquet` only.
- File name pattern: `<dataset>_<season>.parquet`. The schedule files are named `nba_schedule_<season>.parquet`.
- Download URL pattern: `https://github.com/sportsdataverse/sportsdataverse-data/releases/download/<tag>/<file>`. No login needed.
- The correction to `PLAN.md`: it named `sportsdataverse/hoopR-nba-stats-data` as the source. That repo exists and has its own license (section 7), but the files we pull are on the repo above.

## 2. Season labels

The label is the END year of the season.

| File label | Real dates (game logs) | Notes |
|---|---|---|
| `_2022` | 2021-10-19 to 2022-06-16 | the 2021-22 season |
| `_2023` | 2022-10-18 to 2023-06-12 | |
| `_2024` | 2023-10-24 to 2024-06-17 | |
| `_2025` | 2024-10-22 to 2025-06-22 | |
| `_2026` | 2025-10-21 to 2026-06-13 | |
| `_2027` | 2026-10-20 to 2026-11-04 | 2026-27, in progress |

The 2027 schedule already lists the whole 2026-27 regular season (to 2027-04-11), including games not yet played.

## 3. Freshness

- The `_2027` player box scores, team box scores and game logs were updated 2026-11-05 and contain games through 2026-11-04.
- The injury report was updated 2026-10-30 (earlier seasons) and 2026-11-05 (`_2027`).
- Older seasons were last rewritten between 2026-08 and 2026-10 (that is a rebuild, not new games).
- Not checked: whether the daily job keeps running, or how often the maintainer's server fails. The only evidence is that it ran today.

## 4. Tables, columns and row counts (2022 to 2027)

| Table | Grain (one row per...) | Rows per full season | 2027 so far |
|---|---|---|---|
| player_boxscores | player in a game | 33,848 to 35,114 | 3,617 |
| team_boxscores | team in a game | 2,638 to 2,646 | 242 (includes 2 placeholder rows) |
| player_game_logs | team in a game (see section 6) | 2,624 to 2,634 | 242 |
| nba_schedule | game | 1,393 to 1,400 | 1,274 |
| injury_report | report snapshot per player per game | 183,846 to 376,069 | 30,048 |

Games per season in the player box scores: 1,323 / 1,320 / 1,319 / 1,321 / 1,322 for 2022 to 2026, and 120 so far in 2027. Every game matched the schedule.

Box scores cover regular season (1,230 games), playoffs, play-in and the NBA Cup final. They do not cover preseason or all-star games, which the schedule does list.

Box score columns have no date. Get the date from the schedule by joining on `game_id`.

Player box score columns: team_id, team_city, team_name, team_tricode, team_slug, side, person_id, first_name, family_name, name_i, player_slug, position, comment, jersey_num, minutes (text), field_goals_made/attempted/percentage, three_pointers_made/attempted/percentage, free_throws_made/attempted/percentage, rebounds_offensive/defensive/total, assists, steals, blocks, turnovers, fouls_personal, points, plus_minus_points, game_id, season, season_type_id.

Size: the four core tables for 2022 to 2027 total 4.0 MB; the injury report for the same years is 3.7 MB. The `PLAN.md` guess of 2 to 2.5 GB applies to the heavy files (shots, play-by-play), which we have not looked at.

## 5. Keys

- Player box scores: `(game_id, person_id)`. No empty and no repeated keys, 2022 to 2027.
- Team box scores: `(game_id, team_id)`. Clean except for one placeholder game, below.
- Game logs: `(game_id, team_id)`. Clean.
- Schedule: `game_id`. Clean.
- The one problem: game `0062600001` (NBA Cup final, scheduled 2026-12-11) appears in the 2027 team box scores as 2 rows with `team_id = 0`, no names and no stats, and in the schedule with blank teams and scores. It has no player rows. It is a placeholder for a game whose teams are not decided.

## 6. "Did not play" and the size gap

- A player who did not play is a ROW, not a missing row. Of 176,232 player rows (2022 to 2027), 32,519 have a note in `comment` plus zero or empty minutes and `0` in every stat. That is about 18% of rows.
- `comment` values seen: "DNP - Coach's Decision" (27,449), "DND - Injury/Illness" (3,293), "DNP - Injury/Illness", "Inactive - ...", "NWT - Not With Team", "DND - Rest", suspension and personal reasons, and a few spellings like `DND_LEAGUE_SUSPENSION`.
- `minutes` is text like `"21:58"`. Non-players show `""` or `"0"`, and at least one row shows `"0:00"`.
- The note can be stale. 6 rows in 2027 say "DNP - Coach's Decision" but have real minutes and points (for example 8:53 and 3 points). 1 row in 2024 has no note and empty minutes. Cause not investigated.
- `player_game_logs` is NOT a player table. It has no player column, 2 rows per game, a median of 240 minutes (a team total), and its points equal team box score points in 100% of matched rows. It omits play-in and NBA Cup games (14 team-games in 2025). That explains the size gap with the player box scores.
- Player points sum exactly to team points in all 2,642 team-games of 2025.

## 7. Injury report

- Columns: season, report_datetime, game_date, game_time, report_matchup, away_team_abbr, home_team_abbr, team, report_player_name, current_status, reason, category, previous_status, game_id, team_id, person_id (can be empty), match_method.
- It is a log of snapshots over time (many rows per player per game), not one row per player per game. `report_datetime` says when each snapshot was taken.
- History: files from 2019 on the release; 2022 to 2027 files start 2021-10-02 and run to 2026-11-05. It already includes tomorrow's games.
- Statuses seen in 2027: Out, Questionable, Probable, Doubtful, Available. The `reason` column includes "G League - Two-Way" (a lot of rows) and "NOT YET SUBMITTED" placeholders with no player and no status.
- This contradicts `PLAN.md` section 5, which says the injury report is not published yet. `PLAN.md` was not changed for this; the owner decides.

## 8. License

- `sportsdataverse-data`: MIT License, Copyright (c) 2023 SportsDataverse. Copy, modify and use freely; keep the copyright and license notice with copies.
- `hoopR-nba-stats-data`: `LICENSE` is the short R-package stub; `LICENSE.md` says Creative Commons Attribution 4.0 (CC BY 4.0) for data, code and docs. Commercial use is allowed. We must give credit, link the license, and say if we changed the material.
- What we do: credit both in the README and the app footer, and keep the license text in `vendor/` if code is ever copied.
- Not a lawyer's opinion. The NBA Stats site itself may have its own terms for the underlying data; not researched.

## 9. Rules for later steps

1. Ignore games where `team_id` is 0 or no result exists yet. Filter out injury rows with no player.
2. Decide "played" from minutes converted to seconds and greater than 0. Never from `comment`, and never from a missing row.
3. Convert `minutes` from text to a number in silver.
4. Get dates by joining box scores to the schedule on `game_id`.
5. Use player box scores as the player-level source. Do not use `player_game_logs` for players.
6. Check that keys are never empty and never repeated on every load.
7. Land the files untouched in R2; do all of the above in silver.

## 10. Not verified yet

- Whether Databricks Free Edition can read R2 (PLAN.md open item 5).
- Fallback source choice if the repo goes stale (open item 6).
- How well injury report rows link to players (`person_id` empty rate).
- Sizes and quality of the other tables (rosters, game_rosters, lineups, shots, play-by-play, derived models).
- Whether older seasons are ever silently rewritten (several files were re-uploaded in 2026-08 to 2026-10).
- The `season_type_id` codes are inferred ('2' regular, '4' playoffs, '5' play-in, '6' Cup final); no official code list was found.
