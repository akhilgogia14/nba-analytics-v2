-- Oddities worth a look, not failures. Each row: warning name, row key, details (JSON).
-- Appended to silver._data_warnings the first time a row is seen (see scripts/silver_build.py).
SELECT 'stats_at_zero_minutes' AS warning,
       concat_ws('|', game_id, person_id) AS row_key,
       to_json(named_struct('player_name', player_name, 'game_date', CAST(game_date AS STRING), 'team', team_tricode,
                            'minutes_seconds', minutes_seconds, 'reb', reb, 'ast', ast, 'stl', stl, 'blk', blk,
                            'fga', fga, 'dnp_reason', dnp_reason)) AS detail
FROM {T}
WHERE NOT played AND coalesce(reb,0) + coalesce(ast,0) + coalesce(stl,0) + coalesce(blk,0) + coalesce(fga,0) > 0
