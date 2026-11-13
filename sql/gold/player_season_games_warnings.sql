-- Oddities worth a look, not failures. Each row: warning name, row key, details (JSON).
-- 1) A regular-season grid of a COMPLETED season (any season before the latest in the data) that does not have 82 games:
--    a shortened season or missing source games. Checked once per grid, on its first game.
-- 2) A player with a grid for three or more teams in one season and game type: unusual, worth a glance.
SELECT 'completed_season_grid_not_82_games' AS warning,
       concat_ws('|', CAST(person_id AS STRING), CAST(team_id AS STRING), CAST(season AS STRING)) AS row_key,
       to_json(named_struct('player', player_name, 'team', team_tricode, 'season', season_label, 'team_games', team_games)) AS detail
FROM {T}
WHERE game_type = 'regular-season' AND game_number = 1 AND team_games <> 82
  AND season < (SELECT max(season) FROM workspace.nba_v2_silver.team_game)
UNION ALL
SELECT 'three_or_more_teams_in_one_season',
       concat_ws('|', CAST(person_id AS STRING), CAST(team_id AS STRING), CAST(season AS STRING), game_type),
       to_json(named_struct('player', player_name, 'season', season_label, 'game_type', game_type,
                            'team', team_tricode, 'other_teams', other_teams))
FROM {T}
WHERE game_number = 1 AND size(split(other_teams, ',')) >= 2
