import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DEFENSE_POSITIONS, DEFENSE_ROLES, DEFENSE_STATS, LEAGUE_DEFENSE_SQL, NOT_LISTED, TEAM_DEFENSE_SQL, mapDefense,
} from '../server/defenseQueries.mjs'

test('defense SQL: named parameters only, three gold tables, one game type, no bronze or silver', () => {
  assert.deepEqual([...new Set([...TEAM_DEFENSE_SQL.matchAll(/:\w+/g)].map((m) => m[0]))].sort(), [':gt', ':team'])
  assert.deepEqual([...new Set([...LEAGUE_DEFENSE_SQL.matchAll(/:\w+/g)].map((m) => m[0]))], [':gt'])
  for (const sql of [TEAM_DEFENSE_SQL, LEAGUE_DEFENSE_SQL]) {
    assert.deepEqual([...new Set([...sql.matchAll(/workspace\.nba_v2_\w+\.\w+/g)].map((m) => m[0]))].sort(),
      ['workspace.nba_v2_gold.player_season_games', 'workspace.nba_v2_gold.player_season_position', 'workspace.nba_v2_gold.team_game_log'])
    assert.doesNotMatch(sql, /nba_v2_(silver|bronze)|\$\{/)
    assert.match(sql, /game_type = :gt/)
    assert.match(sql, /p\.played AND p\.game_type = :gt/) // only games the player played, one game type
    assert.match(sql, /LEFT JOIN workspace\.nba_v2_gold\.player_season_position pos ON pos\.person_id = p\.person_id AND pos\.season = p\.season/)
    assert.match(sql, /coalesce\(pos\.position, 'Not listed'\)/) // a player with no listed position is its own group, never guessed
    assert.match(sql, /IF\(p\.started, 'starter', 'bench'\)/)
    assert.match(sql, /p\.opponent_team_id AS def_id/) // the group is the OPPONENT's players, keyed to the defending team
    assert.match(sql, /CROSS JOIN buckets b/) // every group is counted in every defended game, as 0 when nobody played in it
    assert.match(sql, /coalesce\(l\.pts, 0\) AS pts/)
    assert.match(sql, /try_divide\(36 \* sum\(pts\), sum\(minutes\)\)/) // per 36 is safe with no minutes
  }
  assert.match(TEAM_DEFENSE_SQL, /team_tricode = :team AND season = \(SELECT max\(season\) FROM workspace\.nba_v2_gold\.team_game_log WHERE game_type = :gt\)/)
  assert.doesNotMatch(LEAGUE_DEFENSE_SQL, /team_tricode|season = \(SELECT/) // the league is every team and every season
})

test('the grid is starter and bench by the eight position labels, guard to center, six stats', () => {
  assert.deepEqual(DEFENSE_ROLES, ['starter', 'bench'])
  assert.deepEqual(DEFENSE_POSITIONS, ['G', 'G-F', 'F-G', 'F', 'F-C', 'C-F', 'C', 'Not listed'])
  assert.equal(NOT_LISTED, 'Not listed')
  assert.deepEqual(DEFENSE_STATS, ['pts', 'reb', 'ast', 'fg3m', 'blk', 'stl'])
  for (const p of ['G', 'G-F', 'F-G', 'F', 'F-C', 'C-F', 'C']) assert.ok(TEAM_DEFENSE_SQL.includes(`('${p}')`), p) // labels exactly as listed
})

// role, label, games, player games, minutes, then per stat: perGame, p10, p90, per36; then first and last season.
const row = (role, label, o = {}) => {
  const base = [role, label, '13', '27', '64.4']
  for (let i = 0; i < DEFENSE_STATS.length; i++) base.push(String(10 + i), '1.5', '30', o.per36 === undefined ? '17.5' : o.per36)
  return [...base, '2026-27', '2026-27']
}

test('mapDefense reads each group, orders starter then bench and guard to center, and keeps numbers as numbers', () => {
  const out = mapDefense([row('bench', 'C'), row('starter', 'F'), row('starter', 'G'), row('bench', 'Not listed'), row('starter', 'G-F')])
  assert.deepEqual(out.groups.map((g) => `${g.role}:${g.label}`), ['starter:G', 'starter:G-F', 'starter:F', 'bench:C', 'bench:Not listed'])
  const g = out.groups[0]
  assert.deepEqual([g.games, g.playerGames, g.minutes], [13, 27, 64.4])
  assert.deepEqual(g.stats.pts, { perGame: 10, low: 1.5, high: 30, per36: 17.5 })
  assert.equal(g.stats.stl.perGame, 15)
  assert.deepEqual(Object.keys(g.stats), DEFENSE_STATS)
  assert.deepEqual([out.firstSeason, out.lastSeason], ['2026-27', '2026-27'])
})

test('mapDefense: no minutes means per 36 is empty (not zero), and an empty answer is no groups', () => {
  assert.equal(mapDefense([row('starter', 'Not listed', { per36: null })]).groups[0].stats.pts.per36, null)
  assert.deepEqual(mapDefense([]), { groups: [], firstSeason: null, lastSeason: null })
})

test('mapDefense: the season span is the earliest first and latest last label across the rows', () => {
  const a = row('starter', 'G'); a[a.length - 2] = '2021-22'; a[a.length - 1] = '2026-27'
  const b = row('bench', 'G'); b[b.length - 2] = '2023-24'; b[b.length - 1] = '2025-26'
  const out = mapDefense([a, b])
  assert.deepEqual([out.firstSeason, out.lastSeason], ['2021-22', '2026-27'])
})
