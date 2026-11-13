-- Quality gates for gold player_season_games. Each row: gate name, bad-row count (0 = pass).
-- The placeholder token is replaced by the table name, or by a WITH-clause alias, under test.
-- Everything is recomputed straight from silver player_game and team_game in plain SQL (the PySpark code is not reused).
-- "Played" = any minutes, OR any box-score stat above 0, OR a non-zero plus/minus (the owner's rule, 2026-11-13);
-- it is spelled out in full here so that a mistake in the PySpark rule cannot be repeated.
-- A grid = one player, one team, one season, one game type: it must list ALL of that team's games of that type.
SELECT 'key_not_unique' AS gate, count(*) - count(DISTINCT person_id, team_id, game_id) AS bad FROM {T}
UNION ALL SELECT 'key_has_null', count_if(person_id IS NULL OR team_id IS NULL OR game_id IS NULL) FROM {T}
UNION ALL SELECT 'game_types_wrong', count_if(game_type IS NULL OR game_type NOT IN ('regular-season', 'playoffs', 'play-in', 'nba-cup')) FROM {T}
UNION ALL SELECT 'season_label_wrong', count_if(season_label IS NULL OR season_label <> concat(CAST(season - 1 AS STRING), '-', right(CAST(season AS STRING), 2))) FROM {T}
UNION ALL SELECT 'grid_size_differs_from_schedule', count(*) FROM (
  SELECT team_id, season, game_type, person_id, count(*) AS n FROM {T} GROUP BY team_id, season, game_type, person_id) g
  LEFT JOIN (SELECT team_id, season, season_type, count(*) AS n FROM workspace.nba_v2_silver.team_game GROUP BY team_id, season, season_type) s
    ON s.team_id = g.team_id AND s.season = g.season AND s.season_type = g.game_type
  WHERE s.n IS NULL OR g.n <> s.n
UNION ALL SELECT 'rows_differ_from_schedule', count(*) FROM {T} t
  LEFT JOIN workspace.nba_v2_silver.team_game s ON s.game_id = t.game_id AND s.team_id = t.team_id
  WHERE s.game_id IS NULL OR t.game_date <> s.game_date OR t.season <> s.season OR t.game_type <> s.season_type
     OR t.team_tricode <> s.team_tricode OR t.opponent_team_id <> s.opponent_team_id OR t.opponent_tricode <> s.opponent_tricode
     OR t.is_home <> s.is_home
UNION ALL SELECT 'game_number_or_team_games_wrong', count(*) FROM {T} t
  LEFT JOIN (SELECT game_id, team_id,
                    row_number() OVER (PARTITION BY team_id, season, season_type ORDER BY game_date, game_id) AS rn,
                    count(*) OVER (PARTITION BY team_id, season, season_type) AS cnt FROM workspace.nba_v2_silver.team_game) r
    ON r.game_id = t.game_id AND r.team_id = t.team_id
  WHERE r.game_id IS NULL OR t.game_number <> r.rn OR t.team_games <> r.cnt
UNION ALL SELECT 'grid_without_a_played_game', count(*) FROM (
  SELECT 1 FROM {T} GROUP BY person_id, team_id, season, game_type HAVING sum(CASE WHEN played THEN 1 ELSE 0 END) = 0)
UNION ALL SELECT 'played_flag_differs_from_silver', count(*) FROM {T} t
  LEFT JOIN (SELECT * FROM workspace.nba_v2_silver.player_game WHERE (coalesce(minutes_seconds, 0) > 0 OR coalesce(pts, 0) > 0 OR coalesce(reb, 0) > 0 OR coalesce(ast, 0) > 0 OR coalesce(fg3m, 0) > 0 OR coalesce(blk, 0) > 0 OR coalesce(stl, 0) > 0 OR coalesce(tov, 0) > 0 OR coalesce(pf, 0) > 0 OR coalesce(fgm, 0) > 0 OR coalesce(fga, 0) > 0 OR coalesce(fg3a, 0) > 0 OR coalesce(ftm, 0) > 0 OR coalesce(fta, 0) > 0 OR coalesce(oreb, 0) > 0 OR coalesce(dreb, 0) > 0 OR coalesce(plus_minus, 0) <> 0)) p ON p.game_id = t.game_id AND p.person_id = t.person_id AND p.team_id = t.team_id
  WHERE t.played <> (p.game_id IS NOT NULL)
UNION ALL SELECT 'played_game_missing_from_table', count(*) FROM (SELECT * FROM workspace.nba_v2_silver.player_game WHERE (coalesce(minutes_seconds, 0) > 0 OR coalesce(pts, 0) > 0 OR coalesce(reb, 0) > 0 OR coalesce(ast, 0) > 0 OR coalesce(fg3m, 0) > 0 OR coalesce(blk, 0) > 0 OR coalesce(stl, 0) > 0 OR coalesce(tov, 0) > 0 OR coalesce(pf, 0) > 0 OR coalesce(fgm, 0) > 0 OR coalesce(fga, 0) > 0 OR coalesce(fg3a, 0) > 0 OR coalesce(ftm, 0) > 0 OR coalesce(fta, 0) > 0 OR coalesce(oreb, 0) > 0 OR coalesce(dreb, 0) > 0 OR coalesce(plus_minus, 0) <> 0)) p
  LEFT JOIN {T} t ON t.game_id = p.game_id AND t.person_id = p.person_id AND t.team_id = p.team_id
  WHERE t.game_id IS NULL
UNION ALL SELECT 'grids_differ_from_silver', count(*) FROM
  (SELECT DISTINCT person_id, team_id, season, game_type FROM {T}) t
  FULL OUTER JOIN (SELECT DISTINCT person_id, team_id, season, season_type FROM (SELECT * FROM workspace.nba_v2_silver.player_game WHERE (coalesce(minutes_seconds, 0) > 0 OR coalesce(pts, 0) > 0 OR coalesce(reb, 0) > 0 OR coalesce(ast, 0) > 0 OR coalesce(fg3m, 0) > 0 OR coalesce(blk, 0) > 0 OR coalesce(stl, 0) > 0 OR coalesce(tov, 0) > 0 OR coalesce(pf, 0) > 0 OR coalesce(fgm, 0) > 0 OR coalesce(fga, 0) > 0 OR coalesce(fg3a, 0) > 0 OR coalesce(ftm, 0) > 0 OR coalesce(fta, 0) > 0 OR coalesce(oreb, 0) > 0 OR coalesce(dreb, 0) > 0 OR coalesce(plus_minus, 0) <> 0))) s
    ON s.person_id = t.person_id AND s.team_id = t.team_id AND s.season = t.season AND s.season_type = t.game_type
  WHERE t.person_id IS NULL OR s.person_id IS NULL
UNION ALL SELECT 'stats_differ_from_silver', count(*) FROM {T} t
  LEFT JOIN workspace.nba_v2_silver.player_game p ON p.game_id = t.game_id AND p.person_id = t.person_id AND p.team_id = t.team_id
  WHERE (t.played AND (NOT (t.minutes <=> p.minutes) OR NOT (t.pts <=> p.pts) OR NOT (t.reb <=> p.reb) OR NOT (t.ast <=> p.ast) OR NOT (t.fg3m <=> p.fg3m) OR NOT (t.blk <=> p.blk) OR NOT (t.stl <=> p.stl))) OR (NOT t.played AND (t.minutes IS NOT NULL OR t.pts IS NOT NULL OR t.reb IS NOT NULL OR t.ast IS NOT NULL OR t.fg3m IS NOT NULL OR t.blk IS NOT NULL OR t.stl IS NOT NULL))
UNION ALL SELECT 'other_teams_wrong', count(*) FROM {T} t
  LEFT JOIN (SELECT a.person_id, a.team_id, a.season, a.season_type,
                    nullif(array_join(array_sort(collect_set(CASE WHEN b.team_id <> a.team_id THEN b.tri END)), ','), '') AS other
             FROM (SELECT x.person_id, x.team_id, x.season, x.season_type, max_by(tm.team_tricode, struct(tm.game_date, tm.game_id)) AS tri
        FROM (SELECT DISTINCT person_id, team_id, season, season_type FROM (SELECT * FROM workspace.nba_v2_silver.player_game WHERE (coalesce(minutes_seconds, 0) > 0 OR coalesce(pts, 0) > 0 OR coalesce(reb, 0) > 0 OR coalesce(ast, 0) > 0 OR coalesce(fg3m, 0) > 0 OR coalesce(blk, 0) > 0 OR coalesce(stl, 0) > 0 OR coalesce(tov, 0) > 0 OR coalesce(pf, 0) > 0 OR coalesce(fgm, 0) > 0 OR coalesce(fga, 0) > 0 OR coalesce(fg3a, 0) > 0 OR coalesce(ftm, 0) > 0 OR coalesce(fta, 0) > 0 OR coalesce(oreb, 0) > 0 OR coalesce(dreb, 0) > 0 OR coalesce(plus_minus, 0) <> 0))) x
        JOIN workspace.nba_v2_silver.team_game tm ON tm.team_id = x.team_id AND tm.season = x.season AND tm.season_type = x.season_type
        GROUP BY x.person_id, x.team_id, x.season, x.season_type) a JOIN (SELECT x.person_id, x.team_id, x.season, x.season_type, max_by(tm.team_tricode, struct(tm.game_date, tm.game_id)) AS tri
        FROM (SELECT DISTINCT person_id, team_id, season, season_type FROM (SELECT * FROM workspace.nba_v2_silver.player_game WHERE (coalesce(minutes_seconds, 0) > 0 OR coalesce(pts, 0) > 0 OR coalesce(reb, 0) > 0 OR coalesce(ast, 0) > 0 OR coalesce(fg3m, 0) > 0 OR coalesce(blk, 0) > 0 OR coalesce(stl, 0) > 0 OR coalesce(tov, 0) > 0 OR coalesce(pf, 0) > 0 OR coalesce(fgm, 0) > 0 OR coalesce(fga, 0) > 0 OR coalesce(fg3a, 0) > 0 OR coalesce(ftm, 0) > 0 OR coalesce(fta, 0) > 0 OR coalesce(oreb, 0) > 0 OR coalesce(dreb, 0) > 0 OR coalesce(plus_minus, 0) <> 0))) x
        JOIN workspace.nba_v2_silver.team_game tm ON tm.team_id = x.team_id AND tm.season = x.season AND tm.season_type = x.season_type
        GROUP BY x.person_id, x.team_id, x.season, x.season_type) b
               ON b.person_id = a.person_id AND b.season = a.season AND b.season_type = a.season_type
             GROUP BY a.person_id, a.team_id, a.season, a.season_type) r
    ON r.person_id = t.person_id AND r.team_id = t.team_id AND r.season = t.season AND r.season_type = t.game_type
  WHERE r.person_id IS NULL OR NOT (t.other_teams <=> r.other)
UNION ALL SELECT 'player_name_wrong', count(*) FROM {T} t
  LEFT JOIN (SELECT person_id, max_by(player_name, struct(game_date, game_id)) AS nm FROM workspace.nba_v2_silver.player_game GROUP BY person_id) n
    ON n.person_id = t.person_id
  WHERE n.person_id IS NULL OR NOT (t.player_name <=> n.nm)
