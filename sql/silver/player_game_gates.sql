-- Quality gates for silver player_game. Each row: gate name, bad-row count (0 = pass).
-- The placeholder token is replaced by the table name, or by a WITH-clause alias, under test.
SELECT 'key_not_unique' AS gate, count(*) - count(DISTINCT game_id, person_id) AS bad FROM {T}
UNION ALL SELECT 'key_has_null', count_if(game_id IS NULL OR person_id IS NULL) FROM {T}
UNION ALL SELECT 'missing_game_date', count_if(game_date IS NULL) FROM {T}
UNION ALL SELECT 'minutes_unparsed',
  count_if(minutes_seconds IS NULL AND played) FROM {T}
UNION ALL SELECT 'dropped_vs_bronze',
  (SELECT count(*) FROM workspace.nba_v2_bronze.player_boxscores WHERE team_id <> 0 AND person_id <> 0)
  - (SELECT count(*) FROM {T})
UNION ALL SELECT 'points_without_minutes', count_if(NOT played AND coalesce(pts,0) > 0) FROM {T}
UNION ALL SELECT 'team_games_without_5_starters', count(*) FROM (
  SELECT game_id, team_id FROM {T} GROUP BY game_id, team_id HAVING sum(CAST(started AS INT)) <> 5)
UNION ALL SELECT 'points_differ_from_team_total', count(*) FROM (
  SELECT g.game_id, g.team_id
  FROM (SELECT game_id, team_id, sum(pts) AS pts FROM {T} GROUP BY game_id, team_id) g
  JOIN workspace.nba_v2_bronze.team_boxscores t ON t.game_id = g.game_id AND t.team_id = g.team_id
  WHERE g.pts <> t.points)

-- Non-failing oddities live in player_game_warnings.sql.
