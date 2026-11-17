import test from 'node:test'
import assert from 'node:assert/strict'
import { BUCKETS_SQL } from '../server/contextQueries.mjs'
import { LEAGUE_PLAYER_CONTEXT_SQL, MIN_SEASON_GAMES, PLAYER_CONTEXT_SQL, PLAYER_STATS, PLAYER_TEAM_SQL, mapPlayerBuckets, mapPlayerTeam } from '../server/playerContextQueries.mjs'
import { COMPARISONS, difference } from '../src/lib/context.ts'
import { hashFor, isAdvancedHash, parseHash, playerFromHash } from '../src/lib/pages.ts'
import { PLAYER_STAT_LIST, availabilityText, fmtLeague, fmtShare, fmtShareDiff, playedShare } from '../src/lib/playerContext.ts'

test('outside values only enter the player SQL as named parameters, on tables the app already reads', () => {
  for (const q of [PLAYER_CONTEXT_SQL, LEAGUE_PLAYER_CONTEXT_SQL, PLAYER_TEAM_SQL]) {
    assert.doesNotMatch(q, /\$\{/)
    assert.match(q, /:gt\b/)
    assert.match(q, /workspace\.nba_v2_gold\.player_season_games/)
  }
  assert.match(PLAYER_CONTEXT_SQL, /p\.person_id = :id/)
  assert.match(PLAYER_TEAM_SQL, /person_id = :id/)
  const tables = new Set([...(PLAYER_CONTEXT_SQL + LEAGUE_PLAYER_CONTEXT_SQL + PLAYER_TEAM_SQL).matchAll(/workspace\.nba_v2_gold\.(\w+)/g)].map((m) => m[1]))
  assert.deepEqual([...tables].sort(), ['game_context', 'player_season_games']) // no new table, so no new grant
})

test('the player and league queries use the very same situation buckets as the Teams tab, one game type, played team games only', () => {
  for (const q of [PLAYER_CONTEXT_SQL, LEAGUE_PLAYER_CONTEXT_SQL]) {
    assert.ok(q.includes(BUCKETS_SQL))
    assert.match(q, /p\.game_type = :gt AND c\.game_type = :gt AND c\.is_final/) // a regular-season and a playoff game are never mixed; unplayed games are out
    assert.match(q, /c\.team_id = p\.team_id AND c\.game_id = p\.game_id/)
  }
})

test('the player\'s stats are averaged over the games he played only, and the league effect is measured against his own season average', () => {
  for (const s of PLAYER_STATS) assert.ok(PLAYER_CONTEXT_SQL.includes(`avg(IF(p.played, p.${s}, NULL))`), s)
  for (const s of PLAYER_STATS) assert.ok(LEAGUE_PLAYER_CONTEXT_SQL.includes(`avg(c.${s} - c.own_${s})`), s)
  assert.match(LEAGUE_PLAYER_CONTEXT_SQL, /PARTITION BY p\.person_id, p\.season, p\.game_type/)
  assert.ok(LEAGUE_PLAYER_CONTEXT_SQL.includes(`c.season_games >= ${MIN_SEASON_GAMES}`))
  assert.equal(MIN_SEASON_GAMES, 20)
  assert.match(PLAYER_CONTEXT_SQL, /p\.season = \(SELECT max\(season\)/) // his newest season of this game type
})

// bucket, scheduled, played, 7 stats, first season, last season
const row = (bucket, scheduled, played, stats, first = '2026-27', last = '2026-27') => [bucket, String(scheduled), played === null ? null : String(played), ...stats.map((x) => (x === null ? null : String(x))), first, last]

test('rows become buckets: n is games played, scheduled is every team game in that situation, empty stats stay null', () => {
  const m = mapPlayerBuckets([row('all', 13, 13, [26.7, 2.8, 5.9, 2.8, 0.3, 0.8, 34.3]), row('b2b', 2, 1, [32.5, 2, 6, 4.5, 0.5, null, 35.1], '2026-27', '2026-27')])
  assert.deepEqual(m.buckets.all, { n: 13, scheduled: 13, stats: { pts: 26.7, reb: 2.8, ast: 5.9, fg3m: 2.8, blk: 0.3, stl: 0.8, minutes: 34.3 } })
  assert.equal(m.buckets.b2b.n, 1)
  assert.equal(m.buckets.b2b.scheduled, 2)
  assert.equal(m.buckets.b2b.stats.stl, null)
  assert.deepEqual([m.firstSeason, m.lastSeason], ['2026-27', '2026-27'])
  assert.deepEqual(mapPlayerBuckets([]), { buckets: {}, firstSeason: null, lastSeason: null })
  const missed = mapPlayerBuckets([row('b2b', 3, 0, [null, null, null, null, null, null, null])])
  assert.equal(missed.buckets.b2b.n, 0) // he missed all three: shown as 0 of 3, with no averages
  assert.equal(mapPlayerBuckets([row('a', 1, 1, [1, 1, 1, 1, 1, 1, 1], '2021-22', '2022-23'), row('b', 1, 1, [1, 1, 1, 1, 1, 1, 1], '2020-21', '2025-26')]).firstSeason, '2020-21')
  assert.equal(mapPlayerTeam([['NYK']]), 'NYK')
  assert.equal(mapPlayerTeam([]), null)
})

test('the same difference rule works for the player stats: a side with no games played gives no figure, one game gives one', () => {
  const split = mapPlayerBuckets([row('b2b', 2, 0, [null, null, null, null, null, null, null]), row('rested', 10, 10, [20, 5, 5, 2, 1, 1, 30]), row('home', 7, 1, [30, 4, 6, 3, 0, 2, 35]), row('away', 6, 6, [20, 5, 5, 2, 1, 1, 30])])
  assert.equal(difference(split, 'b2b', 'rested', 'pts', 1), null)
  const d = difference(split, 'home', 'away', 'pts', 1)
  assert.deepEqual([d.a, d.b, d.diff, d.nA, d.nB], [30, 20, 10, 1, 6])
  assert.deepEqual(PLAYER_STAT_LIST.map((s) => s.key), PLAYER_STATS)
})

test('availability reads "played N of M" and the share and its difference are plain numbers', () => {
  const b = { n: 5, scheduled: 7, stats: {} }
  assert.equal(availabilityText(b), 'played 5 of 7')
  assert.equal(availabilityText({ n: 0, scheduled: 3, stats: {} }), 'played 0 of 3')
  assert.equal(availabilityText(undefined), 'no games')
  assert.equal(availabilityText({ n: 0, scheduled: 0, stats: {} }), 'no games')
  assert.equal(Math.round(playedShare(b)), 71)
  assert.equal(playedShare(undefined), null)
  assert.equal(fmtShare(71.4), '71%')
  assert.equal(fmtShare(null), '-')
  assert.equal(fmtShareDiff(60, 61.2), '-1.2 pts')
  assert.equal(fmtShareDiff(62, 60), '+2.0 pts')
  assert.equal(fmtShareDiff(60, 60.01), '0.0 pts')
  assert.equal(fmtShareDiff(null, 60), '-')
})

test('the Players page has its own Advanced address that carries the team and the player, and only digits count as a player', () => {
  assert.equal(hashFor('players', 'NYK', 'advanced', '1628973'), '#/players/advanced?team=NYK&player=1628973')
  assert.equal(hashFor('players', 'NYK', 'overview', '1628973'), '#/players?team=NYK&player=1628973')
  assert.equal(hashFor('players', 'NYK', 'advanced', 'x;DROP'), '#/players/advanced?team=NYK')
  assert.equal(hashFor('teams', 'NYK', 'advanced', '1628973'), '#/teams/advanced?team=NYK') // a player never rides on the Teams page
  assert.equal(hashFor('players', '', 'advanced'), '#/players/advanced')
  assert.equal(isAdvancedHash('#/players/advanced?team=NYK'), true)
  assert.equal(isAdvancedHash('#/players?team=NYK'), false)
  assert.equal(isAdvancedHash('#/players/advancedx'), false)
  assert.deepEqual(parseHash('#/players/advanced?team=NYK&player=1628973'), { page: 'players', team: 'NYK' })
  assert.equal(playerFromHash('#/players/advanced?team=NYK&player=1628973'), '1628973')
  for (const bad of ['', '#/players/advanced?player=abc', '#/players/advanced?player=1;2', '#/players/advanced?player=1234567890123']) assert.equal(playerFromHash(bad), '', bad)
  assert.equal(COMPARISONS.length, 4)
})

test('league figures keep two decimals and a sign, because the effects are small', () => {
  assert.equal(fmtLeague(0.2709), '+0.27')
  assert.equal(fmtLeague(-0.0465), '-0.05')
  assert.equal(fmtLeague(0.0461), '+0.05')
  assert.equal(fmtLeague(-0.001), '0.00') // never "-0.00"
  assert.equal(fmtLeague(0), '0.00')
})
