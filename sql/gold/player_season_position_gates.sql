-- Quality gates for gold player_season_position. Each row: gate name, bad-row count (0 = pass).
-- The placeholder token is replaced by the table name, or by a WITH-clause alias, under test.
-- Everything is checked against bronze rosters and silver player_game in plain SQL (the PySpark code is not reused).
-- One row per player per season; the label is exactly one of the seven the roster lists.
SELECT 'key_not_unique' AS gate, count(*) - count(DISTINCT person_id, season) AS bad FROM {T}
UNION ALL SELECT 'key_has_null', count_if(person_id IS NULL OR season IS NULL) FROM {T}
UNION ALL SELECT 'position_not_a_listed_value', count_if(position IS NULL OR position NOT IN ('G', 'F', 'C', 'G-F', 'F-C', 'C-F', 'F-G')) FROM {T}
UNION ALL SELECT 'season_label_wrong', count_if(season_label IS NULL OR season_label <> concat(CAST(season - 1 AS STRING), '-', right(CAST(season AS STRING), 2))) FROM {T}
-- one row for every player-season that has a usable label in bronze, and no others
UNION ALL SELECT 'row_count_differs_from_bronze',
  abs((SELECT count(*) FROM (SELECT DISTINCT player_id, season FROM workspace.nba_v2_bronze.rosters
        WHERE player_id IS NOT NULL AND season IS NOT NULL AND position IS NOT NULL AND trim(position) <> '')) - (SELECT count(*) FROM {T}))
-- the label must be the one the player's NEWEST roster snapshot of that season carries
UNION ALL SELECT 'position_not_from_newest_snapshot', count(*) FROM {T} t
  LEFT JOIN (SELECT player_id, season, upper(trim(position)) AS pos, _loaded_at,
                    max(_loaded_at) OVER (PARTITION BY player_id, season) AS newest
             FROM workspace.nba_v2_bronze.rosters WHERE position IS NOT NULL AND trim(position) <> '') b
    ON b.player_id = t.person_id AND b.season = t.season AND b.pos = t.position AND b._loaded_at = b.newest
  WHERE b.player_id IS NULL
-- every season that has played regular-season games in silver has roster rows here
UNION ALL SELECT 'season_with_games_has_no_rows', count(*) FROM (
  SELECT DISTINCT season FROM workspace.nba_v2_silver.player_game WHERE played AND season_type = 'regular-season') s
  WHERE s.season NOT IN (SELECT season FROM {T})
