-- Quality gates for gold team_vs_opponent. Each row: gate name, bad-row count (0 = pass).
-- The placeholder token is replaced by the table name, or by a WITH-clause alias, under test.
-- Everything is recomputed straight from silver team_game in plain SQL (every game is tagged with its scopes:
-- all, its season, and regular season or playoffs), with its own percentile formula (linear interpolation on the
-- sorted array) instead of Spark's percentile function, so a mistake in the PySpark code cannot be repeated here.
SELECT 'key_not_unique' AS gate, count(*) - count(DISTINCT team_id, opponent_team_id, scope, scope_value, stat) AS bad FROM {T}
UNION ALL SELECT 'key_has_null', count_if(team_id IS NULL OR opponent_team_id IS NULL OR scope IS NULL OR scope_value IS NULL OR stat IS NULL) FROM {T}
UNION ALL SELECT 'pairs_differ_from_source',
  abs((SELECT count(*) FROM (SELECT DISTINCT team_id, opponent_team_id FROM workspace.nba_v2_silver.team_game))
    - (SELECT count(*) FROM (SELECT DISTINCT team_id, opponent_team_id FROM {T})))
UNION ALL SELECT 'scope_labels_wrong', count_if(NOT (
     (scope = 'all' AND scope_value = 'all')
  OR (scope = 'game_type' AND scope_value IN ('regular-season', 'playoffs'))
  OR (scope = 'season' AND scope_value RLIKE '^[0-9]{4}-[0-9]{2}$'))) FROM {T}
UNION ALL SELECT 'stat_names_wrong', count_if(stat NOT IN ('pts', 'reb', 'ast', 'fg3m', 'blk', 'stl', 'allowed', 'margin')) FROM {T}
UNION ALL SELECT 'groups_without_8_stats', count(*) FROM (
  SELECT 1 FROM {T} GROUP BY team_id, opponent_team_id, scope, scope_value HAVING count(*) <> 8 OR count(DISTINCT stat) <> 8)
UNION ALL SELECT 'facts_inconsistent_across_stats', count(*) FROM (
  SELECT 1 FROM {T} GROUP BY team_id, opponent_team_id, scope, scope_value
  HAVING count(DISTINCT struct(games, wins, regular_games, playoff_games, first_game_date, last_game_date, team_tricode, opponent_tricode)) <> 1)
UNION ALL SELECT 'facts_differ_from_recompute', count(*) FROM (
  SELECT 1 FROM (SELECT * FROM {T} WHERE stat = 'pts') t FULL OUTER JOIN (
      SELECT g.team_id, g.opponent_team_id, g.scope, g.scope_value, count(*) AS games, sum(CASE WHEN g.won THEN 1 ELSE 0 END) AS wins,
             sum(CASE WHEN g.season_type = 'regular-season' THEN 1 ELSE 0 END) AS reg,
             sum(CASE WHEN g.season_type = 'playoffs' THEN 1 ELSE 0 END) AS po,
             min(g.game_date) AS first_d, max(g.game_date) AS last_d, any_value(n.ttri) AS ttri, any_value(n.otri) AS otri
      FROM (SELECT team_id, opponent_team_id, scope, scope_value, game_id, game_date, season_type, won,
               pts, reb, ast, fg3m, blk, stl, opp_pts FROM (
          SELECT *, 'all' AS scope, 'all' AS scope_value FROM workspace.nba_v2_silver.team_game
          UNION ALL SELECT *, 'season', concat(CAST(season - 1 AS STRING), '-', right(CAST(season AS STRING), 2))
            FROM workspace.nba_v2_silver.team_game
          UNION ALL SELECT *, 'game_type', season_type FROM workspace.nba_v2_silver.team_game
            WHERE season_type IN ('regular-season', 'playoffs'))) g
      JOIN (SELECT team_id, opponent_team_id, max_by(team_tricode, struct(game_date, game_id)) AS ttri,
                   max_by(opponent_tricode, struct(game_date, game_id)) AS otri
            FROM workspace.nba_v2_silver.team_game GROUP BY team_id, opponent_team_id) n
        ON n.team_id = g.team_id AND n.opponent_team_id = g.opponent_team_id
      GROUP BY g.team_id, g.opponent_team_id, g.scope, g.scope_value) r
    ON r.team_id = t.team_id AND r.opponent_team_id = t.opponent_team_id AND r.scope = t.scope AND r.scope_value = t.scope_value
  WHERE t.team_id IS NULL OR r.team_id IS NULL OR t.games <> r.games OR t.wins <> r.wins
     OR t.regular_games <> r.reg OR t.playoff_games <> r.po OR t.first_game_date <> r.first_d OR t.last_game_date <> r.last_d
     OR t.team_tricode <> r.ttri OR t.opponent_tricode <> r.otri)
UNION ALL SELECT 'stats_differ_from_recompute', count(*) FROM (
  SELECT 1 FROM {T} t FULL OUTER JOIN (
      SELECT team_id, opponent_team_id, scope, scope_value, stat, mean, mn, mx,
        arr[CAST(floor(0.1 * (n - 1)) AS INT)] + (0.1 * (n - 1) - floor(0.1 * (n - 1))) * (arr[least(CAST(floor(0.1 * (n - 1)) AS INT) + 1, n - 1)] - arr[CAST(floor(0.1 * (n - 1)) AS INT)]) AS p10, arr[CAST(floor(0.5 * (n - 1)) AS INT)] + (0.5 * (n - 1) - floor(0.5 * (n - 1))) * (arr[least(CAST(floor(0.5 * (n - 1)) AS INT) + 1, n - 1)] - arr[CAST(floor(0.5 * (n - 1)) AS INT)]) AS p50, arr[CAST(floor(0.9 * (n - 1)) AS INT)] + (0.9 * (n - 1) - floor(0.9 * (n - 1))) * (arr[least(CAST(floor(0.9 * (n - 1)) AS INT) + 1, n - 1)] - arr[CAST(floor(0.9 * (n - 1)) AS INT)]) AS p90
      FROM (SELECT team_id, opponent_team_id, scope, scope_value, stat, CAST(count(*) AS INT) AS n, avg(v) AS mean,
                   min(v) AS mn, max(v) AS mx, sort_array(collect_list(v)) AS arr
            FROM (SELECT team_id, opponent_team_id, scope, scope_value,
                         stack(8, 'pts', CAST(pts AS DOUBLE), 'reb', CAST(reb AS DOUBLE), 'ast', CAST(ast AS DOUBLE),
                               'fg3m', CAST(fg3m AS DOUBLE), 'blk', CAST(blk AS DOUBLE), 'stl', CAST(stl AS DOUBLE),
                               'allowed', CAST(opp_pts AS DOUBLE), 'margin', CAST(pts - opp_pts AS DOUBLE)) AS (stat, v)
                  FROM (SELECT team_id, opponent_team_id, scope, scope_value, game_id, game_date, season_type, won,
               pts, reb, ast, fg3m, blk, stl, opp_pts FROM (
          SELECT *, 'all' AS scope, 'all' AS scope_value FROM workspace.nba_v2_silver.team_game
          UNION ALL SELECT *, 'season', concat(CAST(season - 1 AS STRING), '-', right(CAST(season AS STRING), 2))
            FROM workspace.nba_v2_silver.team_game
          UNION ALL SELECT *, 'game_type', season_type FROM workspace.nba_v2_silver.team_game
            WHERE season_type IN ('regular-season', 'playoffs'))))
            GROUP BY team_id, opponent_team_id, scope, scope_value, stat)) r
    ON r.team_id = t.team_id AND r.opponent_team_id = t.opponent_team_id AND r.scope = t.scope
       AND r.scope_value = t.scope_value AND r.stat = t.stat
  WHERE t.team_id IS NULL OR r.team_id IS NULL
     OR abs(t.mean - r.mean) > 0.0015 OR abs(t.min_value - r.mn) > 0.0001 OR abs(t.max_value - r.mx) > 0.0001
     OR abs(t.median - r.p50) > 0.0015 OR abs(t.p10 - r.p10) > 0.0015 OR abs(t.p90 - r.p90) > 0.0015)
UNION ALL SELECT 'percentiles_out_of_order', count_if(NOT (min_value - 0.0006 <= p10 AND p10 <= median + 0.0006
     AND median <= p90 + 0.0006 AND p90 <= max_value + 0.0006)) FROM {T}
UNION ALL SELECT 'counts_impossible', count_if(games < 1 OR wins < 0 OR wins > games OR regular_games + playoff_games > games
     OR first_game_date > last_game_date) FROM {T}
