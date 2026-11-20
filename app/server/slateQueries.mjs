// What the Today's games page asks, as fixed SQL plus small pure helpers (easy to test). One gold table, read-only for
// the app identity: game_slate (one row per game of the latest season, played or not) and game_context (rest facts for
// each team in each game: days off, back-to-back, crowded stretches, road-trip game number). The page shows ONE game type
// at a time, so a regular-season and a playoff game are never in the same list. game_date is the schedule's US date.
// game_context is joined with LEFT JOINs: a game with no context row still shows, just without chips.

const SLATE_TABLE = 'workspace.nba_v2_gold.game_slate'
const CTX_TABLE = 'workspace.nba_v2_gold.game_context'

export const SLATE_SQL = `
  SELECT s.game_id, s.game_date, s.home_tricode, s.away_tricode, s.home_team_name, s.away_team_name, s.home_pts, s.away_pts, s.is_final, s.home_won,
         h.game_id, h.days_rest, h.is_b2b, h.is_3_in_4, h.is_4_in_6, h.stint_game_number, h.rest_edge, h.games_in_4, h.games_in_6,
         a.game_id, a.days_rest, a.is_b2b, a.is_3_in_4, a.is_4_in_6, a.stint_game_number, a.rest_edge, a.games_in_4, a.games_in_6
  FROM ${SLATE_TABLE} s
  LEFT JOIN ${CTX_TABLE} h ON h.game_id = s.game_id AND h.team_tricode = s.home_tricode
  LEFT JOIN ${CTX_TABLE} a ON a.game_id = s.game_id AND a.team_tricode = s.away_tricode
  WHERE s.game_date = CAST(:date AS DATE) AND s.game_type = :gt
  ORDER BY s.game_id`

// Each team's average points scored and allowed per game, over the games it has played in the newest season that has games of this
// type (the season the slate shows). One row per team. A plain average of every game so far, however few there are.
const LOG_TABLE = 'workspace.nba_v2_gold.team_game_log'
export const SLATE_AVERAGES_SQL = `
  SELECT team_tricode, count(*) AS games, avg(pts) AS pts, avg(opp_pts) AS allowed, max(season_label) AS season_label
  FROM ${LOG_TABLE}
  WHERE game_type = :gt AND season = (SELECT max(season) FROM ${LOG_TABLE} WHERE game_type = :gt)
  GROUP BY team_tricode`

/** A calendar date written YYYY-MM-DD that really exists (2026-02-30 is refused). */
export function validDate(v) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false
  const d = new Date(`${v}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v
}

const num = (v) => (v === null || v === undefined ? null : Number(v))
const bool = (v) => (v === null || v === undefined ? null : v === true || v === 'true')

/** One team's rest facts for the game, from 9 consecutive columns (game_id first). Null when there is no context row. */
function mapSideContext(r, from) {
  if (r[from] === null || r[from] === undefined) return null
  return {
    daysRest: num(r[from + 1]),
    isB2b: bool(r[from + 2]) === true,
    is3In4: bool(r[from + 3]) === true,
    is4In6: bool(r[from + 4]) === true,
    stintGame: num(r[from + 5]),
    restEdge: num(r[from + 6]),
    gamesIn4: num(r[from + 7]),
    gamesIn6: num(r[from + 8]),
  }
}

/** The warehouse returns every value as a string or null. A game not played has null scores and a null winner. */
export function mapSlateGame(r) {
  return {
    id: r[0],
    date: r[1],
    home: r[2],
    away: r[3],
    homeName: r[4],
    awayName: r[5],
    homePts: num(r[6]),
    awayPts: num(r[7]),
    isFinal: bool(r[8]) === true,
    homeWon: bool(r[9]),
    homeContext: mapSideContext(r, 10),
    awayContext: mapSideContext(r, 19),
  }
}

/** Rows of SLATE_AVERAGES_SQL -> { NYK: { games, pts, allowed, seasonLabel } }. */
export function mapAverages(rows) {
  return Object.fromEntries(rows.map((r) => [r[0], { games: Number(r[1]), pts: num(r[2]), allowed: num(r[3]), seasonLabel: r[4] ?? null }]))
}

export function mapSlate(rows, averageRows = []) {
  return { games: rows.map(mapSlateGame), averages: mapAverages(averageRows) }
}
