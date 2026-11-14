-- Oddities worth a look, not failures. Each row: warning name, row key, details (JSON).
-- A regular season of a COMPLETED season (any season before the latest in the data) in which a team did not play 82 games:
-- a shortened season or missing source games. Checked once per team and season, on the team's first game.
SELECT 'completed_season_not_82_games' AS warning,
       concat_ws('|', CAST(team_id AS STRING), CAST(season AS STRING)) AS row_key,
       to_json(named_struct('team', team_tricode, 'season', season_label, 'games', n)) AS detail
FROM (SELECT team_id, season, max_by(team_tricode, game_date) AS team_tricode, max_by(season_label, game_date) AS season_label,
             count(*) AS n
      FROM {T} WHERE game_type = 'regular-season' GROUP BY team_id, season)
WHERE n <> 82 AND season < (SELECT max(season) FROM workspace.nba_v2_silver.team_game)
