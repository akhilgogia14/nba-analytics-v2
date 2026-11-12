-- Oddities worth a look, not failures. Each row: warning name, row key, details (JSON).
-- A player-game of more than 55 minutes (triple overtime or longer; check it is real).
SELECT 'over_55_minutes' AS warning,
       concat_ws('|', game_id, person_id) AS row_key,
       to_json(named_struct('player_name', player_name, 'game_date', CAST(game_date AS STRING), 'team', team_tricode,
                            'minutes', minutes, 'pts', pts)) AS detail
FROM {T}
WHERE minutes > 55
