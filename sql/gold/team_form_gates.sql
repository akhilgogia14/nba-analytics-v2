-- Quality gates for gold team_form. Each row: gate name, bad-row count (0 = pass).
-- The placeholder token is replaced by the table name, or by a WITH-clause alias, under test.
-- Everything is recomputed straight from silver team_game in plain SQL, with its own percentile formula
-- (linear interpolation on the sorted array) instead of Spark's percentile function, so a mistake in the
-- PySpark code cannot be repeated here.
SELECT 'key_not_unique' AS gate, count(*) - count(DISTINCT team_id, stat) AS bad FROM {T}
UNION ALL SELECT 'key_has_null', count_if(team_id IS NULL OR stat IS NULL) FROM {T}
UNION ALL SELECT 'teams_differ_from_source',
  abs((SELECT count(DISTINCT team_id) FROM workspace.nba_v2_silver.team_game) - (SELECT count(DISTINCT team_id) FROM {T}))
UNION ALL SELECT 'teams_without_8_stats', count(*) FROM (
  SELECT team_id FROM {T} GROUP BY team_id HAVING count(*) <> 8 OR count(DISTINCT stat) <> 8)
UNION ALL SELECT 'stat_names_wrong', count_if(stat NOT IN ('pts', 'reb', 'ast', 'fg3m', 'blk', 'stl', 'allowed', 'margin')) FROM {T}
UNION ALL SELECT 'season_label_wrong', count(*) FROM {T}
  WHERE season_label <> (SELECT concat(CAST(max(season) - 1 AS STRING), '-', right(CAST(max(season) AS STRING), 2))
                         FROM workspace.nba_v2_silver.team_game)
UNION ALL SELECT 'facts_differ_from_recompute', count(*) FROM (
  SELECT t.team_id FROM {T} t LEFT JOIN (
      SELECT team_id, count(*) AS total, max(game_date) AS last_d,
             max_by(team_name, struct(game_date, game_id)) AS tname,
             max_by(team_tricode, struct(game_date, game_id)) AS ttri,
             max_by(season, struct(game_date, game_id)) AS lseason,
             sum(CASE WHEN rn <= 10 THEN 1 ELSE 0 END) AS w_n,
             min(CASE WHEN rn <= 10 THEN game_date END) AS w_first,
             sum(CASE WHEN rn <= 10 AND season < m.ms THEN 1 ELSE 0 END) AS w_before,
             sum(CASE WHEN rn <= 10 AND season_type <> 'regular-season' THEN 1 ELSE 0 END) AS w_nonreg,
             sum(CASE WHEN rn <= 10 AND won THEN 1 ELSE 0 END) AS w_wins,
             sum(CASE WHEN season = m.ms THEN 1 ELSE 0 END) AS s_games
      FROM (SELECT *, row_number() OVER (PARTITION BY team_id ORDER BY game_date DESC, game_id DESC) AS rn
            FROM workspace.nba_v2_silver.team_game)
      CROSS JOIN (SELECT max(season) AS ms FROM workspace.nba_v2_silver.team_game) m
      GROUP BY team_id) r ON r.team_id = t.team_id
  WHERE r.team_id IS NULL OR t.total_games <> r.total OR t.last_game_date <> r.last_d
     OR t.team_name <> r.tname OR t.team_tricode <> r.ttri
     OR t.last_season_label <> concat(CAST(r.lseason - 1 AS STRING), '-', right(CAST(r.lseason AS STRING), 2))
     OR t.l10_games <> r.w_n OR t.l10_first_date <> r.w_first
     OR t.l10_games_before_current_season <> r.w_before OR t.l10_games_not_regular <> r.w_nonreg
     OR t.l10_wins <> r.w_wins OR t.season_games <> r.s_games)
UNION ALL SELECT 'l10_stats_differ_from_recompute', count(*) FROM (
  SELECT t.team_id FROM {T} t LEFT JOIN (
      SELECT team_id, stat, n, mean, mn, mx,
        arr[CAST(floor(0.1 * (n - 1)) AS INT)] + (0.1 * (n - 1) - floor(0.1 * (n - 1))) * (arr[least(CAST(floor(0.1 * (n - 1)) AS INT) + 1, n - 1)] - arr[CAST(floor(0.1 * (n - 1)) AS INT)]) AS p10,
        arr[CAST(floor(0.5 * (n - 1)) AS INT)] + (0.5 * (n - 1) - floor(0.5 * (n - 1))) * (arr[least(CAST(floor(0.5 * (n - 1)) AS INT) + 1, n - 1)] - arr[CAST(floor(0.5 * (n - 1)) AS INT)]) AS p50,
        arr[CAST(floor(0.9 * (n - 1)) AS INT)] + (0.9 * (n - 1) - floor(0.9 * (n - 1))) * (arr[least(CAST(floor(0.9 * (n - 1)) AS INT) + 1, n - 1)] - arr[CAST(floor(0.9 * (n - 1)) AS INT)]) AS p90
      FROM (SELECT team_id, stat, CAST(count(*) AS INT) AS n, avg(v) AS mean, min(v) AS mn, max(v) AS mx,
                   sort_array(collect_list(v)) AS arr
            FROM (SELECT team_id, stack(8, 'pts', CAST(pts AS DOUBLE), 'reb', CAST(reb AS DOUBLE),
                         'ast', CAST(ast AS DOUBLE), 'fg3m', CAST(fg3m AS DOUBLE), 'blk', CAST(blk AS DOUBLE),
                         'stl', CAST(stl AS DOUBLE), 'allowed', CAST(opp_pts AS DOUBLE),
                         'margin', CAST(pts - opp_pts AS DOUBLE)) AS (stat, v)
                  FROM (SELECT *, row_number() OVER (PARTITION BY team_id ORDER BY game_date DESC, game_id DESC) AS rn
                        FROM workspace.nba_v2_silver.team_game) WHERE rn <= 10)
            GROUP BY team_id, stat)) r ON r.team_id = t.team_id AND r.stat = t.stat
  WHERE r.team_id IS NULL OR t.l10_games <> r.n
     OR abs(t.l10_mean - r.mean) > 0.0015 OR abs(t.l10_min - r.mn) > 0.0001 OR abs(t.l10_max - r.mx) > 0.0001
     OR abs(t.l10_median - r.p50) > 0.0015 OR abs(t.l10_p10 - r.p10) > 0.0015 OR abs(t.l10_p90 - r.p90) > 0.0015)
UNION ALL SELECT 'season_mean_differs_from_recompute', count(*) FROM (
  SELECT t.team_id FROM {T} t LEFT JOIN (
      SELECT team_id, stat, avg(v) AS mean
      FROM (SELECT team_id, stack(8, 'pts', CAST(pts AS DOUBLE), 'reb', CAST(reb AS DOUBLE),
                         'ast', CAST(ast AS DOUBLE), 'fg3m', CAST(fg3m AS DOUBLE), 'blk', CAST(blk AS DOUBLE),
                         'stl', CAST(stl AS DOUBLE), 'allowed', CAST(opp_pts AS DOUBLE),
                         'margin', CAST(pts - opp_pts AS DOUBLE)) AS (stat, v)
            FROM workspace.nba_v2_silver.team_game
            WHERE season = (SELECT max(season) FROM workspace.nba_v2_silver.team_game))
      GROUP BY team_id, stat) r ON r.team_id = t.team_id AND r.stat = t.stat
  WHERE (r.mean IS NULL AND t.season_mean IS NOT NULL) OR (r.mean IS NOT NULL AND t.season_mean IS NULL)
     OR abs(t.season_mean - r.mean) > 0.0015)
UNION ALL SELECT 'percentiles_out_of_order', count_if(NOT (t.l10_min - 0.0006 <= t.l10_p10 AND t.l10_p10 <= t.l10_median + 0.0006
     AND t.l10_median <= t.l10_p90 + 0.0006 AND t.l10_p90 <= t.l10_max + 0.0006)) FROM {T} t
UNION ALL SELECT 'window_wins_impossible', count_if(l10_wins < 0 OR l10_wins > l10_games OR l10_games > 10 OR l10_games < 1) FROM {T}
