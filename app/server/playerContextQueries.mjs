// What the Advanced stats tab (Players) asks, as fixed SQL plus small pure helpers. Two gold tables, both already readable
// by the app identity, so no new table and no new grant: player_season_games (one row per player, team and team game, played
// or not, with the box score when played) joined to game_context (rest, back-to-back, home or away for each team game).
// The situations ("buckets") are the SAME as on the Teams tab (BUCKETS_SQL is shared). One game type at a time, never mixed.
//
// Two splits:
//  * the PLAYER's own games of the newest season of this game type, by bucket: the average of each stat over the games he
//    played, how many he played, and how many team games there were in that situation (so "played 5 of 7");
//  * the LEAGUE effect, "vs own average": each played game's stat minus that player's own average for that season and game
//    type, averaged over every player and every season on record. Measuring each player against himself takes out WHO
//    tends to play in a situation (stars often sit the second night of a back-to-back). Only player-seasons with at least
//    MIN_SEASON_GAMES games played count, so a handful of games cannot pull the average around.

import { BUCKETS_SQL } from './contextQueries.mjs'

const GRID_TABLE = 'workspace.nba_v2_gold.player_season_games'
const CTX_TABLE = 'workspace.nba_v2_gold.game_context'

export const PLAYER_STATS = ['pts', 'reb', 'ast', 'fg3m', 'blk', 'stl', 'minutes']
export const MIN_SEASON_GAMES = 20

// A stat is only counted for games the player played (it is empty for a game he missed anyway; this makes that explicit).
const played = (col) => `IF(p.played, p.${col}, NULL)`

export const PLAYER_CONTEXT_SQL = `
  SELECT b.bucket, count(*) AS scheduled, sum(CAST(p.played AS INT)) AS played,
         ${PLAYER_STATS.map((s) => `avg(${played(s)})`).join(', ')},
         min(c.season_label) AS first_season, max(c.season_label) AS last_season
  FROM ${GRID_TABLE} p
  JOIN ${CTX_TABLE} c ON c.team_id = p.team_id AND c.game_id = p.game_id
  ${BUCKETS_SQL}
  WHERE p.person_id = :id AND p.game_type = :gt AND c.game_type = :gt AND c.is_final
    AND p.season = (SELECT max(season) FROM ${CTX_TABLE} WHERE game_type = :gt AND is_final)
  GROUP BY b.bucket`

// Every player's played games of this type in every season on record, each measured against that player's own season average.
export const LEAGUE_PLAYER_CONTEXT_SQL = `
  WITH g AS (
    SELECT p.played, c.is_home, c.days_rest, c.rest_edge, c.season_label,
           ${PLAYER_STATS.map((s) => `${played(s)} AS ${s}`).join(', ')},
           ${PLAYER_STATS.map((s) => `avg(${played(s)}) OVER (PARTITION BY p.person_id, p.season, p.game_type) AS own_${s}`).join(', ')},
           sum(CAST(p.played AS INT)) OVER (PARTITION BY p.person_id, p.season, p.game_type) AS season_games
    FROM ${GRID_TABLE} p
    JOIN ${CTX_TABLE} c ON c.team_id = p.team_id AND c.game_id = p.game_id
    WHERE p.game_type = :gt AND c.game_type = :gt AND c.is_final)
  SELECT b.bucket, count(*) AS scheduled, sum(CAST(c.played AS INT)) AS played,
         ${PLAYER_STATS.map((s) => `avg(c.${s} - c.own_${s})`).join(', ')},
         min(c.season_label) AS first_season, max(c.season_label) AS last_season
  FROM g c
  ${BUCKETS_SQL}
  WHERE c.season_games >= ${MIN_SEASON_GAMES}
  GROUP BY b.bucket`

// The team the player last played for in this game type (his "next game" is that team's next game).
export const PLAYER_TEAM_SQL = `
  SELECT team_tricode FROM ${GRID_TABLE}
  WHERE person_id = :id AND game_type = :gt AND played
  ORDER BY game_date DESC, game_id DESC LIMIT 1`

const num = (v) => (v === null || v === undefined ? null : Number(v))

/**
 * Rows -> { buckets: { bucket: { n, scheduled, stats } }, firstSeason, lastSeason }. n is the number of games PLAYED (the games
 * the averages are made from); scheduled is every team game in that situation.
 */
export function mapPlayerBuckets(rows) {
  const buckets = {}
  let first = null
  let last = null
  const k = PLAYER_STATS.length
  for (const r of rows) {
    buckets[r[0]] = {
      n: Number(r[2] ?? 0),
      scheduled: Number(r[1]),
      stats: Object.fromEntries(PLAYER_STATS.map((s, i) => [s, num(r[3 + i])])),
    }
    const f = r[3 + k]
    const l = r[4 + k]
    if (f && (first === null || f < first)) first = f
    if (l && (last === null || l > last)) last = l
  }
  return { buckets, firstSeason: first, lastSeason: last }
}

export const mapPlayerTeam = (rows) => rows[0]?.[0] ?? null
