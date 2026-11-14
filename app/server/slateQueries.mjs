// What the Today's games page asks, as fixed SQL plus small pure helpers (easy to test). One gold table, read-only for
// the app identity: game_slate (one row per game of the latest season, played or not). The page shows ONE game type at a
// time, so a regular-season and a playoff game are never in the same list. game_date is the schedule's US date.

const SLATE_TABLE = 'workspace.nba_v2_gold.game_slate'

export const SLATE_SQL = `
  SELECT game_id, game_date, home_tricode, away_tricode, home_team_name, away_team_name, home_pts, away_pts, is_final, home_won
  FROM ${SLATE_TABLE}
  WHERE game_date = CAST(:date AS DATE) AND game_type = :gt
  ORDER BY game_id`

/** A calendar date written YYYY-MM-DD that really exists (2026-02-30 is refused). */
export function validDate(v) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false
  const d = new Date(`${v}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v
}

const num = (v) => (v === null || v === undefined ? null : Number(v))
const bool = (v) => (v === null || v === undefined ? null : v === true || v === 'true')

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
  }
}

export function mapSlate(rows) {
  return { games: rows.map(mapSlateGame) }
}
