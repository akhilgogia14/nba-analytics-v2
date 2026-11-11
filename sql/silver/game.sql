-- Silver: one row per game, key game_id. Source: bronze schedules (placeholder games with team_id 0 are left out;
-- they appear once the teams are known). The schedule file can lag the box scores by a day or two, so when it has no
-- result yet but a box score exists, the score comes from the box score and result_from_box_score is true.
SELECT
  s.game_id,
  s.season,
  s.season_type,
  CAST(s.game_date AS DATE)                         AS game_date,
  s.home_team_id,
  s.home_team_abbreviation                          AS home_tricode,
  s.home_team_name,
  s.away_team_id,
  s.away_team_abbreviation                          AS away_tricode,
  s.away_team_name,
  coalesce(s.home_pts, th.points)                   AS home_pts,
  coalesce(s.away_pts, ta.points)                   AS away_pts,
  (coalesce(s.home_pts, th.points) IS NOT NULL)     AS is_final,
  coalesce(s.home_pts, th.points) > coalesce(s.away_pts, ta.points) AS home_won,
  (s.home_pts IS NULL AND th.points IS NOT NULL)    AS result_from_box_score,
  (th.game_id IS NOT NULL AND ta.game_id IS NOT NULL) AS has_box_score
FROM workspace.nba_v2_bronze.schedules s
LEFT JOIN workspace.nba_v2_bronze.team_boxscores th ON th.game_id = s.game_id AND th.side = 'home' AND th.team_id <> 0
LEFT JOIN workspace.nba_v2_bronze.team_boxscores ta ON ta.game_id = s.game_id AND ta.side = 'away' AND ta.team_id <> 0
WHERE s.home_team_id <> 0 AND s.away_team_id <> 0
