// What the Teams page asks, as fixed SQL plus small pure helpers (easy to test). Two gold tables, both read-only for the
// app identity: team_form (one row per team, game type and stat: the scorecards) and team_game_log (one row per team per
// game played: sparklines, the box-score table and the opponent panel). A team is named by its three-letter code; the page
// shows ONE game type at a time, so a regular-season and a playoff game are never in the same window or average.
import { MEETINGS_MIN, previousSeasonLabel } from './queries.mjs'

const FORM_TABLE = 'workspace.nba_v2_gold.team_form'
const LOG_TABLE = 'workspace.nba_v2_gold.team_game_log'

// The 15 stats team_form holds. Offense first; blk, stl, allowed and margin are kept for the later defense page.
export const TEAM_STATS = ['pts', 'fg_pct', 'fg3m', 'fg3_pct', 'ft_pct', 'ast', 'tov', 'reb', 'oreb', 'fga', 'fta', 'margin', 'allowed', 'blk', 'stl']

export const TEAM_FORM_SQL = `
  SELECT stat, team_name, team_tricode, last_game_date, last_season_label, total_games, season_label,
         season_games, l10_games, l10_first_date, l10_games_before_current_season, l10_wins,
         l10_mean, l10_median, l10_p10, l10_p90, l10_min, l10_max, season_mean
  FROM ${FORM_TABLE} WHERE team_tricode = :team AND game_type = :gt`

// A team's games are found by its team id (looked up from its code) so a team that changed its code is still matched.
const TEAM_ID = `(SELECT max_by(team_id, game_date) FROM ${LOG_TABLE} WHERE team_tricode = :team)`
const GAME_COLUMNS = `game_id, game_date, opponent_tricode, is_home, season_label, won, pts, opp_pts, overtime_periods,
         fgm, fga, fg3m, fg3a, ftm, fta, oreb, dreb, reb, ast, stl, blk, tov, pf`

// Last games played of one game type, across seasons if needed (the window the scorecards describe), newest first.
export const TEAM_GAMES_WINDOW = 10
export const TEAM_LOG_WINDOW = 15
const lastGamesSql = (n) => `
  SELECT ${GAME_COLUMNS}
  FROM ${LOG_TABLE}
  WHERE team_id = ${TEAM_ID} AND game_type = :gt
  ORDER BY game_date DESC, game_id DESC
  LIMIT ${n}`
export const TEAM_GAMES_SQL = lastGamesSql(TEAM_GAMES_WINDOW)
export const TEAM_LOG_SQL = lastGamesSql(TEAM_LOG_WINDOW)

// A team's games against ONE opponent (?opp=NYK), newest first, with this season's flagged. The same rule as the player
// page picks which to show (see pickMeetings). The opponent is looked up to its team id from its code.
export const TEAM_MEETINGS_LIMIT = 100
export const TEAM_MEETINGS_SQL = `
  SELECT ${GAME_COLUMNS},
         season = (SELECT max(season) FROM ${LOG_TABLE} WHERE game_type = :gt) AS is_current,
         (SELECT max_by(season_label, season) FROM ${LOG_TABLE} WHERE game_type = :gt) AS current_season
  FROM ${LOG_TABLE}
  WHERE team_id = ${TEAM_ID} AND game_type = :gt
    AND opponent_team_id = (SELECT max_by(team_id, game_date) FROM ${LOG_TABLE} WHERE team_tricode = :opp)
  ORDER BY game_date DESC, game_id DESC
  LIMIT ${TEAM_MEETINGS_LIMIT}`

// The league average of each stat, per team game, for the latest season that has games of this type (so the playoffs figure is
// the latest playoffs'). Percentages are pooled (total made over total attempted), like the team's own season figure. It is
// worked out from team_game_log, so it needs no other table and no other grant; the answer is cached for a few minutes.
export const LEAGUE_STATS = ['pts', 'fg_pct', 'fg3m', 'fg3_pct', 'ft_pct', 'ast', 'tov', 'reb', 'oreb', 'fga', 'fta', 'margin', 'allowed', 'blk', 'stl']
export const LEAGUE_SQL = `
  SELECT count(*) AS games, max(season_label) AS season_label,
         avg(pts), try_divide(sum(fgm), sum(fga)) * 100, avg(fg3m), try_divide(sum(fg3m), sum(fg3a)) * 100,
         try_divide(sum(ftm), sum(fta)) * 100, avg(ast), avg(tov), avg(reb), avg(oreb), avg(fga), avg(fta),
         avg(pts - opp_pts), avg(opp_pts), avg(blk), avg(stl)
  FROM ${LOG_TABLE}
  WHERE game_type = :gt AND season = (SELECT max(season) FROM ${LOG_TABLE} WHERE game_type = :gt)`

// ---- row mapping (the warehouse returns every value as a string or null) ----
const num = (v) => (v === null || v === undefined ? null : Number(v))
const bool = (v) => v === true || v === 'true'
const pct = (made, att) => (att === null || att === 0 || made === null ? null : (made / att) * 100)

// Returns null when the team has no rows of this game type.
export function mapTeamForm(rows) {
  if (rows.length === 0) return null
  const first = rows[0]
  const stats = {}
  for (const r of rows) {
    stats[r[0]] = { mean: num(r[12]), median: num(r[13]), p10: num(r[14]), p90: num(r[15]), min: num(r[16]), max: num(r[17]), seasonMean: num(r[18]) }
  }
  return {
    team: {
      name: first[1], tricode: first[2], lastGameDate: first[3], lastSeasonLabel: first[4], totalGames: num(first[5]),
      seasonLabel: first[6], seasonGames: num(first[7]), l10Games: num(first[8]), l10FirstDate: first[9],
      l10GamesBeforeCurrentSeason: num(first[10]), l10Wins: num(first[11]),
    },
    stats,
  }
}

// One row in GAME_COLUMNS order -> a game. `stats` is keyed by the same names as team_form's stats (so a sparkline can use
// them), with percentages worked out here (made / attempts x 100, empty without attempts); `box` is the table's numbers.
export function mapTeamGame(r) {
  const [pts, oppPts] = [num(r[6]), num(r[7])]
  const box = {
    fgm: num(r[9]), fga: num(r[10]), fg3m: num(r[11]), fg3a: num(r[12]), ftm: num(r[13]), fta: num(r[14]),
    oreb: num(r[15]), dreb: num(r[16]), reb: num(r[17]), ast: num(r[18]), stl: num(r[19]), blk: num(r[20]), tov: num(r[21]), pf: num(r[22]),
  }
  return {
    id: r[0], date: r[1], opp: r[2], isHome: bool(r[3]), seasonLabel: r[4], won: bool(r[5]), pts, oppPts,
    margin: pts === null || oppPts === null ? null : pts - oppPts, overtimes: num(r[8]),
    stats: {
      pts, fg_pct: pct(box.fgm, box.fga), fg3m: box.fg3m, fg3_pct: pct(box.fg3m, box.fg3a), ft_pct: pct(box.ftm, box.fta),
      ast: box.ast, tov: box.tov, reb: box.reb, oreb: box.oreb, fga: box.fga, fta: box.fta,
      margin: pts === null || oppPts === null ? null : pts - oppPts, allowed: oppPts, blk: box.blk, stl: box.stl,
    },
    box,
  }
}

// { games } oldest first (the sparklines' order); no games gives an empty list.
export function mapTeamGames(rows) {
  return { games: rows.map(mapTeamGame).reverse() }
}

// { games } newest first (the box-score table's order).
export function mapTeamLog(rows) {
  return { games: rows.map(mapTeamGame) }
}

// Choose which of a team's (or player's) meetings to show. `games` are newest first, each with seasonLabel and isCurrent (this
// season). Returns { scope, currentSeason, games }, games newest first, each with kind 'this' or 'last'; older are dropped:
//   'season' = MEETINGS_MIN or more this season (or some, and none last season); 'filled' = this season's topped up from last
//   season to MEETINGS_MIN; 'earlier' = none this season, last season's up to MEETINGS_MIN; 'none' = neither.
export function pickMeetings(games, currentSeason) {
  const lastSeason = previousSeasonLabel(currentSeason)
  const kept = games
    .map((g) => ({ ...g, kind: g.isCurrent ? 'this' : g.seasonLabel === lastSeason ? 'last' : 'older' }))
    .filter((g) => g.kind !== 'older')
  const thisSeason = kept.filter((g) => g.kind === 'this')
  const last = kept.filter((g) => g.kind === 'last')
  if (thisSeason.length >= MEETINGS_MIN || (thisSeason.length > 0 && last.length === 0)) return { scope: 'season', currentSeason, games: thisSeason }
  if (thisSeason.length > 0) return { scope: 'filled', currentSeason, games: [...thisSeason, ...last.slice(0, MEETINGS_MIN - thisSeason.length)] }
  if (last.length > 0) return { scope: 'earlier', currentSeason, games: last.slice(0, MEETINGS_MIN) }
  return { scope: 'none', currentSeason, games: [] }
}

// Rows come in TEAM_MEETINGS_SQL's column order (GAME_COLUMNS, then is_current and current_season), newest first.
export function mapTeamMeetings(rows) {
  const currentSeason = rows.length > 0 ? rows[0][24] : null
  const games = rows.map((r) => ({ ...mapTeamGame(r), isCurrent: bool(r[23]) }))
  return pickMeetings(games, currentSeason)
}

// One row in LEAGUE_SQL's order -> { seasonLabel, games, stats }. No games of this type gives games 0 and no stats.
export function mapLeague(rows) {
  const r = rows[0]
  if (!r || num(r[0]) === 0) return { seasonLabel: null, games: 0, stats: {} }
  const stats = {}
  LEAGUE_STATS.forEach((k, i) => {
    stats[k] = num(r[i + 2])
  })
  return { seasonLabel: r[1], games: num(r[0]), stats }
}
