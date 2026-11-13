-- Oddities worth a look, not failures. Each row: warning name, row key, details (JSON).
-- A regular-season last-10 window that spans more than a year (a long injury or absence): the "recent form" is old.
-- Playoff windows are skipped: they span a year or more by nature (the page shows their dates).
SELECT 'window_spans_over_365_days' AS warning,
       CAST(person_id AS STRING) AS row_key,
       to_json(named_struct('player_name', player_name, 'l10_first_date', CAST(l10_first_date AS STRING),
                            'last_game_date', CAST(last_game_date AS STRING), 'l10_games', l10_games)) AS detail
FROM {T}
WHERE stat = 'pts' AND game_type = 'regular-season' AND datediff(last_game_date, l10_first_date) > 365
