// What the "Defense by position" panel (Teams > Advanced stats) asks, as fixed SQL plus small pure helpers. Three gold tables,
// all readable by the app identity: team_game_log (the games a team defended), player_season_games (the opposing players'
// box scores, with whether each STARTED) and player_season_position (the position the roster LISTS for each player-season).
// One game type at a time, so regular-season and playoff games are never mixed. A team is named by its three-letter code.
//
// Opponent players are grouped as ROLE x POSITION: role is "starter" (started the game) or "bench"; position is the roster's
// listed label as written (G, G-F, F-G, F, F-C, C-F, C), or "Not listed" when the player-season has no label (about 8% of
// played games). For each group and each stat the grid shows what the group put up AGAINST this defense:
//  * per game: the group's combined total in one defended game, averaged over all the team's defended games. A game where
//    the group had nobody counts as 0, so the figure is "what this defense gives up to, say, starting guards per game";
//  * the 10th to 90th percentile of that per-game total across the games;
//  * per 36 minutes: the group's total stat over its total minutes, times 36 (takes out how many minutes the group played).
// The LEAGUE figure is the same thing over every team and every season on record, so the difference between the two says
// whether this defense gives up more or less to that group than a typical one.

const LOG_TABLE = 'workspace.nba_v2_gold.team_game_log'
const GRID_TABLE = 'workspace.nba_v2_gold.player_season_games'
const POS_TABLE = 'workspace.nba_v2_gold.player_season_position'

export const DEFENSE_STATS = ['pts', 'reb', 'ast', 'fg3m', 'blk', 'stl']
export const DEFENSE_ROLES = ['starter', 'bench']
export const NOT_LISTED = 'Not listed'
// Listed positions as written, ordered guard to center; the grid's rows follow this order.
export const DEFENSE_POSITIONS = ['G', 'G-F', 'F-G', 'F', 'F-C', 'C-F', 'C', NOT_LISTED]

const sqlList = (items) => items.map((x) => `('${x}')`).join(', ')

// `defendedWhere` picks which defended games to count (one team's newest season, or the whole league).
const defenseSql = (defendedWhere) => `
  WITH defended AS (
    SELECT team_id AS def_id, game_id, season_label
    FROM ${LOG_TABLE}
    WHERE game_type = :gt AND ${defendedWhere}
  ),
  buckets AS (
    SELECT r.role, l.label FROM (VALUES ${sqlList(DEFENSE_ROLES)}) AS r(role) CROSS JOIN (VALUES ${sqlList(DEFENSE_POSITIONS)}) AS l(label)
  ),
  lines AS (
    SELECT p.opponent_team_id AS def_id, p.game_id, IF(p.started, 'starter', 'bench') AS role, coalesce(pos.position, '${NOT_LISTED}') AS label,
           count(*) AS players, sum(p.minutes) AS minutes, ${DEFENSE_STATS.map((s) => `sum(p.${s}) AS ${s}`).join(', ')}
    FROM ${GRID_TABLE} p
    LEFT JOIN ${POS_TABLE} pos ON pos.person_id = p.person_id AND pos.season = p.season
    WHERE p.played AND p.game_type = :gt AND p.opponent_team_id IN (SELECT def_id FROM defended)
    GROUP BY p.opponent_team_id, p.game_id, IF(p.started, 'starter', 'bench'), coalesce(pos.position, '${NOT_LISTED}')
  ),
  cells AS (
    SELECT d.season_label, b.role, b.label, coalesce(l.players, 0) AS players, coalesce(l.minutes, 0) AS minutes,
           ${DEFENSE_STATS.map((s) => `coalesce(l.${s}, 0) AS ${s}`).join(', ')}
    FROM defended d CROSS JOIN buckets b
    LEFT JOIN lines l ON l.def_id = d.def_id AND l.game_id = d.game_id AND l.role = b.role AND l.label = b.label
  )
  SELECT role, label, count(*) AS games, sum(players) AS player_games, avg(minutes) AS minutes,
         ${DEFENSE_STATS.map((s) => `avg(${s}), percentile(${s}, 0.1), percentile(${s}, 0.9), try_divide(36 * sum(${s}), sum(minutes))`).join(',\n         ')},
         min(season_label) AS first_season, max(season_label) AS last_season
  FROM cells
  GROUP BY role, label`

// This team's games of the NEWEST season that has games of this type.
export const TEAM_DEFENSE_SQL = defenseSql(
  `team_tricode = :team AND season = (SELECT max(season) FROM ${LOG_TABLE} WHERE game_type = :gt)`,
)
// Every team's games of this type, every season on record.
export const LEAGUE_DEFENSE_SQL = defenseSql('true')

const num = (v) => (v === null || v === undefined ? null : Number(v))
const order = (role, label) => DEFENSE_ROLES.indexOf(role) * 100 + DEFENSE_POSITIONS.indexOf(label)

/**
 * Rows -> { groups: [{ role, label, games, playerGames, minutes, stats: { pts: { perGame, low, high, per36 }, ... } }],
 *           firstSeason, lastSeason }, ordered starter then bench, guard to center. games = the team's defended games counted.
 */
export function mapDefense(rows) {
  let first = null
  let last = null
  const groups = rows.map((r) => {
    const stats = {}
    DEFENSE_STATS.forEach((s, i) => {
      const at = 5 + i * 4
      stats[s] = { perGame: num(r[at]), low: num(r[at + 1]), high: num(r[at + 2]), per36: num(r[at + 3]) }
    })
    const lo = r[5 + DEFENSE_STATS.length * 4]
    const hi = r[6 + DEFENSE_STATS.length * 4]
    if (lo && (first === null || lo < first)) first = lo
    if (hi && (last === null || hi > last)) last = hi
    return { role: r[0], label: r[1], games: Number(r[2]), playerGames: Number(r[3]), minutes: num(r[4]), stats }
  })
  groups.sort((a, b) => order(a.role, a.label) - order(b.role, b.label))
  return { groups, firstSeason: first, lastSeason: last }
}

// ---- The players behind the grid ----
// Every opposing player-game that went into the team's grid (the same defended games, role and position label), one row per
// player per game, so a click on a grid row can name them. Nothing is cut off here: a group with one player-game lists that one.
export const DEFENSE_PLAYERS_SQL = `
  WITH defended AS (
    SELECT team_id AS def_id, game_id
    FROM ${LOG_TABLE}
    WHERE game_type = :gt AND team_tricode = :team AND season = (SELECT max(season) FROM ${LOG_TABLE} WHERE game_type = :gt)
  )
  SELECT p.person_id, p.player_name, p.team_tricode, p.game_id, CAST(p.game_date AS STRING) AS game_date, p.is_home,
         IF(p.started, 'starter', 'bench') AS role, coalesce(pos.position, '${NOT_LISTED}') AS label, p.minutes,
         ${DEFENSE_STATS.map((s) => `p.${s}`).join(', ')}
  FROM ${GRID_TABLE} p
  JOIN defended d ON d.def_id = p.opponent_team_id AND d.game_id = p.game_id
  LEFT JOIN ${POS_TABLE} pos ON pos.person_id = p.person_id AND pos.season = p.season
  WHERE p.played AND p.game_type = :gt
  ORDER BY p.game_date DESC, p.game_id DESC, p.pts DESC`

/** Rows -> { lines: [{ id, name, team, gameId, date, home, role, label, minutes, stats: { pts, ... } }] }, newest game first. */
export function mapDefensePlayers(rows) {
  const lines = rows.map((r) => {
    const stats = {}
    DEFENSE_STATS.forEach((s, i) => {
      stats[s] = num(r[9 + i])
    })
    return {
      id: String(r[0]), name: r[1], team: r[2], gameId: r[3], date: r[4], home: r[5] === true || r[5] === 'true',
      role: r[6], label: r[7], minutes: num(r[8]), stats,
    }
  })
  return { lines }
}
