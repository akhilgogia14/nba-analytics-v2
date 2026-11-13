-- Oddities worth a look, not failures. Each row: warning name, row key, details (JSON).
-- A team with no game in the last 30 days: either a long break (offseason) or stale source data.
-- It fires once per team in the offseason, which is expected.
SELECT 'no_game_in_last_30_days' AS warning,
       CAST(team_id AS STRING) AS row_key,
       to_json(named_struct('team', team_tricode, 'last_game_date', CAST(last_game_date AS STRING),
                            'days_ago', datediff(current_date(), last_game_date))) AS detail
FROM {T}
WHERE stat = 'pts' AND datediff(current_date(), last_game_date) > 30
