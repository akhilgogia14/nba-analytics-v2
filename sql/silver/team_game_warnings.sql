-- Oddities worth a look, not failures. Each row: warning name, row key, details (JSON).
SELECT 'four_or_more_overtimes' AS warning,
       concat_ws('|', game_id, team_id) AS row_key,
       to_json(named_struct('game_date', CAST(game_date AS STRING), 'team', team_tricode, 'opponent', opponent_tricode,
                            'overtime_periods', overtime_periods, 'pts', pts, 'opp_pts', opp_pts)) AS detail
FROM {T}
WHERE overtime_periods >= 4
UNION ALL
-- A game held back from team_game because a team's minutes are not a possible total (240:00 plus 25:00 per overtime), usually
-- a box score with a player's minutes missing. It comes in on the next build after the source is corrected.
SELECT 'game_held_back_bad_team_minutes' AS warning, b.game_id AS row_key,
       to_json(named_struct('game_date', CAST(max(s.game_date) AS STRING),
                            'home', max(CASE WHEN b.side = 'home' THEN b.team_tricode END),
                            'away', max(CASE WHEN b.side = 'away' THEN b.team_tricode END),
                            'home_minutes', max(CASE WHEN b.side = 'home' THEN b.minutes END),
                            'away_minutes', max(CASE WHEN b.side = 'away' THEN b.minutes END))) AS detail
FROM workspace.nba_v2_bronze.team_boxscores b
JOIN workspace.nba_v2_bronze.schedules s ON s.game_id = b.game_id
WHERE b.team_id <> 0 AND b.game_id IN (
  SELECT game_id FROM (
    SELECT game_id, try_cast(split_part(minutes, ':', 1) AS INT) * 60 + try_cast(split_part(minutes, ':', 2) AS INT) AS secs
    FROM workspace.nba_v2_bronze.team_boxscores WHERE team_id <> 0)
  WHERE secs < 14400 OR (secs - 14400) % 1500 <> 0)
GROUP BY b.game_id
