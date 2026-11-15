-- Oddities worth a look, not failures. Each row: warning name, row key, details (JSON).
-- 1) A regular season of a COMPLETED season (any season before the latest in the data) in which a team did not play 82
--    games: a shortened season or games missing from the schedule. Checked once per team and season.
SELECT 'completed_season_not_82_games' AS warning,
       concat_ws('|', CAST(team_id AS STRING), CAST(season AS STRING)) AS row_key,
       to_json(named_struct('team', team_tricode, 'season', season_label, 'games', n)) AS detail
FROM (SELECT team_id, season, max_by(team_tricode, game_date) AS team_tricode, max_by(season_label, game_date) AS season_label,
             count(*) AS n
      FROM {T} WHERE game_type = 'regular-season' GROUP BY team_id, season)
WHERE n <> 82 AND season < (SELECT max(season) FROM {T})
UNION ALL
-- 2) A long gap inside a regular season (10 or more days without a game). The All-Star break is about 6 to 9 days, so a
--    longer gap points at a game missing from the schedule (its rest figures, and the next game's, would be wrong).
SELECT 'long_gap_in_regular_season', concat_ws('|', CAST(team_id AS STRING), game_id),
       to_json(named_struct('team', team_tricode, 'date', CAST(game_date AS STRING), 'days_rest', days_rest))
FROM {T} WHERE game_type = 'regular-season' AND days_rest >= 10
