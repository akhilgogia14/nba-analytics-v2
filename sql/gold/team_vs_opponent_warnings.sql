-- Oddities worth a look, not failures. Each row: warning name, row key, details (JSON).
-- A pair whose latest game in the data is over 400 days old: stale source data (or a very long break).
-- Small groups (1 or 2 games, common for playoffs or a young season) are NOT warned about; the page shows the game count.
SELECT 'pair_without_game_in_400_days' AS warning,
       concat_ws('|', CAST(team_id AS STRING), CAST(opponent_team_id AS STRING)) AS row_key,
       to_json(named_struct('team', team_tricode, 'opponent', opponent_tricode,
                            'last_game_date', CAST(last_game_date AS STRING),
                            'days_ago', datediff(current_date(), last_game_date))) AS detail
FROM {T}
WHERE stat = 'pts' AND scope = 'all' AND datediff(current_date(), last_game_date) > 400
