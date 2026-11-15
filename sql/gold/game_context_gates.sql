-- Quality gates for gold game_context. Each row: gate name, bad-row count (0 = pass).
-- The placeholder token is replaced by the table name, or by a WITH-clause alias, under test.
-- Everything is recomputed from silver game in plain SQL by a different route than the PySpark code (which uses window
-- functions): "the latest earlier game" is found with a join and max(), counts with a date-range join.
-- One row per team per game on the schedule (regular season, playoffs, play-in, NBA Cup), played or not.
SELECT 'key_not_unique' AS gate, count(*) - count(DISTINCT team_id, game_id) AS bad FROM {T}
UNION ALL SELECT 'key_has_null', count_if(team_id IS NULL OR game_id IS NULL) FROM {T}
UNION ALL SELECT 'row_count_differs_from_silver',
  abs(2 * (SELECT count(*) FROM workspace.nba_v2_silver.game WHERE season_type IN ('regular-season', 'playoffs', 'play-in', 'nba-cup')) - (SELECT count(*) FROM {T}))
UNION ALL SELECT 'game_types_wrong', count_if(game_type IS NULL OR game_type NOT IN ('regular-season', 'playoffs', 'play-in', 'nba-cup')) FROM {T}
UNION ALL SELECT 'season_label_wrong', count_if(season_label IS NULL OR season_label <> concat(CAST(season - 1 AS STRING), '-', right(CAST(season AS STRING), 2))) FROM {T}
UNION ALL SELECT 'rows_differ_from_silver', count(*) FROM {T} t
  LEFT JOIN workspace.nba_v2_silver.game s ON s.game_id = t.game_id
  WHERE s.game_id IS NULL OR NOT (t.game_date <=> s.game_date) OR NOT (t.season <=> s.season) OR NOT (t.game_type <=> s.season_type)
     OR NOT (t.is_final <=> s.is_final) OR t.team_id NOT IN (s.home_team_id, s.away_team_id)
     OR NOT (t.is_home <=> (t.team_id = s.home_team_id))
     OR NOT (t.opponent_team_id <=> CASE WHEN t.is_home THEN s.away_team_id ELSE s.home_team_id END)
     OR NOT (t.team_tricode <=> CASE WHEN t.is_home THEN s.home_tricode ELSE s.away_tricode END)
     OR NOT (t.team_name <=> CASE WHEN t.is_home THEN s.home_team_name ELSE s.away_team_name END)
     OR NOT (t.opponent_tricode <=> CASE WHEN t.is_home THEN s.away_tricode ELSE s.home_tricode END)
UNION ALL SELECT 'game_not_mirrored_by_opponent', count(*) FROM {T} t
  LEFT JOIN {T} o ON o.game_id = t.game_id AND o.team_id = t.opponent_team_id
  WHERE o.game_id IS NULL OR o.opponent_team_id <> t.team_id OR o.is_home = t.is_home OR o.game_date <> t.game_date
     OR o.game_type <> t.game_type OR o.is_final <> t.is_final
UNION ALL SELECT 'team_twice_on_one_date', count(*) FROM (SELECT team_id, game_date FROM {T} GROUP BY team_id, game_date HAVING count(*) > 1)
-- days_rest = days since the latest EARLIER game of the same team in the same season, minus one (NULL when there is none)
UNION ALL SELECT 'days_rest_wrong', count(*) FROM {T} t
  LEFT JOIN (SELECT a.team_id, a.game_id, datediff(a.game_date, max(b.game_date)) - 1 AS expected
             FROM {T} a JOIN {T} b ON b.team_id = a.team_id AND b.season = a.season AND b.game_date < a.game_date
             GROUP BY a.team_id, a.game_id, a.game_date) e ON e.team_id = t.team_id AND e.game_id = t.game_id
  WHERE NOT (t.days_rest <=> e.expected)
UNION ALL SELECT 'b2b_flag_or_negative_rest_wrong', count_if(days_rest < 0 OR NOT (is_b2b <=> (days_rest = 0))) FROM {T}
-- games_in_4 / games_in_6 = this team's games in the 4 / 6 days ending on the game date, this game included
UNION ALL SELECT 'stretch_counts_wrong', count(*) FROM {T} t
  LEFT JOIN (SELECT a.team_id, a.game_id,
                    count_if(b.game_date >= date_sub(a.game_date, 3)) AS in4, count(*) AS in6
             FROM {T} a JOIN {T} b ON b.team_id = a.team_id AND b.season = a.season
                                   AND b.game_date <= a.game_date AND b.game_date >= date_sub(a.game_date, 5)
             GROUP BY a.team_id, a.game_id) c ON c.team_id = t.team_id AND c.game_id = t.game_id
  WHERE NOT (t.games_in_4 <=> c.in4) OR NOT (t.games_in_6 <=> c.in6)
     OR NOT (t.is_3_in_4 <=> (t.games_in_4 >= 3)) OR NOT (t.is_4_in_6 <=> (t.games_in_6 >= 4))
-- stint_game_number = 1 on the first game of a season or when home/away flipped, otherwise the previous game's number + 1
UNION ALL SELECT 'stint_number_wrong', count(*) FROM {T} t
  LEFT JOIN (SELECT a.team_id, a.game_id, max(b.game_date) AS prev_date
             FROM {T} a JOIN {T} b ON b.team_id = a.team_id AND b.season = a.season AND b.game_date < a.game_date
             GROUP BY a.team_id, a.game_id) pd ON pd.team_id = t.team_id AND pd.game_id = t.game_id
  LEFT JOIN {T} p ON p.team_id = t.team_id AND p.season = t.season AND p.game_date = pd.prev_date
  WHERE NOT (t.stint_game_number <=> CASE WHEN p.game_id IS NOT NULL AND p.is_home = t.is_home THEN p.stint_game_number + 1 ELSE 1 END)
UNION ALL SELECT 'opponent_rest_or_edge_wrong', count(*) FROM {T} t
  LEFT JOIN {T} o ON o.game_id = t.game_id AND o.team_id = t.opponent_team_id
  WHERE NOT (t.opp_days_rest <=> o.days_rest) OR NOT (t.rest_edge <=> (t.days_rest - o.days_rest))
