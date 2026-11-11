-- Silver: one row per team per game, key (game_id, team_id).
-- Source: bronze team_boxscores (real teams only), joined to schedules (date, season type) and to the
-- opponent's own box-score row (opponent points come from the box score, not the schedule, which lags).
-- Rules: docs/spike-findings.md section 9 (ignore team_id 0). Team minutes are 'mm:ss': 240:00 plus 25:00 per overtime.
SELECT
  t.game_id,
  t.team_id,
  CAST(s.game_date AS DATE)                    AS game_date,
  t.season,
  s.season_type,
  t.season_type_id,
  concat_ws(' ', t.team_city, t.team_name)     AS team_name,
  t.team_tricode,
  (t.side = 'home')                            AS is_home,
  o.team_id                                    AS opponent_team_id,
  o.team_tricode                               AS opponent_tricode,
  mins.minutes_seconds,
  CAST((mins.minutes_seconds - 14400) / 1500 AS INT) AS overtime_periods,
  t.points                                     AS pts,
  o.points                                     AS opp_pts,
  (t.points > o.points)                        AS won,
  t.rebounds_total                             AS reb,
  t.assists                                    AS ast,
  t.three_pointers_made                        AS fg3m,
  t.blocks                                     AS blk,
  t.steals                                     AS stl,
  t.turnovers                                  AS tov,
  t.fouls_personal                             AS pf,
  t.field_goals_made                           AS fgm,
  t.field_goals_attempted                      AS fga,
  t.three_pointers_attempted                   AS fg3a,
  t.free_throws_made                           AS ftm,
  t.free_throws_attempted                      AS fta,
  t.rebounds_offensive                         AS oreb,
  t.rebounds_defensive                         AS dreb,
  t.plus_minus_points                          AS plus_minus
FROM workspace.nba_v2_bronze.team_boxscores t
JOIN workspace.nba_v2_bronze.team_boxscores o
  ON o.game_id = t.game_id AND o.side <> t.side AND o.team_id <> 0
JOIN workspace.nba_v2_bronze.schedules s ON s.game_id = t.game_id
CROSS JOIN LATERAL (
  SELECT CASE
           WHEN t.minutes IS NULL OR trim(t.minutes) = '' THEN NULL
           ELSE try_cast(split_part(t.minutes, ':', 1) AS INT) * 60
              + try_cast(split_part(t.minutes, ':', 2) AS INT)
         END AS minutes_seconds
) mins
WHERE t.team_id <> 0
