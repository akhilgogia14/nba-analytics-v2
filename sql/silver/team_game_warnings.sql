-- Oddities worth a look, not failures. Each row: warning name, row key, details (JSON).
SELECT 'four_or_more_overtimes' AS warning,
       concat_ws('|', game_id, team_id) AS row_key,
       to_json(named_struct('game_date', CAST(game_date AS STRING), 'team', team_tricode, 'opponent', opponent_tricode,
                            'overtime_periods', overtime_periods, 'pts', pts, 'opp_pts', opp_pts)) AS detail
FROM {T}
WHERE overtime_periods >= 4
