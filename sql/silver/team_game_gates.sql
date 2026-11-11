-- Quality gates for silver team_game. Each row: gate name, bad-row count (0 = pass).
-- The placeholder token is replaced by the table name, or by a WITH-clause alias, under test.
SELECT 'key_not_unique' AS gate, count(*) - count(DISTINCT game_id, team_id) AS bad FROM {T}
UNION ALL SELECT 'key_has_null', count_if(game_id IS NULL OR team_id IS NULL) FROM {T}
UNION ALL SELECT 'missing_game_date', count_if(game_date IS NULL) FROM {T}
UNION ALL SELECT 'minutes_unparsed', count_if(minutes_seconds IS NULL) FROM {T}
UNION ALL SELECT 'dropped_vs_bronze',
  (SELECT count(*) FROM workspace.nba_v2_bronze.team_boxscores WHERE team_id <> 0) - (SELECT count(*) FROM {T})
UNION ALL SELECT 'games_without_one_home_one_away', count(*) FROM (
  SELECT game_id FROM {T} GROUP BY game_id HAVING count(*) <> 2 OR sum(CAST(is_home AS INT)) <> 1)
UNION ALL SELECT 'tied_games', count_if(pts = opp_pts) FROM {T}
UNION ALL SELECT 'overtime_minutes_invalid',
  count_if(minutes_seconds < 14400 OR (minutes_seconds - 14400) % 1500 <> 0) FROM {T}
UNION ALL SELECT 'plus_minus_not_margin', count_if(plus_minus <> pts - opp_pts) FROM {T}
UNION ALL SELECT 'points_differ_from_schedule', count(*) FROM (
  SELECT g.game_id FROM {T} g JOIN workspace.nba_v2_bronze.schedules s ON s.game_id = g.game_id
  WHERE s.home_pts IS NOT NULL
    AND g.pts <> CASE WHEN g.is_home THEN s.home_pts ELSE s.away_pts END)
UNION ALL SELECT 'points_differ_from_player_sum', count(*) FROM (
  SELECT g.game_id FROM {T} g
  LEFT JOIN (SELECT game_id, team_id, sum(points) AS p FROM workspace.nba_v2_bronze.player_boxscores GROUP BY game_id, team_id) p
    ON p.game_id = g.game_id AND p.team_id = g.team_id
  WHERE p.p IS NULL OR p.p <> g.pts)
