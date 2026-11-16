-- Silver: one row per player per game, key (game_id, person_id).
-- Source: bronze player_boxscores joined to schedules (date, season type, opponent).
-- Rules: docs/spike-findings.md section 9.
--   * "played" means minutes_seconds > 0. Never taken from `comment` or from a missing row.
--   * minutes is text 'mm:ss' (seconds can be 60 or more, e.g. '9:60'); convert as m*60 + s.
--   * starter = position is not empty (only starters carry G/F/C).
--   * A game whose TEAM minutes are not a possible total (240:00 plus 25:00 per overtime; a box score with a player's minutes
--     missing) is held back here exactly as in team_game, so the two silver tables always agree about which games exist.
--     The warning that names it lives in team_game_warnings.sql.
SELECT
  p.game_id,
  p.person_id,
  p.team_id,
  CAST(s.game_date AS DATE)                                  AS game_date,
  p.season,
  s.season_type,
  p.season_type_id,
  concat_ws(' ', p.first_name, p.family_name)                AS player_name,
  p.team_tricode,
  (p.side = 'home')                                          AS is_home,
  CASE WHEN p.side = 'home' THEN s.away_team_id ELSE s.home_team_id END
                                                             AS opponent_team_id,
  CASE WHEN p.side = 'home' THEN s.away_team_abbreviation ELSE s.home_team_abbreviation END
                                                             AS opponent_tricode,
  mins.minutes_seconds,
  round(mins.minutes_seconds / 60.0, 2)                      AS minutes,
  coalesce(mins.minutes_seconds > 0, false)                  AS played,
  coalesce(trim(p.position) <> '', false)                    AS started,
  CASE WHEN coalesce(mins.minutes_seconds, 0) = 0 THEN nullif(trim(p.comment), '') END
                                                             AS dnp_reason,
  p.points                                                   AS pts,
  p.rebounds_total                                           AS reb,
  p.assists                                                  AS ast,
  p.three_pointers_made                                      AS fg3m,
  p.blocks                                                   AS blk,
  p.steals                                                   AS stl,
  p.turnovers                                                AS tov,
  p.fouls_personal                                           AS pf,
  p.field_goals_made                                         AS fgm,
  p.field_goals_attempted                                    AS fga,
  p.three_pointers_attempted                                 AS fg3a,
  p.free_throws_made                                         AS ftm,
  p.free_throws_attempted                                    AS fta,
  p.rebounds_offensive                                       AS oreb,
  p.rebounds_defensive                                       AS dreb,
  p.plus_minus_points                                        AS plus_minus
FROM workspace.nba_v2_bronze.player_boxscores p
JOIN workspace.nba_v2_bronze.schedules s ON s.game_id = p.game_id
CROSS JOIN LATERAL (
  SELECT CASE
           WHEN p.minutes IS NULL OR trim(p.minutes) = '' THEN NULL
           ELSE try_cast(split_part(p.minutes, ':', 1) AS INT) * 60
              + try_cast(split_part(p.minutes, ':', 2) AS INT)
         END AS minutes_seconds
) mins
WHERE p.team_id <> 0 AND p.person_id <> 0
  AND p.game_id NOT IN (
  SELECT game_id FROM (
      SELECT game_id, try_cast(split_part(minutes, ':', 1) AS INT) * 60 + try_cast(split_part(minutes, ':', 2) AS INT) AS secs
      FROM workspace.nba_v2_bronze.team_boxscores WHERE team_id <> 0)
    WHERE secs < 14400 OR (secs - 14400) % 1500 <> 0)
