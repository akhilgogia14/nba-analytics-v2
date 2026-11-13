-- Quality gates for gold team_form. Each row: gate name, bad-row count (0 = pass).
-- The placeholder token is replaced by the table name, or by a WITH-clause alias, under test.
-- Everything is recomputed straight from silver team_game in plain SQL, per team and game type, with its own
-- percentile formula (linear interpolation on the sorted array) instead of Spark's percentile function, so a
-- mistake in the PySpark code cannot be repeated here. A row never mixes game types.
SELECT 'key_not_unique' AS gate, count(*) - count(DISTINCT team_id, game_type, stat) AS bad FROM {T}
UNION ALL SELECT 'key_has_null', count_if(team_id IS NULL OR game_type IS NULL OR stat IS NULL) FROM {T}
UNION ALL SELECT 'teams_differ_from_source',
  abs((SELECT count(DISTINCT team_id) FROM workspace.nba_v2_silver.team_game) - (SELECT count(DISTINCT team_id) FROM {T}))
UNION ALL SELECT 'groups_without_8_stats', count(*) FROM (
  SELECT 1 FROM {T} GROUP BY team_id, game_type HAVING count(*) <> 8 OR count(DISTINCT stat) <> 8)
UNION ALL SELECT 'stat_names_wrong', count_if(stat NOT IN ('pts', 'reb', 'ast', 'fg3m', 'blk', 'stl', 'allowed', 'margin')) FROM {T}
UNION ALL SELECT 'game_types_wrong', count_if(game_type NOT IN ('regular-season', 'playoffs', 'play-in', 'nba-cup')) FROM {T}
UNION ALL SELECT 'season_label_wrong', count(*) FROM {T}
  WHERE season_label <> (SELECT concat(CAST(max(season) - 1 AS STRING), '-', right(CAST(max(season) AS STRING), 2))
                         FROM workspace.nba_v2_silver.team_game)
UNION ALL SELECT 'facts_differ_from_recompute', count(*) FROM (
  SELECT 1 FROM (SELECT * FROM {T} WHERE stat = 'pts') t FULL OUTER JOIN (
      SELECT x.team_id, x.season_type AS game_type, count(*) AS total, max(x.game_date) AS last_d,
             max_by(x.season, struct(x.game_date, x.game_id)) AS lseason,
             any_value(n.tname) AS tname, any_value(n.ttri) AS ttri,
             sum(CASE WHEN x.rn <= 10 THEN 1 ELSE 0 END) AS w_n,
             min(CASE WHEN x.rn <= 10 THEN x.game_date END) AS w_first,
             sum(CASE WHEN x.rn <= 10 AND x.season < m.ms THEN 1 ELSE 0 END) AS w_before,
             sum(CASE WHEN x.rn <= 10 AND x.won THEN 1 ELSE 0 END) AS w_wins,
             sum(CASE WHEN x.season = m.ms THEN 1 ELSE 0 END) AS s_games
      FROM (SELECT *, row_number() OVER (PARTITION BY team_id, season_type ORDER BY game_date DESC, game_id DESC) AS rn
            FROM workspace.nba_v2_silver.team_game) x
      CROSS JOIN (SELECT max(season) AS ms FROM workspace.nba_v2_silver.team_game) m
      JOIN (SELECT team_id, max_by(team_name, struct(game_date, game_id)) AS tname,
                   max_by(team_tricode, struct(game_date, game_id)) AS ttri FROM workspace.nba_v2_silver.team_game GROUP BY team_id) n
        ON n.team_id = x.team_id
      GROUP BY x.team_id, x.season_type) r ON r.team_id = t.team_id AND r.game_type = t.game_type
  WHERE t.team_id IS NULL OR r.team_id IS NULL OR t.total_games <> r.total OR t.last_game_date <> r.last_d
     OR t.team_name <> r.tname OR t.team_tricode <> r.ttri
     OR t.last_season_label <> concat(CAST(r.lseason - 1 AS STRING), '-', right(CAST(r.lseason AS STRING), 2))
     OR t.l10_games <> r.w_n OR t.l10_first_date <> r.w_first
     OR t.l10_games_before_current_season <> r.w_before
     OR t.l10_wins <> r.w_wins OR t.season_games <> r.s_games)
UNION ALL SELECT 'l10_stats_differ_from_recompute', count(*) FROM (
  SELECT 1 FROM {T} t LEFT JOIN (
      SELECT team_id, game_type, stat, n, mean, mn, mx,
        arr[CAST(floor(0.1 * (n - 1)) AS INT)] + (0.1 * (n - 1) - floor(0.1 * (n - 1))) * (arr[least(CAST(floor(0.1 * (n - 1)) AS INT) + 1, n - 1)] - arr[CAST(floor(0.1 * (n - 1)) AS INT)]) AS p10,
        arr[CAST(floor(0.5 * (n - 1)) AS INT)] + (0.5 * (n - 1) - floor(0.5 * (n - 1))) * (arr[least(CAST(floor(0.5 * (n - 1)) AS INT) + 1, n - 1)] - arr[CAST(floor(0.5 * (n - 1)) AS INT)]) AS p50,
        arr[CAST(floor(0.9 * (n - 1)) AS INT)] + (0.9 * (n - 1) - floor(0.9 * (n - 1))) * (arr[least(CAST(floor(0.9 * (n - 1)) AS INT) + 1, n - 1)] - arr[CAST(floor(0.9 * (n - 1)) AS INT)]) AS p90
      FROM (SELECT team_id, game_type, stat, CAST(count(*) AS INT) AS n, avg(v) AS mean, min(v) AS mn, max(v) AS mx,
                   sort_array(collect_list(v)) AS arr
            FROM (SELECT team_id, season_type AS game_type, stack(8, 'pts', CAST(pts AS DOUBLE), 'reb', CAST(reb AS DOUBLE),
                         'ast', CAST(ast AS DOUBLE), 'fg3m', CAST(fg3m AS DOUBLE), 'blk', CAST(blk AS DOUBLE),
                         'stl', CAST(stl AS DOUBLE), 'allowed', CAST(opp_pts AS DOUBLE),
                         'margin', CAST(pts - opp_pts AS DOUBLE)) AS (stat, v)
                  FROM (SELECT *, row_number() OVER (PARTITION BY team_id, season_type ORDER BY game_date DESC, game_id DESC) AS rn
                        FROM workspace.nba_v2_silver.team_game) WHERE rn <= 10)
            GROUP BY team_id, game_type, stat)) r ON r.team_id = t.team_id AND r.game_type = t.game_type AND r.stat = t.stat
  WHERE r.team_id IS NULL OR t.l10_games <> r.n
     OR abs(t.l10_mean - r.mean) > 0.0015 OR abs(t.l10_min - r.mn) > 0.0001 OR abs(t.l10_max - r.mx) > 0.0001
     OR abs(t.l10_median - r.p50) > 0.0015 OR abs(t.l10_p10 - r.p10) > 0.0015 OR abs(t.l10_p90 - r.p90) > 0.0015)
UNION ALL SELECT 'season_mean_differs_from_recompute', count(*) FROM (
  SELECT 1 FROM {T} t LEFT JOIN (
      SELECT team_id, game_type, stat, avg(v) AS mean
      FROM (SELECT team_id, season_type AS game_type, stack(8, 'pts', CAST(pts AS DOUBLE), 'reb', CAST(reb AS DOUBLE),
                         'ast', CAST(ast AS DOUBLE), 'fg3m', CAST(fg3m AS DOUBLE), 'blk', CAST(blk AS DOUBLE),
                         'stl', CAST(stl AS DOUBLE), 'allowed', CAST(opp_pts AS DOUBLE),
                         'margin', CAST(pts - opp_pts AS DOUBLE)) AS (stat, v)
            FROM workspace.nba_v2_silver.team_game
            WHERE season = (SELECT max(season) FROM workspace.nba_v2_silver.team_game))
      GROUP BY team_id, game_type, stat) r ON r.team_id = t.team_id AND r.game_type = t.game_type AND r.stat = t.stat
  WHERE (r.mean IS NULL AND t.season_mean IS NOT NULL) OR (r.mean IS NOT NULL AND t.season_mean IS NULL)
     OR abs(t.season_mean - r.mean) > 0.0015)
UNION ALL SELECT 'percentiles_out_of_order', count_if(NOT (l10_min - 0.0006 <= l10_p10 AND l10_p10 <= l10_median + 0.0006
     AND l10_median <= l10_p90 + 0.0006 AND l10_p90 <= l10_max + 0.0006)) FROM {T}
UNION ALL SELECT 'window_wins_impossible', count_if(l10_wins < 0 OR l10_wins > l10_games OR l10_games > 10 OR l10_games < 1) FROM {T}
