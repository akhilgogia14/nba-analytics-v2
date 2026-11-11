-- Oddities worth a look, not failures. Each row: warning name, row key, details (JSON).
-- The schedule file lags the box scores: these games have a box score but no result in the schedule yet.
SELECT 'result_from_box_score_schedule_lagging' AS warning, game_id AS row_key,
       to_json(named_struct('game_date', CAST(game_date AS STRING), 'home', home_tricode, 'away', away_tricode,
                            'home_pts', home_pts, 'away_pts', away_pts)) AS detail
FROM {T}
WHERE result_from_box_score
UNION ALL
-- A game more than 3 days old with no result anywhere (postponed? file stuck?).
SELECT 'past_game_without_result', game_id,
       to_json(named_struct('game_date', CAST(game_date AS STRING), 'home', home_tricode, 'away', away_tricode,
                            'season_type', season_type))
FROM {T}
WHERE NOT is_final AND game_date < date_sub(current_date(), 3)
