// What the Advanced stats tab (Teams) asks, as fixed SQL plus small pure helpers (easy to test). Two gold tables, both
// read-only for the app identity: game_context (one row per team per game on the schedule: rest, back-to-back, home or
// away, crowded stretches; also games not yet played) and team_game_log (one row per team per game played: the box score).
// One game type at a time, so a regular-season and a playoff game are never mixed. A team is named by its three-letter code.

const CTX_TABLE = 'workspace.nba_v2_gold.game_context'
const LOG_TABLE = 'workspace.nba_v2_gold.team_game_log'

export const CONTEXT_STATS = ['pts', 'allowed', 'margin', 'fg_pct', 'fg3m', 'tov']

// A game falls into several "buckets" at once (all games, home or away, back-to-back, rested, ...). One row per bucket.
export const BUCKETS = ['all', 'home', 'away', 'b2b', 'rested', 'rest1', 'rest2plus', 'edge_plus', 'edge_minus']
// The situations one game falls into, as an array (the single source of truth: the grouped queries explode it, the game lists
// below return it, so a game is on the same side of a comparison in the table and in the list).
export const BUCKET_ARRAY_SQL = `filter(array(
    'all',
    CASE WHEN c.is_home THEN 'home' ELSE 'away' END,
    CASE WHEN c.days_rest = 0 THEN 'b2b' END,
    CASE WHEN c.days_rest >= 1 THEN 'rested' END,
    CASE WHEN c.days_rest = 1 THEN 'rest1' END,
    CASE WHEN c.days_rest >= 2 THEN 'rest2plus' END,
    CASE WHEN c.rest_edge > 0 THEN 'edge_plus' END,
    CASE WHEN c.rest_edge < 0 THEN 'edge_minus' END), x -> x IS NOT NULL)`
export const BUCKETS_SQL = `
  LATERAL VIEW explode(${BUCKET_ARRAY_SQL}) b AS bucket`
const BUCKET_COLUMNS = `
  b.bucket, count(*) AS n, avg(l.pts) AS pts, avg(l.opp_pts) AS allowed, avg(l.pts - l.opp_pts) AS margin,
  100 * sum(l.fgm) / sum(l.fga) AS fg_pct, avg(l.fg3m) AS fg3m, avg(l.tov) AS tov,
  min(c.season_label) AS first_season, max(c.season_label) AS last_season`
const FROM_PLAYED = `
  FROM ${CTX_TABLE} c JOIN ${LOG_TABLE} l ON l.team_id = c.team_id AND l.game_id = c.game_id ${BUCKETS_SQL}`

// This team's played games of the NEWEST season that has games of this type, by bucket.
export const TEAM_CONTEXT_SQL = `
  SELECT ${BUCKET_COLUMNS}
  ${FROM_PLAYED}
  WHERE c.team_tricode = :team AND c.game_type = :gt AND c.is_final
    AND c.season = (SELECT max(season) FROM ${CTX_TABLE} WHERE game_type = :gt AND is_final)
  GROUP BY b.bucket`

// The games behind TEAM_CONTEXT_SQL: this team's played games of the same season, one row each, with the situations it falls in
// (comma separated) and the six stats the page shows. FG% is the game's own (made over attempted).
export const TEAM_CONTEXT_GAMES_SQL = `
  SELECT c.game_id, CAST(c.game_date AS STRING), c.opponent_tricode, c.is_home, c.days_rest, c.rest_edge,
         concat_ws(',', ${BUCKET_ARRAY_SQL}) AS buckets,
         l.pts, l.opp_pts, l.pts - l.opp_pts AS margin, try_divide(100 * l.fgm, l.fga) AS fg_pct, l.fg3m, l.tov
  FROM ${CTX_TABLE} c JOIN ${LOG_TABLE} l ON l.team_id = c.team_id AND l.game_id = c.game_id
  WHERE c.team_tricode = :team AND c.game_type = :gt AND c.is_final
    AND c.season = (SELECT max(season) FROM ${CTX_TABLE} WHERE game_type = :gt AND is_final)
  ORDER BY c.game_date DESC, c.game_id DESC`

// Every team's played games of this type in every season on record, by bucket (the league-wide effect).
export const LEAGUE_CONTEXT_SQL = `
  SELECT ${BUCKET_COLUMNS}
  ${FROM_PLAYED}
  WHERE c.game_type = :gt AND c.is_final
  GROUP BY b.bucket`

// The team's next game that has not been played. Schedule dates are US dates, so "today" is today's date in US Eastern time:
// a game stays "next" until Eastern midnight after its date (even if it has just finished and its box score has not landed),
// and an unplayed game dated earlier than today (postponed, or a late box score) is skipped.
export const EASTERN_TODAY = `CAST(from_utc_timestamp(current_timestamp(), 'America/New_York') AS DATE)`
export const NEXT_GAME_SQL = `
  SELECT game_id, game_date, opponent_tricode, is_home, days_rest, is_b2b, games_in_4, games_in_6, is_3_in_4, is_4_in_6,
         stint_game_number, opp_days_rest, rest_edge, season_label
  FROM ${CTX_TABLE}
  WHERE team_tricode = :team AND game_type = :gt AND NOT is_final AND game_date >= ${EASTERN_TODAY}
  ORDER BY game_date, game_id LIMIT 1`

const num = (v) => (v === null || v === undefined ? null : Number(v))
const bool = (v) => (v === null || v === undefined ? null : v === true || v === 'true')

/** Rows -> { bucket: { n, stats: {pts, allowed, ...} } } plus the first and last season label that fed them. */
export function mapBuckets(rows) {
  const buckets = {}
  let first = null
  let last = null
  for (const r of rows) {
    buckets[r[0]] = { n: Number(r[1]), stats: Object.fromEntries(CONTEXT_STATS.map((s, i) => [s, num(r[2 + i])])) }
    if (r[8] && (first === null || r[8] < first)) first = r[8]
    if (r[9] && (last === null || r[9] > last)) last = r[9]
  }
  return { buckets, firstSeason: first, lastSeason: last }
}

/** The next game, or null. days_rest is null on a team's first game of a season. */
export function mapNextGame(rows) {
  const r = rows[0]
  if (!r) return null
  return {
    id: r[0], date: r[1], opp: r[2], isHome: bool(r[3]), daysRest: num(r[4]), isB2b: bool(r[5]), gamesIn4: num(r[6]), gamesIn6: num(r[7]),
    is3In4: bool(r[8]), is4In6: bool(r[9]), stintGame: num(r[10]), oppDaysRest: num(r[11]), restEdge: num(r[12]), seasonLabel: r[13],
  }
}

const splitBuckets = (v) => (typeof v === 'string' && v !== '' ? v.split(',') : [])

/** Rows (TEAM_CONTEXT_GAMES_SQL) -> { games: [{ id, date, opp, isHome, daysRest, restEdge, buckets, stats }] }, newest first. */
export function mapTeamContextGames(rows) {
  return {
    games: rows.map((r) => ({
      id: r[0], date: r[1], opp: r[2], isHome: bool(r[3]), daysRest: num(r[4]), restEdge: num(r[5]), buckets: splitBuckets(r[6]),
      stats: { pts: num(r[7]), allowed: num(r[8]), margin: num(r[9]), fg_pct: num(r[10]), fg3m: num(r[11]), tov: num(r[12]) },
    })),
  }
}
