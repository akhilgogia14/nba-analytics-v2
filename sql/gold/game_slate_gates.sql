-- Quality gates for gold game_slate. Each row: gate name, bad-row count (0 = pass).
-- The placeholder token is replaced by the table name, or by a WITH-clause alias, under test.
-- Everything is checked against silver game and against the table's own numbers in plain SQL (the PySpark code is not
-- reused). One row per game of the latest season; game types are never mixed (the row carries its own type).
SELECT 'key_not_unique' AS gate, count(*) - count(DISTINCT game_id) AS bad FROM {T}
UNION ALL SELECT 'key_has_null', count_if(game_id IS NULL) FROM {T}
UNION ALL SELECT 'row_count_differs_from_silver',
  abs((SELECT count(*) FROM workspace.nba_v2_silver.game WHERE season = (SELECT max(season) FROM workspace.nba_v2_silver.game)) - (SELECT count(*) FROM {T}))
UNION ALL SELECT 'not_the_latest_season', count_if(season <> (SELECT max(season) FROM workspace.nba_v2_silver.game) OR season IS NULL) FROM {T}
UNION ALL SELECT 'game_types_wrong', count_if(game_type IS NULL OR game_type NOT IN ('preseason', 'regular-season', 'playoffs', 'play-in', 'nba-cup', 'all-star')) FROM {T}
UNION ALL SELECT 'season_label_wrong', count_if(season_label IS NULL OR season_label <> concat(CAST(season - 1 AS STRING), '-', right(CAST(season AS STRING), 2))) FROM {T}
UNION ALL SELECT 'rows_differ_from_silver', count(*) FROM {T} t
  LEFT JOIN workspace.nba_v2_silver.game s ON s.game_id = t.game_id
  WHERE s.game_id IS NULL OR NOT (t.game_date <=> s.game_date) OR NOT (t.season <=> s.season) OR NOT (t.game_type <=> s.season_type)
     OR NOT (t.home_team_id <=> s.home_team_id) OR NOT (t.home_tricode <=> s.home_tricode) OR NOT (t.home_team_name <=> s.home_team_name)
     OR NOT (t.away_team_id <=> s.away_team_id) OR NOT (t.away_tricode <=> s.away_tricode) OR NOT (t.away_team_name <=> s.away_team_name)
     OR NOT (t.home_pts <=> s.home_pts) OR NOT (t.away_pts <=> s.away_pts) OR NOT (t.is_final <=> s.is_final) OR NOT (t.home_won <=> s.home_won)
UNION ALL SELECT 'date_or_teams_missing', count_if(game_date IS NULL OR home_team_id IS NULL OR away_team_id IS NULL
  OR home_tricode IS NULL OR away_tricode IS NULL OR home_team_name IS NULL OR away_team_name IS NULL) FROM {T}
UNION ALL SELECT 'team_plays_itself', count_if(home_team_id = away_team_id) FROM {T}
-- a final game has both scores, no tie, and home_won agrees with them; an unplayed game has no score and no winner
UNION ALL SELECT 'final_flag_or_score_wrong', count_if(is_final IS NULL
  OR (is_final AND (home_pts IS NULL OR away_pts IS NULL OR home_pts = away_pts OR home_won IS NULL OR home_won <> (home_pts > away_pts)))
  OR (NOT is_final AND (home_pts IS NOT NULL OR away_pts IS NOT NULL OR home_won IS NOT NULL))) FROM {T}
-- the same team twice on one date (all-star games use made-up teams, so they are left out)
UNION ALL SELECT 'team_twice_on_one_date', count(*) FROM (
  SELECT game_date, team_id FROM (
    SELECT game_date, home_team_id AS team_id FROM {T} WHERE game_type <> 'all-star'
    UNION ALL SELECT game_date, away_team_id FROM {T} WHERE game_type <> 'all-star')
  GROUP BY game_date, team_id HAVING count(*) > 1)
