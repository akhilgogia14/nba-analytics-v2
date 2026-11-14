-- Oddities worth a look, not failures. Each row: warning name, row key, details (JSON).
-- A game not yet final although its date is more than a day before the newest final game: the score is late or the game
-- was postponed. The page shows it as not played.
SELECT 'past_game_not_final' AS warning, game_id AS row_key,
       to_json(named_struct('date', CAST(game_date AS STRING), 'home', home_tricode, 'away', away_tricode, 'type', game_type)) AS detail
FROM {T}
WHERE NOT is_final AND game_date < date_sub((SELECT max(game_date) FROM {T} WHERE is_final), 1)
