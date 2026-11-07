# v1 Databricks inventory

Date: 2026-11-06. Read-only: every command below only listed things (`databricks jobs list`, `apps list`, `warehouses list`, `clusters list`, `catalogs list`, `schemas list`, `tables list`, `secrets list-scopes`, `pipelines list-pipelines`, `jobs get`). Nothing was created, changed or deleted by Claude Code.

The owner had Databricks Genie clean up the workspace before this inventory was taken (job schedule cancelled, tables moved into an archive schema) and says MotherDuck is cleared. This file records what the workspace looks like AFTER that cleanup.

The owner's login email and the workspace URL are left out of this file on purpose.

## Decision: fresh start

v1 is archived. v2 builds from the new data source (`sportsdataverse/sportsdataverse-data`, see `docs/spike-findings.md`). It does not reuse any v1 table. The v1 tables stay where they are as a reference until the owner says otherwise.

## What exists

| Thing | State | Notes |
|---|---|---|
| Job `ARCHIVED v1 - NBA 2026 Daily Pipeline` | Exists, cannot run by itself | No schedule, no trigger, not continuous. 14 tasks (bronze_kaggle_import, silver_layer, 11 gold tasks, publish_to_motherduck). |
| App `nba-analytics` | Deletion requested 2026-11-06 (status DELETING) | Owner approved; was STOPPED. Confirm it disappears from the apps list. |
| App `nba-team-explorer` | Deletion requested 2026-11-06 (status DELETING) | Owner approved; was STOPPED. Confirm it disappears from the apps list. |
| SQL warehouse `Serverless Starter Warehouse` | Exists, STOPPED | 2X-Small. The free tier has only this one. |
| Clusters | None | |
| Pipelines | None | |
| Secret scopes | `nba-github`, `nba-kaggle`, `nba-motherduck` | Names only; no values were read. |
| Catalogs | `workspace` (ours), `system`, `samples` (Databricks-provided) | |
| Schemas in `workspace` | `default` (empty), `nba_v1_archived` (65 tables), `information_schema` (system) | `nba_v1_archived` is commented "archived 2026-11-06". |

## Tables in `workspace.nba_v1_archived`

All are MANAGED tables (Databricks owns the storage). Row counts and sizes were not checked.

Total: 65

- **bronze_***: 15
  `bronze_all_star_selections`, `bronze_games`, `bronze_league_schedule`, `bronze_play_by_play`, `bronze_player_statistics`, `bronze_player_statistics_extended`, `bronze_players`, `bronze_spotrac_cap_history_raw`, `bronze_spotrac_future_salaries_raw`, `bronze_spotrac_player_contracts_raw`, `bronze_spotrac_player_salaries_raw`, `bronze_spotrac_team_cap_rankings_raw`, `bronze_team_histories`, `bronze_team_statistics`, `bronze_team_statistics_extended`
- **silver_***: 15
  `silver_all_star_selections`, `silver_games`, `silver_league_schedule`, `silver_play_by_play`, `silver_player_contracts`, `silver_player_contracts_future`, `silver_player_salaries`, `silver_player_statistics`, `silver_player_statistics_extended`, `silver_player_statistics_extended_idfix`, `silver_players`, `silver_team_histories`, `silver_team_payroll`, `silver_team_statistics`, `silver_team_statistics_extended`
- **tmp_* (scratch)**: 2
  `tmp_exclusions_test`, `tmp_pair_outcomes_test`
- **gold and other**: 33
  `b2b_availability`, `b2b_availability_effects`, `b2b_availability_exclusions`, `b2b_availability_player`, `dim_player`, `dim_special_venue`, `dim_team_venue`, `export_manifest_2026_10_26`, `game_venue`, `moneyball_view`, `player_b2b_performance`, `player_game_features`, `player_game_log`, `player_game_variance`, `player_pair_outcomes`, `player_season_summary`, `player_snapshot_2026_27`, `player_value`, `player_vs_defender`, `player_vs_location`, `player_vs_team`, `shot_cells`, `similar_players`, `similar_players_vs_team`, `star_missing_impact`, `team_cap_analysis`, `team_defense_by_position`, `team_game_features`, `team_game_travel`, `team_snapshot_2026_27`, `travel_effects`, `travel_effects_perf`, `upcoming_game_context`

## Not checked

- MotherDuck (no access from here); relying on the owner's statement that it is cleared.
- Row counts, sizes and last-modified times of the v1 tables.
- Whether the stopped apps or the job hold anything that still costs money. On the free tier this should be nothing, but it was not confirmed.
- Whether any workspace files, notebooks, repos or Unity Catalog volumes remain. Not listed.
- The Genie cleanup itself: what it did is inferred from the current state, not from a log.

## Owner decisions (2026-11-06)

Each deletion needs an explicit yes (see `CLAUDE.md`).

1. Delete the two stopped apps: **yes, requested.** Both showed DELETING right after the delete command and 20 seconds later; confirm they leave the apps list.
2. Archived job: **leave it.** It has no schedule and cannot run by itself.
3. Three secret scopes (`nba-github`, `nba-kaggle`, `nba-motherduck`): **leave them for now.** `nba-motherduck` looks dead; revisit later.
4. The 65 tables in `nba_v1_archived`: **keep.** Delete them once v2 is working and the owner confirms. Not reversible unless Delta table history or a backup exists (not checked).
5. v2 schema name: **`workspace.nba_v2` is approved**, and bronze, silver and gold must stay explicit. Not created yet. Proposal for when bronze is loaded: separate schemas `nba_v2_bronze`, `nba_v2_silver`, `nba_v2_gold` (owner to confirm then).
