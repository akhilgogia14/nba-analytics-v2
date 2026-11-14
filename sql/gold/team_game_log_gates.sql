-- Quality gates for gold team_game_log. Each row: gate name, bad-row count (0 = pass).
-- The placeholder token is replaced by the table name, or by a WITH-clause alias, under test.
-- Everything is checked against silver team_game and against the table's own numbers in plain SQL (the PySpark code
-- is not reused). One row per team per game played; game types are never mixed (the row carries its own type).
SELECT 'key_not_unique' AS gate, count(*) - count(DISTINCT team_id, game_id) AS bad FROM {T}
UNION ALL SELECT 'key_has_null', count_if(team_id IS NULL OR game_id IS NULL) FROM {T}
UNION ALL SELECT 'row_count_differs_from_silver',
  abs((SELECT count(*) FROM workspace.nba_v2_silver.team_game) - (SELECT count(*) FROM {T}))
UNION ALL SELECT 'game_types_wrong', count_if(game_type IS NULL OR game_type NOT IN ('regular-season', 'playoffs', 'play-in', 'nba-cup')) FROM {T}
UNION ALL SELECT 'season_label_wrong', count_if(season_label IS NULL OR season_label <> concat(CAST(season - 1 AS STRING), '-', right(CAST(season AS STRING), 2))) FROM {T}
UNION ALL SELECT 'rows_differ_from_silver', count(*) FROM {T} t
  LEFT JOIN workspace.nba_v2_silver.team_game s ON s.game_id = t.game_id AND s.team_id = t.team_id
  WHERE s.game_id IS NULL OR NOT (t.game_date <=> s.game_date) OR NOT (t.season <=> s.season) OR NOT (t.game_type <=> s.season_type)
     OR NOT (t.team_name <=> s.team_name) OR NOT (t.team_tricode <=> s.team_tricode)
     OR NOT (t.opponent_team_id <=> s.opponent_team_id) OR NOT (t.opponent_tricode <=> s.opponent_tricode)
     OR NOT (t.is_home <=> s.is_home) OR NOT (t.won <=> s.won) OR NOT (t.pts <=> s.pts) OR NOT (t.opp_pts <=> s.opp_pts)
     OR NOT (t.overtime_periods <=> s.overtime_periods)
     OR NOT (t.fgm <=> s.fgm) OR NOT (t.fga <=> s.fga) OR NOT (t.fg3m <=> s.fg3m) OR NOT (t.fg3a <=> s.fg3a)
     OR NOT (t.ftm <=> s.ftm) OR NOT (t.fta <=> s.fta) OR NOT (t.oreb <=> s.oreb) OR NOT (t.dreb <=> s.dreb)
     OR NOT (t.reb <=> s.reb) OR NOT (t.ast <=> s.ast) OR NOT (t.stl <=> s.stl) OR NOT (t.blk <=> s.blk)
     OR NOT (t.tov <=> s.tov) OR NOT (t.pf <=> s.pf)
UNION ALL SELECT 'margin_or_result_wrong', count_if(margin <> pts - opp_pts OR won <> (pts > opp_pts) OR margin = 0) FROM {T}
UNION ALL SELECT 'game_not_mirrored_by_opponent', count(*) FROM {T} t
  LEFT JOIN {T} o ON o.game_id = t.game_id AND o.team_id = t.opponent_team_id
  WHERE o.game_id IS NULL OR o.opponent_team_id <> t.team_id OR o.pts <> t.opp_pts OR o.opp_pts <> t.pts
     OR o.is_home = t.is_home OR o.won = t.won OR o.game_date <> t.game_date OR o.game_type <> t.game_type
UNION ALL SELECT 'box_score_missing', count_if(fgm IS NULL OR fga IS NULL OR fg3m IS NULL OR fg3a IS NULL OR ftm IS NULL
  OR fta IS NULL OR oreb IS NULL OR dreb IS NULL OR reb IS NULL OR ast IS NULL OR stl IS NULL OR blk IS NULL
  OR tov IS NULL OR pf IS NULL OR pts IS NULL OR opp_pts IS NULL) FROM {T}
UNION ALL SELECT 'box_score_arithmetic_wrong', count_if(fgm > fga OR fg3m > fg3a OR fg3m > fgm OR fg3a > fga OR ftm > fta
  OR oreb + dreb <> reb OR pts <> 2 * fgm + fg3m + ftm) FROM {T}
