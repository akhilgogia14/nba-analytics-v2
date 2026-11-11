-- Quality gates for silver game. Each row: gate name, bad-row count (0 = pass).
-- The placeholder token is replaced by the table name, or by a WITH-clause alias, under test.
SELECT 'key_not_unique' AS gate, count(*) - count(DISTINCT game_id) AS bad FROM {T}
UNION ALL SELECT 'key_has_null', count_if(game_id IS NULL) FROM {T}
UNION ALL SELECT 'missing_game_date', count_if(game_date IS NULL) FROM {T}
UNION ALL SELECT 'dropped_vs_bronze',
  (SELECT count(*) FROM workspace.nba_v2_bronze.schedules WHERE home_team_id <> 0 AND away_team_id <> 0) - (SELECT count(*) FROM {T})
UNION ALL SELECT 'same_team_both_sides', count_if(home_team_id = away_team_id) FROM {T}
UNION ALL SELECT 'tied_games', count_if(is_final AND home_pts = away_pts) FROM {T}
UNION ALL SELECT 'half_a_result', count_if((home_pts IS NULL) <> (away_pts IS NULL)) FROM {T}
UNION ALL SELECT 'winner_contradicts_schedule_wl', count(*) FROM (
  SELECT g.game_id FROM {T} g JOIN workspace.nba_v2_bronze.schedules s ON s.game_id = g.game_id
  WHERE g.is_final AND s.home_wl IS NOT NULL AND s.home_wl <> '' AND g.home_won <> (s.home_wl = 'W'))
UNION ALL SELECT 'schedule_points_differ_from_box_score', count(*) FROM (
  SELECT g.game_id FROM {T} g
  JOIN workspace.nba_v2_bronze.team_boxscores h ON h.game_id = g.game_id AND h.side = 'home' AND h.team_id <> 0
  JOIN workspace.nba_v2_bronze.team_boxscores a ON a.game_id = g.game_id AND a.side = 'away' AND a.team_id <> 0
  WHERE NOT g.result_from_box_score AND g.is_final AND (g.home_pts <> h.points OR g.away_pts <> a.points))
UNION ALL SELECT 'box_score_games_missing', count(DISTINCT game_id) FROM workspace.nba_v2_bronze.team_boxscores
  WHERE team_id <> 0 AND game_id NOT IN (SELECT game_id FROM {T})
UNION ALL SELECT 'box_score_on_one_side_only', count_if(NOT has_box_score AND is_final AND result_from_box_score) FROM {T}
