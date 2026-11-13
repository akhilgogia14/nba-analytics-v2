-- Quality gates for gold player_form. Each row: gate name, bad-row count (0 = pass).
-- The placeholder token is replaced by the table name, or by a WITH-clause alias, under test.
-- Everything is recomputed straight from gold player_game_log in plain SQL, per player and game type, with its own
-- percentile formula (linear interpolation on the sorted array) instead of Spark's percentile function, so a
-- mistake in the PySpark code cannot be repeated here. A row never mixes game types.
SELECT 'key_not_unique' AS gate, count(*) - count(DISTINCT person_id, game_type, stat) AS bad FROM {T}
UNION ALL SELECT 'key_has_null', count_if(person_id IS NULL OR game_type IS NULL OR stat IS NULL) FROM {T}
UNION ALL SELECT 'players_differ_from_log',
  abs((SELECT count(DISTINCT person_id) FROM workspace.nba_v2_gold.player_game_log) - (SELECT count(DISTINCT person_id) FROM {T}))
UNION ALL SELECT 'groups_without_11_stats', count(*) FROM (
  SELECT 1 FROM {T} GROUP BY person_id, game_type HAVING count(*) <> 11 OR count(DISTINCT stat) <> 11)
UNION ALL SELECT 'game_types_wrong', count_if(game_type NOT IN ('regular-season', 'playoffs', 'play-in', 'nba-cup')) FROM {T}
UNION ALL SELECT 'facts_differ_from_recompute', count(*) FROM (
  SELECT 1 FROM (SELECT * FROM {T} WHERE stat = 'pts') t FULL OUTER JOIN (
      SELECT x.person_id, x.season_type AS game_type, count(*) AS total, max(x.game_date) AS last_d,
             max_by(x.season_label, struct(x.game_date, x.game_id)) AS slabel,
             any_value(n.pname) AS pname, any_value(n.tid) AS tid, any_value(n.ttri) AS ttri,
             sum(CASE WHEN x.rn <= 10 THEN 1 ELSE 0 END) AS w_n,
             min(CASE WHEN x.rn <= 10 THEN x.game_date END) AS w_first,
             sum(CASE WHEN x.rn <= 10 AND x.season < m.ms THEN 1 ELSE 0 END) AS w_before
      FROM (SELECT *, row_number() OVER (PARTITION BY person_id, season_type ORDER BY game_date DESC, game_id DESC) AS rn
            FROM workspace.nba_v2_gold.player_game_log) x
      CROSS JOIN (SELECT max(season) AS ms FROM workspace.nba_v2_gold.player_game_log) m
      JOIN (SELECT person_id, max_by(player_name, struct(game_date, game_id)) AS pname,
                   max_by(team_id, struct(game_date, game_id)) AS tid,
                   max_by(team_tricode, struct(game_date, game_id)) AS ttri FROM workspace.nba_v2_gold.player_game_log GROUP BY person_id) n
        ON n.person_id = x.person_id
      GROUP BY x.person_id, x.season_type) r ON r.person_id = t.person_id AND r.game_type = t.game_type
  WHERE t.person_id IS NULL OR r.person_id IS NULL OR t.total_games <> r.total OR t.last_game_date <> r.last_d
     OR t.player_name <> r.pname OR t.team_id <> r.tid OR t.team_tricode <> r.ttri
     OR t.last_season_label <> r.slabel OR t.l10_games <> r.w_n OR t.l10_first_date <> r.w_first
     OR t.l10_games_before_current_season <> r.w_before)
UNION ALL SELECT 'l10_stats_differ_from_recompute', count(*) FROM (
  SELECT 1 FROM {T} t LEFT JOIN (SELECT person_id, game_type, stat, n, mean, mn, mx, s0, s1, s2, s3,
        arr[CAST(floor(0.1 * (n - 1)) AS INT)] + (0.1 * (n - 1) - floor(0.1 * (n - 1))) * (arr[least(CAST(floor(0.1 * (n - 1)) AS INT) + 1, n - 1)] - arr[CAST(floor(0.1 * (n - 1)) AS INT)]) AS p10,
        arr[CAST(floor(0.5 * (n - 1)) AS INT)] + (0.5 * (n - 1) - floor(0.5 * (n - 1))) * (arr[least(CAST(floor(0.5 * (n - 1)) AS INT) + 1, n - 1)] - arr[CAST(floor(0.5 * (n - 1)) AS INT)]) AS p50,
        arr[CAST(floor(0.9 * (n - 1)) AS INT)] + (0.9 * (n - 1) - floor(0.9 * (n - 1))) * (arr[least(CAST(floor(0.9 * (n - 1)) AS INT) + 1, n - 1)] - arr[CAST(floor(0.9 * (n - 1)) AS INT)]) AS p90
      FROM (SELECT person_id, game_type, stat, CAST(count(*) AS INT) AS n, avg(v) AS mean, min(v) AS mn, max(v) AS mx,
                   sort_array(collect_list(v)) AS arr,
                   avg(CAST(v = 0 AS DOUBLE)) AS s0, avg(CAST(v = 1 AS DOUBLE)) AS s1,
                   avg(CAST(v = 2 AS DOUBLE)) AS s2, avg(CAST(v >= 3 AS DOUBLE)) AS s3
            FROM (SELECT person_id, season_type AS game_type, stack(11, 'pts', CAST(pts AS DOUBLE), 'reb', CAST(reb AS DOUBLE), 'ast', CAST(ast AS DOUBLE),
                         'pra', CAST(pra AS DOUBLE), 'pr', CAST(pr AS DOUBLE), 'pa', CAST(pa AS DOUBLE), 'ra', CAST(ra AS DOUBLE),
                         'fg3m', CAST(fg3m AS DOUBLE), 'blk', CAST(blk AS DOUBLE), 'stl', CAST(stl AS DOUBLE),
                         'minutes', CAST(minutes AS DOUBLE)) AS (stat, v)
                  FROM (SELECT *, row_number() OVER (PARTITION BY person_id, season_type ORDER BY game_date DESC, game_id DESC) AS rn
                        FROM workspace.nba_v2_gold.player_game_log) WHERE rn <= 10)
            GROUP BY person_id, game_type, stat)) r
    ON r.person_id = t.person_id AND r.game_type = t.game_type AND r.stat = t.stat
  WHERE r.person_id IS NULL OR t.l10_games <> r.n
     OR abs(t.l10_mean - r.mean) > 0.0015 OR abs(t.l10_min - r.mn) > 0.0001 OR abs(t.l10_max - r.mx) > 0.0001
     OR abs(t.l10_median - r.p50) > 0.0015 OR abs(t.l10_p10 - r.p10) > 0.0015 OR abs(t.l10_p90 - r.p90) > 0.0015)
UNION ALL SELECT 'count_stat_shares_differ_from_recompute', count(*) FROM (
  SELECT 1 FROM {T} t JOIN (SELECT person_id, game_type, stat, n, mean, mn, mx, s0, s1, s2, s3,
        arr[CAST(floor(0.1 * (n - 1)) AS INT)] + (0.1 * (n - 1) - floor(0.1 * (n - 1))) * (arr[least(CAST(floor(0.1 * (n - 1)) AS INT) + 1, n - 1)] - arr[CAST(floor(0.1 * (n - 1)) AS INT)]) AS p10,
        arr[CAST(floor(0.5 * (n - 1)) AS INT)] + (0.5 * (n - 1) - floor(0.5 * (n - 1))) * (arr[least(CAST(floor(0.5 * (n - 1)) AS INT) + 1, n - 1)] - arr[CAST(floor(0.5 * (n - 1)) AS INT)]) AS p50,
        arr[CAST(floor(0.9 * (n - 1)) AS INT)] + (0.9 * (n - 1) - floor(0.9 * (n - 1))) * (arr[least(CAST(floor(0.9 * (n - 1)) AS INT) + 1, n - 1)] - arr[CAST(floor(0.9 * (n - 1)) AS INT)]) AS p90
      FROM (SELECT person_id, game_type, stat, CAST(count(*) AS INT) AS n, avg(v) AS mean, min(v) AS mn, max(v) AS mx,
                   sort_array(collect_list(v)) AS arr,
                   avg(CAST(v = 0 AS DOUBLE)) AS s0, avg(CAST(v = 1 AS DOUBLE)) AS s1,
                   avg(CAST(v = 2 AS DOUBLE)) AS s2, avg(CAST(v >= 3 AS DOUBLE)) AS s3
            FROM (SELECT person_id, season_type AS game_type, stack(11, 'pts', CAST(pts AS DOUBLE), 'reb', CAST(reb AS DOUBLE), 'ast', CAST(ast AS DOUBLE),
                         'pra', CAST(pra AS DOUBLE), 'pr', CAST(pr AS DOUBLE), 'pa', CAST(pa AS DOUBLE), 'ra', CAST(ra AS DOUBLE),
                         'fg3m', CAST(fg3m AS DOUBLE), 'blk', CAST(blk AS DOUBLE), 'stl', CAST(stl AS DOUBLE),
                         'minutes', CAST(minutes AS DOUBLE)) AS (stat, v)
                  FROM (SELECT *, row_number() OVER (PARTITION BY person_id, season_type ORDER BY game_date DESC, game_id DESC) AS rn
                        FROM workspace.nba_v2_gold.player_game_log) WHERE rn <= 10)
            GROUP BY person_id, game_type, stat)) r
    ON r.person_id = t.person_id AND r.game_type = t.game_type AND r.stat = t.stat
  WHERE t.stat IN ('fg3m', 'blk', 'stl')
    AND (abs(t.l10_share_0 - r.s0) > 0.0015 OR abs(t.l10_share_1 - r.s1) > 0.0015
         OR abs(t.l10_share_2 - r.s2) > 0.0015 OR abs(t.l10_share_3plus - r.s3) > 0.0015))
UNION ALL SELECT 'share_columns_invalid',
  count_if(stat IN ('fg3m', 'blk', 'stl') AND (l10_share_0 IS NULL OR abs(l10_share_0 + l10_share_1 + l10_share_2 + l10_share_3plus - 1) > 0.0025))
  + count_if(stat NOT IN ('fg3m', 'blk', 'stl') AND (l10_share_0 IS NOT NULL OR l10_share_1 IS NOT NULL
                                      OR l10_share_2 IS NOT NULL OR l10_share_3plus IS NOT NULL)) FROM {T}
UNION ALL SELECT 'order_invalid',
  count_if(NOT (l10_min <= l10_p10 + 0.0005 AND l10_p10 <= l10_median + 0.0005 AND l10_median <= l10_p90 + 0.0005
                AND l10_p90 <= l10_max + 0.0005 AND l10_mean >= l10_min - 0.0005 AND l10_mean <= l10_max + 0.0005)) FROM {T}
UNION ALL SELECT 'season_block_differs_from_recompute', count(*) FROM (
  SELECT 1 FROM {T} t LEFT JOIN (SELECT person_id, game_type, stat, count(*) AS n, avg(v) AS mean
      FROM (SELECT person_id, season_type AS game_type, stack(11, 'pts', CAST(pts AS DOUBLE), 'reb', CAST(reb AS DOUBLE), 'ast', CAST(ast AS DOUBLE),
                         'pra', CAST(pra AS DOUBLE), 'pr', CAST(pr AS DOUBLE), 'pa', CAST(pa AS DOUBLE), 'ra', CAST(ra AS DOUBLE),
                         'fg3m', CAST(fg3m AS DOUBLE), 'blk', CAST(blk AS DOUBLE), 'stl', CAST(stl AS DOUBLE),
                         'minutes', CAST(minutes AS DOUBLE)) AS (stat, v)
            FROM workspace.nba_v2_gold.player_game_log WHERE season = (SELECT max(season) FROM workspace.nba_v2_gold.player_game_log))
      GROUP BY person_id, game_type, stat) r ON r.person_id = t.person_id AND r.game_type = t.game_type AND r.stat = t.stat
  WHERE t.season_games <> coalesce(r.n, 0)
     OR (t.season_mean IS NULL) <> (r.mean IS NULL)
     OR abs(coalesce(t.season_mean, 0) - coalesce(r.mean, 0)) > 0.0015)
