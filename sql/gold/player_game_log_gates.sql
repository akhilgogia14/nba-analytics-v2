-- Quality gates for gold player_game_log. Each row: gate name, bad-row count (0 = pass).
-- The placeholder token is replaced by the table name, or by a WITH-clause alias, under test.
-- The two recompute gates rebuild the "prior" averages a second way (a self-join on game numbers, not a window
-- frame) for all 7 stats, so a mix-up of stats or an off-by-one frame cannot pass.
SELECT 'key_not_unique' AS gate, count(*) - count(DISTINCT game_id, person_id) AS bad FROM {T}
UNION ALL SELECT 'key_has_null', count_if(game_id IS NULL OR person_id IS NULL) FROM {T}
UNION ALL SELECT 'rows_differ_from_silver_played',
  (SELECT count(*) FROM workspace.nba_v2_silver.player_game WHERE played) - (SELECT count(*) FROM {T})
UNION ALL SELECT 'missing_name', count_if(player_name IS NULL OR trim(player_name) = '') FROM {T}
UNION ALL SELECT 'no_minutes', count_if(minutes IS NULL OR minutes <= 0) FROM {T}
UNION ALL SELECT 'combo_mismatch',
  count_if(pra <> pts + reb + ast OR pr <> pts + reb OR pa <> pts + ast OR ra <> reb + ast) FROM {T}
UNION ALL SELECT 'season_label_wrong',
  count_if(season_label <> concat(CAST(season - 1 AS STRING), '-', substr(CAST(season AS STRING), 3, 2))) FROM {T}
UNION ALL SELECT 'regular_flag_wrong', count_if(is_regular_season <> (season_type = 'regular-season')) FROM {T}
UNION ALL SELECT 'prior_window_too_big', count_if(prior_l10_games > 10) FROM {T}
UNION ALL SELECT 'prior_without_history',
  count_if((game_number = 1 AND (prior_l10_games <> 0 OR prior_l10_pts IS NOT NULL OR prior_season_pts IS NOT NULL))
           OR (prior_l10_games = 0 AND prior_l10_pts IS NOT NULL)
           OR (prior_season_games = 0 AND prior_season_pts IS NOT NULL)) FROM {T}
UNION ALL SELECT 'season_count_not_game_number_minus_1', count_if(prior_season_games <> season_game_number - 1) FROM {T}
UNION ALL SELECT 'earlier_season_label_invalid',
  count_if(prior_l10_games_earlier_season < 0 OR prior_l10_games_earlier_season > prior_l10_games
           OR prior_l10_games_not_regular < 0 OR prior_l10_games_not_regular > prior_l10_games) FROM {T}
UNION ALL SELECT 'prior_l10_differs_from_recompute', count(*) FROM (
  SELECT a.game_id FROM {T} a
  LEFT JOIN (
    SELECT cur.game_id, cur.person_id, count(prev.game_id) AS n,
           sum(CASE WHEN prev.season < cur.season THEN 1 ELSE 0 END) AS earlier,
           sum(CASE WHEN prev.season_type <> 'regular-season' THEN 1 ELSE 0 END) AS non_regular,
           avg(prev.pts) AS pts, avg(prev.reb) AS reb, avg(prev.ast) AS ast, avg(prev.fg3m) AS fg3m,
           avg(prev.blk) AS blk, avg(prev.stl) AS stl, avg(prev.minutes) AS minutes
    FROM (SELECT game_id, person_id, season, row_number() OVER (PARTITION BY person_id ORDER BY game_date, game_id) AS rn
          FROM workspace.nba_v2_silver.player_game WHERE played) cur
    LEFT JOIN (SELECT person_id, season, season_type, row_number() OVER (PARTITION BY person_id ORDER BY game_date, game_id) AS rn,
                      game_id, pts, reb, ast, fg3m, blk, stl, minutes
               FROM workspace.nba_v2_silver.player_game WHERE played) prev
      ON prev.person_id = cur.person_id AND prev.rn < cur.rn AND prev.rn >= cur.rn - 10
    GROUP BY cur.game_id, cur.person_id) r
    ON r.game_id = a.game_id AND r.person_id = a.person_id
  WHERE r.game_id IS NULL OR a.prior_l10_games <> r.n
     OR a.prior_l10_games_earlier_season <> coalesce(r.earlier, 0)
     OR a.prior_l10_games_not_regular <> coalesce(r.non_regular, 0)
     OR (a.prior_l10_pts IS NULL) <> (r.pts IS NULL)
     OR abs(coalesce(a.prior_l10_pts, 0) - coalesce(r.pts, 0)) > 0.0015
     OR abs(coalesce(a.prior_l10_reb, 0) - coalesce(r.reb, 0)) > 0.0015
     OR abs(coalesce(a.prior_l10_ast, 0) - coalesce(r.ast, 0)) > 0.0015
     OR abs(coalesce(a.prior_l10_fg3m, 0) - coalesce(r.fg3m, 0)) > 0.0015
     OR abs(coalesce(a.prior_l10_blk, 0) - coalesce(r.blk, 0)) > 0.0015
     OR abs(coalesce(a.prior_l10_stl, 0) - coalesce(r.stl, 0)) > 0.0015
     OR abs(coalesce(a.prior_l10_minutes, 0) - coalesce(r.minutes, 0)) > 0.0015)
UNION ALL SELECT 'prior_season_differs_from_recompute', count(*) FROM (
  SELECT a.game_id FROM {T} a
  LEFT JOIN (
    SELECT cur.game_id, cur.person_id, count(prev.game_id) AS n,
           avg(prev.pts) AS pts, avg(prev.reb) AS reb, avg(prev.ast) AS ast, avg(prev.fg3m) AS fg3m,
           avg(prev.blk) AS blk, avg(prev.stl) AS stl, avg(prev.minutes) AS minutes
    FROM (SELECT game_id, person_id, season, row_number() OVER (PARTITION BY person_id ORDER BY game_date, game_id) AS rn
          FROM workspace.nba_v2_silver.player_game WHERE played) cur
    LEFT JOIN (SELECT person_id, season, row_number() OVER (PARTITION BY person_id ORDER BY game_date, game_id) AS rn,
                      game_id, pts, reb, ast, fg3m, blk, stl, minutes
               FROM workspace.nba_v2_silver.player_game WHERE played) prev
      ON prev.person_id = cur.person_id AND prev.season = cur.season AND prev.rn < cur.rn
    GROUP BY cur.game_id, cur.person_id) r
    ON r.game_id = a.game_id AND r.person_id = a.person_id
  WHERE r.game_id IS NULL OR a.prior_season_games <> r.n
     OR (a.prior_season_pts IS NULL) <> (r.pts IS NULL)
     OR abs(coalesce(a.prior_season_pts, 0) - coalesce(r.pts, 0)) > 0.0015
     OR abs(coalesce(a.prior_season_reb, 0) - coalesce(r.reb, 0)) > 0.0015
     OR abs(coalesce(a.prior_season_ast, 0) - coalesce(r.ast, 0)) > 0.0015
     OR abs(coalesce(a.prior_season_fg3m, 0) - coalesce(r.fg3m, 0)) > 0.0015
     OR abs(coalesce(a.prior_season_blk, 0) - coalesce(r.blk, 0)) > 0.0015
     OR abs(coalesce(a.prior_season_stl, 0) - coalesce(r.stl, 0)) > 0.0015
     OR abs(coalesce(a.prior_season_minutes, 0) - coalesce(r.minutes, 0)) > 0.0015)
