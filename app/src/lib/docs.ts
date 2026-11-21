/**
 * The words on the Documentation pages, kept as data so the pages stay thin and a test can check them. Everything here is written from the
 * repo's own scripts and SQL (scripts/gold_*.py, sql/silver/*.sql, .github/workflows) and the real table columns in Databricks.
 * When a table gains or loses a column, change it here too (tests/docs.test.mjs checks the structure, not Databricks).
 */

export type Layer = 'bronze' | 'silver' | 'gold'
export type Col = { name: string; type: string; meaning: string }
export type DocTable = {
  layer: Layer
  name: string
  grain: string // what one row is
  key: string[]
  purpose: string
  usedBy: string // which page reads it, in words
  from: string[] // the tables it is built from (names, any layer)
  notes?: string[]
  columns: Col[]
}

export type DocsTopic = 'home' | 'model' | 'dictionary' | 'workflow' | 'architecture'
export const DOCS_TOPICS: { key: DocsTopic; label: string; path: string; blurb: string }[] = [
  { key: 'home', label: 'Start here', path: '#/docs', blurb: 'The short version, and answers to common questions.' },
  { key: 'model', label: 'Data model', path: '#/docs/model', blurb: 'The tables in three layers and how they connect.' },
  { key: 'dictionary', label: 'Data dictionary', path: '#/docs/dictionary', blurb: 'Every table and column, in plain words. Searchable.' },
  { key: 'workflow', label: 'Data workflow', path: '#/docs/workflow', blurb: 'How a game becomes a number on a page, step by step.' },
  { key: 'architecture', label: 'Architecture', path: '#/docs/architecture', blurb: 'The pieces of the system, how they connect, and why.' },
]

/** "#/docs", "#/docs/model", "#/docs/dictionary", "#/docs/workflow" (anything else under docs opens the start page). */
export function docsTopicFromHash(hash: string): DocsTopic {
  const path = hash.replace(/^#/, '').split('?')[0]
  return path === '/docs/model' ? 'model' : path === '/docs/dictionary' ? 'dictionary' : path === '/docs/workflow' ? 'workflow' : path === '/docs/architecture' ? 'architecture' : 'home'
}

// ---- Shared column wording -------------------------------------------------------------------------------------------------------------

const TEXT = 'text'
const INT = 'whole number'
const DEC = 'decimal'
const BOOL = 'yes / no'
const DATE = 'date'
const col = (name: string, type: string, meaning: string): Col => ({ name, type, meaning })

const SEASON = col('season', INT, 'The season by its END year: 2027 means the 2026-27 season.')
const SEASON_LABEL = col('season_label', TEXT, 'The season as people write it, like "2026-27".')
const GAME_TYPE = col('game_type', TEXT, 'The kind of game: regular-season, play-in, playoffs or nba-cup. Kinds are never mixed in one row or one average.')
const ROW_HASH = col('_row_hash', TEXT, 'A fingerprint of the row. A rebuild compares fingerprints so only rows that really changed are written.')

const TEAM_GAME_COMMON = [
  col('team_id', INT, "The league's id for the team."),
  col('game_id', TEXT, "The league's 10-digit id for the game."),
  col('game_date', DATE, 'The date on the schedule (US date; the source has no tip-off time).'),
]

// ---- Gold tables (what the app reads) --------------------------------------------------------------------------------------------------

const GOLD: DocTable[] = [
  {
    layer: 'gold',
    name: 'game_slate',
    grain: 'One row per game of the latest season, played or not.',
    key: ['game_id'],
    purpose: "The list of games and their scores. It is what Today's games shows.",
    usedBy: "Today's games",
    from: ['game'],
    notes: ['Only the latest season is kept. A game not played yet has no score (is_final is no).'],
    columns: [
      col('game_id', TEXT, "The league's 10-digit id for the game."),
      col('game_date', DATE, 'The date on the schedule (US date; the source has no tip-off time).'),
      SEASON,
      SEASON_LABEL,
      col('game_type', TEXT, 'The kind of game, such as regular-season or preseason. The page shows one kind at a time.'),
      col('home_team_id', INT, "The league's id for the home team."),
      col('home_tricode', TEXT, "The home team's three-letter code, like BOS."),
      col('home_team_name', TEXT, "The home team's full name."),
      col('away_team_id', INT, "The league's id for the away team."),
      col('away_tricode', TEXT, "The away team's three-letter code."),
      col('away_team_name', TEXT, "The away team's full name."),
      col('home_pts', INT, 'Points scored by the home team. Empty until the game is final.'),
      col('away_pts', INT, 'Points scored by the away team. Empty until the game is final.'),
      col('is_final', BOOL, 'Yes once the game has a result.'),
      col('home_won', BOOL, 'Yes if the home team won. Empty until the game is final.'),
      ROW_HASH,
    ],
  },
  {
    layer: 'gold',
    name: 'game_context',
    grain: 'One row per team per game on the schedule, played or not.',
    key: ['team_id', 'game_id'],
    purpose: 'The situation a team is in before tip-off: rest, back-to-backs, busy stretches, road trips, and how rested the opponent is.',
    usedBy: "Today's game chips, Teams > Advanced stats, Players > Advanced stats",
    from: ['game'],
    notes: [
      'Regular season, play-in, playoffs and NBA Cup games only; preseason and all-star games are left out because they are not part of a real schedule load.',
      'Every season is kept so past seasons can show how a situation affected results.',
    ],
    columns: [
      ...TEAM_GAME_COMMON,
      SEASON,
      SEASON_LABEL,
      GAME_TYPE,
      col('team_tricode', TEXT, "The team's three-letter code."),
      col('team_name', TEXT, "The team's full name."),
      col('opponent_team_id', INT, "The opponent's team id."),
      col('opponent_tricode', TEXT, "The opponent's three-letter code."),
      col('is_home', BOOL, 'Yes if this team is at home.'),
      col('is_final', BOOL, 'Yes once the game has been played.'),
      col('days_rest', INT, 'Whole days off since the team\'s previous game: 0 is a back-to-back, 1 is one day off. Empty for the first game of a season. The app shows large values as "3+".'),
      col('is_b2b', BOOL, 'Yes when days_rest is 0 (second night in a row).'),
      col('games_in_4', INT, "The team's games in the 4 days ending on this game's date, this game included."),
      col('games_in_6', INT, "The team's games in the 6 days ending on this game's date, this game included."),
      col('is_3_in_4', BOOL, 'Yes when games_in_4 is 3 or more.'),
      col('is_4_in_6', BOOL, 'Yes when games_in_6 is 4 or more.'),
      col('stint_game_number', INT, 'This is the Nth game in a row at the same place. With is_home it reads as "3rd straight road game" or "game 2 of a homestand". It restarts every season.'),
      col('opp_days_rest', INT, "The opponent's days_rest for the same game."),
      col('rest_edge', INT, "days_rest minus opp_days_rest. Positive means this team is the more rested one."),
      ROW_HASH,
    ],
  },
  {
    layer: 'gold',
    name: 'team_game_log',
    grain: 'One row per team per game that was played.',
    key: ['team_id', 'game_id'],
    purpose: "A team's box score for every game: the result and the team totals.",
    usedBy: 'Teams (last 15 games, games against an opponent), Today, Advanced stats, Defense by position',
    from: ['team_game'],
    notes: ['Percentages are not stored. They are made divided by attempted, worked out on the page.'],
    columns: [
      ...TEAM_GAME_COMMON,
      SEASON,
      SEASON_LABEL,
      GAME_TYPE,
      col('team_name', TEXT, "The team's full name."),
      col('team_tricode', TEXT, "The team's three-letter code."),
      col('opponent_team_id', INT, "The opponent's team id."),
      col('opponent_tricode', TEXT, "The opponent's three-letter code."),
      col('is_home', BOOL, 'Yes if this team was at home.'),
      col('won', BOOL, 'Yes if this team won.'),
      col('pts', INT, 'Points scored by the team.'),
      col('opp_pts', INT, 'Points scored by the opponent.'),
      col('margin', INT, 'pts minus opp_pts. Positive is a win.'),
      col('overtime_periods', INT, 'How many overtime periods were played (0 is none).'),
      col('fgm', INT, 'Field goals made.'),
      col('fga', INT, 'Field goals attempted.'),
      col('fg3m', INT, 'Three-pointers made.'),
      col('fg3a', INT, 'Three-pointers attempted.'),
      col('ftm', INT, 'Free throws made.'),
      col('fta', INT, 'Free throws attempted.'),
      col('oreb', INT, 'Offensive rebounds.'),
      col('dreb', INT, 'Defensive rebounds.'),
      col('reb', INT, 'Total rebounds.'),
      col('ast', INT, 'Assists.'),
      col('stl', INT, 'Steals.'),
      col('blk', INT, 'Blocks.'),
      col('tov', INT, 'Turnovers.'),
      col('pf', INT, 'Personal fouls.'),
      ROW_HASH,
    ],
  },
  {
    layer: 'gold',
    name: 'team_form',
    grain: 'One row per team, game type and stat.',
    key: ['team_id', 'game_type', 'stat'],
    purpose: "How a team's last 10 games and its season look for each stat, as a range and an average.",
    usedBy: 'Teams page (scorecards and ranks)',
    from: ['team_game'],
    notes: [
      'stat is one of: pts, reb, ast, fg3m, blk, stl, allowed (points the opponent scored), margin (pts minus allowed), fg_pct, fg3_pct, ft_pct, tov, oreb, fga, fta.',
      'A percentage stat is on a 0 to 100 scale: made divided by attempted over the games, times 100.',
      'The "last 10" window is the 10 most recent games of that game type and can reach back into earlier seasons; l10_first_date and l10_games_before_current_season say how far.',
    ],
    columns: [
      col('team_id', INT, "The league's id for the team."),
      GAME_TYPE,
      col('stat', TEXT, 'Which stat this row describes (see the list above).'),
      col('team_name', TEXT, "The team's full name, from its latest game of any type."),
      col('team_tricode', TEXT, "The team's three-letter code."),
      col('last_game_date', DATE, "The date of the team's most recent game of this type."),
      col('last_season_label', TEXT, 'The season of that most recent game.'),
      col('total_games', INT, 'All games of this type for the team in the data.'),
      col('season_label', TEXT, 'The latest season in the data.'),
      col('season_games', INT, 'Games of this type the team has played this season (0 if none yet).'),
      col('l10_games', INT, 'How many games are in the last-10 window (fewer than 10 only if fewer exist).'),
      col('l10_first_date', DATE, 'The date of the oldest game in the window.'),
      col('l10_games_before_current_season', INT, 'How many window games come from earlier seasons.'),
      col('l10_wins', INT, 'Wins in the window.'),
      col('l10_mean', DEC, 'The average of the stat over the window.'),
      col('l10_median', DEC, 'The middle value over the window.'),
      col('l10_p10', DEC, 'The 10th percentile: a low-end game (about 1 in 10 is lower).'),
      col('l10_p90', DEC, 'The 90th percentile: a high-end game (about 1 in 10 is higher). p10 to p90 is the "middle 80%".'),
      col('l10_min', DEC, 'The lowest value in the window.'),
      col('l10_max', DEC, 'The highest value in the window.'),
      col('season_mean', DEC, 'The season average (empty if no games yet this season).'),
      ROW_HASH,
    ],
  },
  {
    layer: 'gold',
    name: 'player_form',
    grain: 'One row per player, game type and stat.',
    key: ['person_id', 'game_type', 'stat'],
    purpose: "How a player's last 10 games and his season look for each stat. It feeds the Players cards and the Predictions baseline.",
    usedBy: 'Players page, Predictions',
    from: ['player_game_log'],
    notes: [
      'stat is one of: pts, reb, ast, pra (points + rebounds + assists), pr, pa, ra, fg3m, blk, stl, minutes.',
      'The last-10 window is the player\'s 10 most recent played games of that game type, crossing into earlier seasons if needed.',
      'Players with no game yet this season still appear; last_game_date says how fresh the row is.',
    ],
    columns: [
      col('person_id', INT, "The league's id for the player."),
      GAME_TYPE,
      col('stat', TEXT, 'Which stat this row describes (see the list above).'),
      col('player_name', TEXT, "The player's name, from his latest game of any type."),
      col('team_id', INT, 'His team in that latest game.'),
      col('team_tricode', TEXT, "The team's three-letter code."),
      col('last_game_date', DATE, 'The date of his most recent game of this type.'),
      col('last_season_label', TEXT, 'The season of that game.'),
      col('total_games', INT, 'All played games of this type in the data.'),
      col('season_label', TEXT, 'The latest season in the data.'),
      col('season_games', INT, 'Games of this type he has played this season (0 if none yet).'),
      col('l10_games', INT, 'How many games are in the last-10 window.'),
      col('l10_first_date', DATE, 'The date of the oldest game in the window.'),
      col('l10_games_before_current_season', INT, 'How many window games come from earlier seasons.'),
      col('l10_mean', DEC, 'The average over the window.'),
      col('l10_median', DEC, 'The middle value over the window.'),
      col('l10_p10', DEC, 'The 10th percentile (a low-end game).'),
      col('l10_p90', DEC, 'The 90th percentile (a high-end game).'),
      col('l10_min', DEC, 'The lowest value in the window.'),
      col('l10_max', DEC, 'The highest value in the window.'),
      col('l10_share_0', DEC, 'For fg3m, blk and stl only: the share of window games with 0 (0.3 is 3 games in 10).'),
      col('l10_share_1', DEC, 'The same, for exactly 1.'),
      col('l10_share_2', DEC, 'The same, for exactly 2.'),
      col('l10_share_3plus', DEC, 'The same, for 3 or more.'),
      col('season_mean', DEC, 'The season average (empty if he has not played yet this season).'),
      ROW_HASH,
    ],
  },
  {
    layer: 'gold',
    name: 'player_season_games',
    grain: "One row per player, per team, per team game: the season grid, with a row for games he missed.",
    key: ['person_id', 'team_id', 'game_id'],
    purpose: 'The hexagon chart and every game list for a player. Each team game is a row, filled in with his numbers if he played and empty if he did not.',
    usedBy: 'Players (season chart, box scores), Predictions, Advanced stats, Defense by position',
    from: ['player_game', 'team_game'],
    notes: [
      'A player gets a grid for a team and game type in a season if he played at least one such game for that team. The grid is then all of that team\'s games of that type that season.',
      'A player traded mid-season gets a full grid for each team; other_teams names the other team or teams.',
      '"Played" here means any minutes, or any box-score stat above 0, or a non-zero plus/minus. This is a little wider than silver\'s own played flag (minutes above 0 only).',
    ],
    columns: [
      col('person_id', INT, "The league's id for the player."),
      col('team_id', INT, "The team's id."),
      col('game_id', TEXT, "The league's 10-digit id for the game."),
      col('game_date', DATE, 'The date on the schedule.'),
      SEASON,
      SEASON_LABEL,
      GAME_TYPE,
      col('player_name', TEXT, "The player's name."),
      col('team_tricode', TEXT, "The team's three-letter code."),
      col('opponent_team_id', INT, "The opponent's team id."),
      col('opponent_tricode', TEXT, "The opponent's three-letter code."),
      col('is_home', BOOL, 'Yes if the game was at home for his team.'),
      col('game_number', INT, "This game's place among the team's games of this type that season (1st, 2nd, ...)."),
      col('team_games', INT, "How many games of this type the team has that season (the length of the grid, like 82)."),
      col('played', BOOL, 'Yes if he played (see the rule above).'),
      col('minutes', DEC, 'Minutes played. Empty when he did not play.'),
      col('pts', INT, 'Points. Empty when he did not play.'),
      col('reb', INT, 'Total rebounds.'),
      col('ast', INT, 'Assists.'),
      col('fg3m', INT, 'Three-pointers made.'),
      col('blk', INT, 'Blocks.'),
      col('stl', INT, 'Steals.'),
      col('other_teams', TEXT, 'The other team codes he played for in this season and game type, comma separated. Empty if he had one team.'),
      col('started', BOOL, 'Yes if he started the game.'),
      col('fgm', INT, 'Field goals made.'),
      col('fga', INT, 'Field goals attempted.'),
      col('fg3a', INT, 'Three-pointers attempted.'),
      col('ftm', INT, 'Free throws made.'),
      col('fta', INT, 'Free throws attempted.'),
      col('oreb', INT, 'Offensive rebounds.'),
      col('dreb', INT, 'Defensive rebounds.'),
      col('tov', INT, 'Turnovers.'),
      col('pf', INT, 'Personal fouls.'),
      col('plus_minus', DEC, "The team's score margin while he was on the floor."),
      ROW_HASH,
    ],
  },
  {
    layer: 'gold',
    name: 'player_season_position',
    grain: 'One row per player per season.',
    key: ['person_id', 'season'],
    purpose: 'The position the team roster lists for a player. The defense-by-position grid needs it, and the app can only read gold tables.',
    usedBy: 'Defense by position (Teams > Advanced stats)',
    from: ['rosters'],
    notes: [
      'It is the roster label as written (G, F, C, G-F, F-C, C-F, F-G), not the lineup slot in a box score. A player with several snapshots in a season gets the newest label.',
      'Players with no roster label show as "Not listed" in the grid.',
    ],
    columns: [
      col('person_id', INT, "The league's id for the player."),
      SEASON,
      SEASON_LABEL,
      col('player_name', TEXT, "The player's name."),
      col('position', TEXT, 'The listed position: G, F, C, G-F, F-C, C-F or F-G.'),
      ROW_HASH,
    ],
  },
  {
    layer: 'gold',
    name: 'team_vs_opponent',
    grain: 'One row per team, opponent, season (or "all"), game type and stat.',
    key: ['team_id', 'opponent_team_id', 'season_label', 'game_type', 'stat'],
    purpose: 'How a team has done against one opponent. Built and tested, but no page reads it yet: the Teams page works out meetings from team_game_log.',
    usedBy: 'Not read by a page yet',
    from: ['team_game'],
    notes: ['stat is one of pts, reb, ast, fg3m, blk, stl, allowed, margin. season_label is one season like "2024-25", or "all".'],
    columns: [
      col('team_id', INT, "The team's id."),
      col('opponent_team_id', INT, "The opponent's id."),
      SEASON_LABEL,
      GAME_TYPE,
      col('stat', TEXT, 'Which stat this row describes.'),
      col('team_tricode', TEXT, "The team's three-letter code."),
      col('opponent_tricode', TEXT, "The opponent's three-letter code."),
      col('games', INT, 'How many games between the two.'),
      col('wins', INT, 'How many the team won.'),
      col('first_game_date', DATE, 'The date of the first of those games.'),
      col('last_game_date', DATE, 'The date of the latest.'),
      col('mean', DEC, 'The average of the stat.'),
      col('median', DEC, 'The middle value.'),
      col('p10', DEC, 'The 10th percentile.'),
      col('p90', DEC, 'The 90th percentile.'),
      col('min_value', DEC, 'The lowest value.'),
      col('max_value', DEC, 'The highest value.'),
      ROW_HASH,
    ],
  },
  {
    layer: 'gold',
    name: 'player_game_log',
    grain: 'One row per player per game he played.',
    key: ['game_id', 'person_id'],
    purpose: 'Every played game with what he averaged in the 10 games and the season BEFORE it. player_form is built from it, and the back-tests use it because the current game is never in its own average.',
    usedBy: 'Not read by a page directly (it feeds player_form and the back-tests)',
    from: ['player_game'],
    notes: [
      'prior_l10_* columns describe the previous 10 played games (crossing into earlier seasons if needed); prior_season_* describe earlier played games of the same season.',
      'pra, pr, pa and ra are points + rebounds + assists, points + rebounds, points + assists and rebounds + assists.',
    ],
    columns: [
      col('game_id', TEXT, "The league's 10-digit id for the game."),
      col('person_id', INT, "The player's id."),
      col('player_name', TEXT, "The player's name."),
      col('team_id', INT, "The team's id."),
      col('team_tricode', TEXT, "The team's three-letter code."),
      col('opponent_team_id', INT, "The opponent's team id."),
      col('opponent_tricode', TEXT, "The opponent's three-letter code."),
      col('is_home', BOOL, 'Yes if his team was at home.'),
      col('game_date', DATE, 'The date on the schedule.'),
      SEASON,
      SEASON_LABEL,
      col('season_type', TEXT, 'The kind of game (regular-season, play-in, playoffs, nba-cup).'),
      col('is_regular_season', BOOL, 'Yes for a regular-season game.'),
      col('game_number', INT, "The game's place in his games of this kind."),
      col('season_game_number', INT, "The game's place in his games that season."),
      col('started', BOOL, 'Yes if he started.'),
      col('minutes', DEC, 'Minutes played.'),
      col('pts', INT, 'Points.'),
      col('reb', INT, 'Total rebounds.'),
      col('ast', INT, 'Assists.'),
      col('fg3m', INT, 'Three-pointers made.'),
      col('blk', INT, 'Blocks.'),
      col('stl', INT, 'Steals.'),
      col('tov', INT, 'Turnovers.'),
      col('pra', INT, 'Points + rebounds + assists.'),
      col('pr', INT, 'Points + rebounds.'),
      col('pa', INT, 'Points + assists.'),
      col('ra', INT, 'Rebounds + assists.'),
      col('prior_l10_games', INT, 'How many games are in the previous-10 window (fewer than 10 early in his career).'),
      col('prior_l10_games_earlier_season', INT, 'How many of those come from an earlier season.'),
      col('prior_l10_games_not_regular', INT, 'How many of those are not regular-season games.'),
      col('prior_l10_pts', DEC, 'His average points over the previous 10 played games.'),
      col('prior_l10_reb', DEC, 'The same for rebounds.'),
      col('prior_l10_ast', DEC, 'The same for assists.'),
      col('prior_l10_fg3m', DEC, 'The same for three-pointers made.'),
      col('prior_l10_blk', DEC, 'The same for blocks.'),
      col('prior_l10_stl', DEC, 'The same for steals.'),
      col('prior_l10_minutes', DEC, 'The same for minutes.'),
      col('prior_season_games', INT, 'How many games he played earlier in the same season.'),
      col('prior_season_pts', DEC, 'His average points in those earlier games.'),
      col('prior_season_reb', DEC, 'The same for rebounds.'),
      col('prior_season_ast', DEC, 'The same for assists.'),
      col('prior_season_fg3m', DEC, 'The same for three-pointers made.'),
      col('prior_season_blk', DEC, 'The same for blocks.'),
      col('prior_season_stl', DEC, 'The same for steals.'),
      col('prior_season_minutes', DEC, 'The same for minutes.'),
      ROW_HASH,
    ],
  },
]

// ---- Silver and bronze (table level) ---------------------------------------------------------------------------------------------------

const SILVER: DocTable[] = [
  {
    layer: 'silver',
    name: 'game',
    grain: 'One row per game, played or not (the schedule).',
    key: ['game_id'],
    purpose: 'The schedule with scores. When the schedule file has no result yet but a box score exists, the score comes from the box score.',
    usedBy: 'Feeds game_slate and game_context',
    from: ['schedules', 'team_boxscores'],
    notes: [
      'Placeholder games with no teams yet (team id 0) are left out. They appear once the teams are known.',
      'Columns: game_id, season, season_type, game_date, home and away team id / code / name, home_pts, away_pts, is_final, home_won, result_from_box_score (the score came from the box score), has_box_score.',
    ],
    columns: [],
  },
  {
    layer: 'silver',
    name: 'team_game',
    grain: 'One row per team per game played.',
    key: ['game_id', 'team_id'],
    purpose: "Each team's box score, with the opponent's points taken from the opponent's own box score (the schedule lags).",
    usedBy: 'Feeds team_game_log, team_form, team_vs_opponent and player_season_games',
    from: ['team_boxscores', 'schedules'],
    notes: [
      'Team minutes are 240:00 plus 25:00 per overtime. A game where either team\'s minutes are not a possible total (a box score with a player\'s minutes missing) is held back: both rows are left out, a warning names it, and the next build adds it once the source is corrected.',
      'More than 5 games held back at once stops the build, because that points at a format change, not one bad file.',
    ],
    columns: [],
  },
  {
    layer: 'silver',
    name: 'player_game',
    grain: 'One row per player per game, including players who did not play.',
    key: ['game_id', 'person_id'],
    purpose: 'Each player\'s box score for each game, cleaned: minutes turned into a number, "played" and "started" worked out, opponent added.',
    usedBy: 'Feeds player_game_log and player_season_games',
    from: ['player_boxscores', 'schedules'],
    notes: [
      '"Played" means minutes above 0. It is never read from the comment text or from a missing row.',
      '"Started" means the position field is not empty (only starters carry G, F or C).',
      'Minutes arrive as text like "9:60" (seconds can be 60 or more) and are converted as minutes times 60 plus seconds.',
      'Games held back in team_game are held back here too, so the two tables always agree about which games exist.',
    ],
    columns: [],
  },
]

const BRONZE: DocTable[] = [
  { layer: 'bronze', name: 'schedules', grain: 'One row per game on the league schedule.', key: ['game_id'], purpose: 'The schedule file as published, including placeholders.', usedBy: 'Feeds silver game, team_game and player_game', from: [], columns: [] },
  { layer: 'bronze', name: 'team_boxscores', grain: 'One row per team per game (home and away).', key: ['game_id', 'team_id', 'side'], purpose: 'Team box scores as published.', usedBy: 'Feeds silver game and team_game', from: [], columns: [] },
  { layer: 'bronze', name: 'player_boxscores', grain: 'One row per player per game.', key: ['game_id', 'person_id'], purpose: 'Player box scores as published.', usedBy: 'Feeds silver player_game', from: [], columns: [] },
  { layer: 'bronze', name: 'rosters', grain: 'One row per player per team roster snapshot.', key: [], purpose: 'Team rosters with the listed position. The current season is appended again each time it changes.', usedBy: 'Feeds gold player_season_position', from: [], columns: [] },
  { layer: 'bronze', name: 'injury_report', grain: 'One row per injury report entry.', key: [], purpose: 'The published injury report.', usedBy: 'Landed, not used by a page yet', from: [], columns: [] },
  { layer: 'bronze', name: 'pbp', grain: 'One row per play-by-play event.', key: ['game_id', 'order_index'], purpose: 'Play-by-play.', usedBy: 'Landed, not used by a page yet', from: [], columns: [] },
  { layer: 'bronze', name: 'shots', grain: 'One row per shot.', key: [], purpose: 'Shot locations.', usedBy: 'Landed, not used by a page yet', from: [], columns: [] },
  { layer: 'bronze', name: 'possessions', grain: 'One row per possession.', key: ['game_id', 'possession_number'], purpose: 'Possession-level data.', usedBy: 'Landed, not used by a page yet', from: [], columns: [] },
  { layer: 'bronze', name: 'lineups', grain: 'One row per lineup group.', key: [], purpose: 'Lineup combinations.', usedBy: 'Landed, not used by a page yet', from: [], columns: [] },
  { layer: 'bronze', name: 'game_lineups', grain: 'One row per lineup in a game.', key: [], purpose: 'Game-level lineups.', usedBy: 'Landed, not used by a page yet', from: [], columns: [] },
  { layer: 'bronze', name: 'game_rosters', grain: 'One row per player on a game roster.', key: ['game_id', 'player_id'], purpose: 'Who was on each game roster.', usedBy: 'Landed, not used by a page yet', from: [], columns: [] },
  { layer: 'bronze', name: 'officials', grain: 'One row per official per game.', key: ['game_id', 'official_id'], purpose: 'Game officials.', usedBy: 'Landed, not used by a page yet', from: [], columns: [] },
  { layer: 'bronze', name: 'standings', grain: 'One row per team standing snapshot.', key: [], purpose: 'League standings.', usedBy: 'Landed, not used by a page yet', from: [], columns: [] },
  { layer: 'bronze', name: 'player_season_stats', grain: 'One row per player per season.', key: [], purpose: "The source's own season totals.", usedBy: 'Landed, not used by a page yet', from: [], columns: [] },
  { layer: 'bronze', name: 'team_season_stats', grain: 'One row per team per season.', key: [], purpose: "The source's own team season totals.", usedBy: 'Landed, not used by a page yet', from: [], columns: [] },
]

export const TABLES: DocTable[] = [...GOLD, ...SILVER, ...BRONZE]
export const LAYER_TEXT: Record<Layer, { title: string; schema: string; line: string }> = {
  bronze: { title: 'Bronze', schema: 'nba_v2_bronze', line: 'The files exactly as published, loaded into tables. Nothing is cleaned.' },
  silver: { title: 'Silver', schema: 'nba_v2_silver', line: 'Cleaned and checked: one row per game, per team per game, per player per game.' },
  gold: { title: 'Gold', schema: 'nba_v2_gold', line: 'Shaped for the pages. The app reads only gold.' },
}

export const tablesIn = (layer: Layer): DocTable[] => TABLES.filter((t) => t.layer === layer)

/** Tables and columns whose name or meaning contains the text (case does not matter). An empty search matches everything. */
export function searchTables(query: string, tables: DocTable[] = TABLES): { table: DocTable; columns: Col[]; tableMatch: boolean }[] {
  const q = query.trim().toLowerCase()
  if (!q) return tables.map((table) => ({ table, columns: table.columns, tableMatch: true }))
  const out: { table: DocTable; columns: Col[]; tableMatch: boolean }[] = []
  for (const table of tables) {
    const tableMatch = [table.name, table.purpose, table.grain].some((s) => s.toLowerCase().includes(q))
    const columns = table.columns.filter((c) => c.name.toLowerCase().includes(q) || c.meaning.toLowerCase().includes(q))
    if (tableMatch || columns.length > 0) out.push({ table, columns: tableMatch ? table.columns : columns, tableMatch })
  }
  return out
}

// ---- The data workflow ------------------------------------------------------------------------------------------------------------------

export type Step = { n: number; title: string; where: string; what: string; check: string }
export const WORKFLOW: Step[] = [
  {
    n: 1,
    title: 'The source publishes',
    where: 'GitHub: sportsdataverse-data releases',
    what: 'A public project publishes the league\'s box scores, schedules, rosters and more as one file per season (2021-22 onward). It updates once a day, at a different time each day.',
    check: 'We read the public release list and fetch only the files that are new or changed.',
  },
  {
    n: 2,
    title: 'Copy the files untouched',
    where: 'Cloudflare R2 (the "raw" bucket) · scripts/backfill.py',
    what: 'New or changed files are copied exactly as published into our own storage, with a manifest saying what was copied. Nothing is edited, so we can always rebuild from the original.',
    check: 'Each run writes a manifest, and the next steps only run if every copy succeeded.',
  },
  {
    n: 3,
    title: 'Load into Databricks (bronze)',
    where: 'Databricks · scripts/bronze_load.py',
    what: 'Each file becomes rows in a bronze table. Bronze keeps the source\'s own columns and adds when it was loaded. A file already loaded in the same version is skipped.',
    check: 'Row counts in the table are compared with the file, and key columns are checked for duplicates and empty values.',
  },
  {
    n: 4,
    title: 'Clean and join (silver)',
    where: 'Databricks job · sql/silver/*.sql',
    what: 'Silver turns bronze into three tidy tables: game, team_game and player_game. Minutes become numbers, "played" and "started" are worked out, and the opponent is added to every row.',
    check: 'Gates stop the build if something is wrong (duplicate keys, empty keys). A game with an impossible team-minutes total is held back and named in a warning.',
  },
  {
    n: 5,
    title: 'Shape for the pages (gold)',
    where: 'Databricks job · scripts/gold_*.py (PySpark)',
    what: 'Gold computes what a page needs: season grids, last-10 averages and ranges, rest and back-to-back context, the day\'s slate. Only rows that changed are written.',
    check: 'Every gold table has its own gates and warnings that recompute the answer a second, independent way. A failed gate stops the run before later tables are built.',
  },
  {
    n: 6,
    title: 'The app reads gold',
    where: 'The app server · fixed queries',
    what: 'The server runs a fixed set of read-only queries against gold, keeps each answer for five minutes, and sends it to your browser. It never reads bronze or silver and can only read.',
    check: 'The app\'s database login has read-only access, and the queries take named values, never text pasted in from the page.',
  },
  {
    n: 7,
    title: 'Redeploy',
    where: 'GitHub Actions · deploy-app',
    what: 'When a sync changed something, the app is redeployed so it starts with fresh data. A change merged into the code redeploys it as well, and a scheduled run every 6 hours keeps the free hosting from stopping the app.',
    check: 'The deploy run is checked against the merge before anything is called live.',
  },
]

export const SCHEDULE_LINES: string[] = [
  'A GitHub workflow polls the source once an hour from 14:00 to 23:00 UTC (the source publishes at a different time each day). Most polls find nothing new and stop after bronze, in about 2 minutes.',
  'A daily run at 3:05 PM US Eastern and a safety-net run at 22:17 UTC always build silver and gold, whether or not new files arrived.',
  'GitHub treats scheduled runs as best effort, so some are delayed or dropped; that is why there are several daily runs.',
  'A failed build is retried by the next hourly poll.',
]

// ---- Start page ------------------------------------------------------------------------------------------------------------------------

export type Faq = { q: string; a: string }
export const FAQ: Faq[] = [
  {
    q: 'Where does the data come from?',
    a: 'The league\'s own box scores, schedules and rosters, as published by the open sportsdataverse project (MIT and CC BY 4.0 licenses). We copy their files untouched and build everything else ourselves.',
  },
  {
    q: 'How fresh is it?',
    a: 'A finished game is usually in the app by the next day. Every page says "Data through" the date of the latest game it holds. The source publishes once a day, so there is no live scoring.',
  },
  {
    q: 'What does season 2027 mean?',
    a: 'Seasons are numbered by the year they END. 2027 is the 2026-27 season; the app shows it as "2026-27".',
  },
  {
    q: 'Why does a player\'s season chart show 80 games instead of 82?',
    a: 'The league\'s 2026-27 schedule lists 80 dated games per team so far. The last 2 per team are added once the NBA Cup is decided (early December). The count fixes itself when the schedule file updates.',
  },
  {
    q: 'What counts as "played"?',
    a: 'On the season chart, a game counts as played if he has any minutes, any box-score stat above 0, or a non-zero plus/minus. Otherwise it is a grey did-not-play hexagon.',
  },
  {
    q: 'Are regular season and playoff games mixed?',
    a: 'Never. Every average, range and chart uses one kind of game at a time: regular season, play-in, playoffs or NBA Cup.',
  },
  {
    q: 'What are "last 10", p10 and p90?',
    a: 'Last 10 is the 10 most recent games of the chosen kind, which can reach into earlier seasons early in a season. p10 and p90 are the low and high ends of the middle 80% of those games: about 1 game in 10 was lower than p10, and about 1 in 10 was higher than p90.',
  },
  {
    q: 'Why is a recent game missing?',
    a: 'Either the source has not published it yet, or its box score failed a check (for example a player\'s minutes were missing, so the team total was impossible). Such a game is held back and added once the source corrects it.',
  },
  {
    q: 'Where are my paper picks kept?',
    a: 'Only in your browser. A different device or cleared browser starts empty, so use "Download my picks" on the Picks page for a backup.',
  },
]

// ---- System design / architecture --------------------------------------------------------------------------------------------------------

export type Node = { title: string; sub: string }
export type Path = { name: string; when: string; nodes: Node[] }
export const PATHS: Path[] = [
  {
    name: 'Data path',
    when: 'Runs on a schedule, no one clicks anything',
    nodes: [
      { title: 'Source', sub: 'sportsdataverse files on GitHub' },
      { title: 'Sync', sub: 'GitHub Actions workflow' },
      { title: 'Raw storage', sub: 'Cloudflare R2, files untouched' },
      { title: 'Databricks', sub: 'bronze, silver, gold tables' },
    ],
  },
  {
    name: 'Request path',
    when: 'Runs each time you open or click something',
    nodes: [
      { title: 'Your browser', sub: 'React app (the pages)' },
      { title: 'App server', sub: 'Express, on Databricks Apps' },
      { title: 'SQL warehouse', sub: 'Databricks, read-only' },
      { title: 'Gold tables', sub: 'Unity Catalog, schema nba_v2_gold' },
    ],
  },
  {
    name: 'Release path',
    when: 'Runs when a change is merged, and every 6 hours',
    nodes: [
      { title: 'Pull request', sub: 'you review and merge on GitHub' },
      { title: 'deploy-app workflow', sub: 'type check, lint, tests, build' },
      { title: 'Databricks Apps', sub: 'upload, restart if stopped, deploy' },
    ],
  },
]

export type Component = { name: string; role: string; why: string }
export const COMPONENTS: Component[] = [
  { name: 'GitHub repository', role: 'Holds all the code, the SQL, the tests and these notes. Every change is a pull request that you merge.', why: 'One place for history and review; merging is the approval to deploy.' },
  { name: 'GitHub Actions', role: 'Runs the hourly sync and the deploys, and posts the result to Slack.', why: 'Free for this size, and close to the code. The daily file copy is its job; the heavy work is left to Databricks.' },
  { name: 'Cloudflare R2', role: 'Keeps the source files exactly as published, with a manifest per run.', why: 'A cheap S3-compatible store with a free tier, so we can always rebuild from the originals.' },
  { name: 'Databricks (Delta tables, Unity Catalog)', role: 'Holds bronze, silver and gold, and runs the PySpark and SQL that builds them.', why: 'The owner knows it, the Free Edition costs nothing, and it is the centrepiece for the later modelling work.' },
  { name: 'Databricks Job (a bundle in the repo)', role: 'Builds silver then gold after each sync, with the gates and warnings.', why: 'The job is defined as code in databricks.yml, so it always runs the repo\'s version of the scripts.' },
  { name: 'Databricks SQL warehouse', role: 'Answers the app\'s queries on the gold tables.', why: 'Already part of the workspace. The Free Edition has one small warehouse, so the app caches answers.' },
  { name: 'Databricks Apps', role: 'Hosts the app: one small Node server that serves the pages and the /api answers.', why: 'Sits next to the data and logs in as itself, with no password stored in the app.' },
  { name: 'React app (Vite, TypeScript, Tailwind)', role: 'The pages you click through. Each page is an address like #/players, so the back button and bookmarks work.', why: 'A static bundle with no page reloads. The server only has to send data.' },
  { name: 'Slack', role: 'Gets one message per sync run, headed OK or FAILED, with a summary of what was copied, loaded and built.', why: 'A failure should not wait for someone to look.' },
]

export type RequestStep = { title: string; text: string }
export const REQUEST_STEPS: RequestStep[] = [
  { title: 'You click', text: 'The page asks the server for one thing, for example a player\'s last-10 form, with the player and game type in the address.' },
  { title: 'The server checks its memory', text: 'If it answered the same question in the last five minutes, it sends that answer back at once. This keeps the single small warehouse from being asked the same thing over and over.' },
  { title: 'Otherwise it asks Databricks', text: 'It runs a fixed query (written ahead of time, never built from text typed on the page) on the SQL warehouse, passing your choices as named values.' },
  { title: 'It logs in as itself', text: 'The app has its own identity in Databricks and gets a short-lived token. The browser never sees a token, and the identity can only read.' },
  { title: 'Rows come back as JSON', text: 'The server shapes the rows, keeps the answer for five minutes and sends it to the browser, which draws the charts and tables.' },
]

export type Decision = { title: string; text: string }
export const DECISIONS: Decision[] = [
  { title: 'Daily batches, not streaming', text: 'The source publishes once a day, so nothing here is live. Streaming tools would add cost and complexity with no benefit; they are parked until there is a live feed to use.' },
  { title: 'Raw files stay untouched', text: 'Every cleaning step reads from a copy, never from the original. A bug in a transform can be fixed and the tables rebuilt without fetching anything again.' },
  { title: 'Three layers with checks between them', text: 'A gate that fails stops the line before the next table is built, so the pages keep the last good data instead of a half-built one. This came from the first version, where silent data problems cost the most time.' },
  { title: 'The app reads only gold, and only reads', text: 'The pages never touch bronze or silver. The app\'s identity has read access and nothing else, so a bug in the app cannot change data.' },
  { title: 'Compute where the data is', text: 'The heavy work (windows, percentiles, rest and back-to-back context) is done once in Databricks. The app only picks rows and draws them.' },
  { title: 'One reader today, a serving store later', text: 'Today the app queries the Databricks SQL warehouse directly. If traffic or cost ever demands it, the gold tables can be copied to a small serving database and the app pointed at that; the pages would not change.' },
  { title: 'Built for a free tier, on purpose', text: 'Databricks Free Edition stops an app on its own, so a deploy runs every 6 hours to restart it. GitHub scheduled runs are best effort, so the sync polls hourly and has two daily backstops.' },
  { title: 'Picks live in your browser', text: 'The paper-picks tracker keeps its data in the browser, with a download for backup. A Databricks table for picks is a later step and needs a writable table and a permission change.' },
]

export const SECURITY_LINES: string[] = [
  'No secret is in the code or in a page. Keys live in GitHub Actions secrets, the Databricks workspace and a local file that is never committed.',
  'The R2 key can only reach one bucket. The app\'s Databricks identity can only read.',
  'Queries use named values, never text pasted in from the page, so a typed value cannot change what a query does.',
  'The browser talks only to the app server, never to Databricks, R2 or GitHub.',
]
