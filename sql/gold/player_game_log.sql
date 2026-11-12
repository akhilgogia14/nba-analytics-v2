-- Gold: one row per PLAYED player-game, key (game_id, person_id). Source: silver player_game (played = true only).
-- "prior" columns describe the player's games BEFORE this one (the current game is never in its own window), so they
-- are safe inputs for a back-test. prior_l10_* = the previous 10 played games (crossing into earlier seasons if
-- needed); prior_season_* = earlier played games of the same season.
-- Labels: season_label (e.g. 2026-27), is_regular_season (false for play-in, playoffs, cup), and
-- prior_l10_games_earlier_season / prior_l10_games_not_regular = how many games in the 10-game window come from an
-- earlier season / are not regular-season games. No blend weight is chosen here; both averages are stored.
SELECT
  w.game_id,
  w.person_id,
  w.player_name,
  w.team_id,
  w.team_tricode,
  w.opponent_team_id,
  w.opponent_tricode,
  w.is_home,
  w.game_date,
  w.season,
  concat(CAST(w.season - 1 AS STRING), '-', substr(CAST(w.season AS STRING), 3, 2)) AS season_label,
  w.season_type,
  (w.season_type = 'regular-season')                                  AS is_regular_season,
  w.game_number,
  w.season_game_number,
  w.started,
  w.minutes,
  w.pts, w.reb, w.ast, w.fg3m, w.blk, w.stl, w.tov,
  w.pts + w.reb + w.ast                                               AS pra,
  w.pts + w.reb                                                       AS pr,
  w.pts + w.ast                                                       AS pa,
  w.reb + w.ast                                                       AS ra,
  w.prior_l10_games,
  w.prior_l10_games - least(w.prior_season_games, w.prior_l10_games)  AS prior_l10_games_earlier_season,
  coalesce(w.prior_l10_non_regular, 0)                                AS prior_l10_games_not_regular,
  w.prior_l10_pts, w.prior_l10_reb, w.prior_l10_ast, w.prior_l10_fg3m, w.prior_l10_blk, w.prior_l10_stl, w.prior_l10_minutes,
  w.prior_season_games,
  w.prior_season_pts, w.prior_season_reb, w.prior_season_ast, w.prior_season_fg3m, w.prior_season_blk, w.prior_season_stl, w.prior_season_minutes
FROM (
  SELECT
    game_id, person_id, team_id, team_tricode, opponent_team_id, opponent_tricode, is_home, game_date, season,
    season_type, started, minutes, pts, reb, ast, fg3m, blk, stl, tov,
    first_value(player_name) OVER (PARTITION BY person_id ORDER BY game_date DESC, game_id DESC) AS player_name,
    row_number() OVER (PARTITION BY person_id ORDER BY game_date, game_id)                  AS game_number,
    row_number() OVER (PARTITION BY person_id, season ORDER BY game_date, game_id)          AS season_game_number,
    count(*) OVER l10                                                                       AS prior_l10_games,
    sum(CASE WHEN season_type <> 'regular-season' THEN 1 ELSE 0 END) OVER l10               AS prior_l10_non_regular,
    round(avg(pts) OVER l10, 3) AS prior_l10_pts, round(avg(reb) OVER l10, 3) AS prior_l10_reb,
    round(avg(ast) OVER l10, 3) AS prior_l10_ast, round(avg(fg3m) OVER l10, 3) AS prior_l10_fg3m,
    round(avg(blk) OVER l10, 3) AS prior_l10_blk, round(avg(stl) OVER l10, 3) AS prior_l10_stl,
    round(avg(minutes) OVER l10, 3) AS prior_l10_minutes,
    count(*) OVER sea                                                                       AS prior_season_games,
    round(avg(pts) OVER sea, 3) AS prior_season_pts, round(avg(reb) OVER sea, 3) AS prior_season_reb,
    round(avg(ast) OVER sea, 3) AS prior_season_ast, round(avg(fg3m) OVER sea, 3) AS prior_season_fg3m,
    round(avg(blk) OVER sea, 3) AS prior_season_blk, round(avg(stl) OVER sea, 3) AS prior_season_stl,
    round(avg(minutes) OVER sea, 3) AS prior_season_minutes
  FROM workspace.nba_v2_silver.player_game
  WHERE played
  WINDOW
    l10 AS (PARTITION BY person_id ORDER BY game_date, game_id ROWS BETWEEN 10 PRECEDING AND 1 PRECEDING),
    sea AS (PARTITION BY person_id, season ORDER BY game_date, game_id ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING)
) w
