import test from 'node:test'
import assert from 'node:assert/strict'
import { BUCKETS, CONTEXT_STATS, EASTERN_TODAY, LEAGUE_CONTEXT_SQL, NEXT_GAME_SQL, TEAM_CONTEXT_SQL, mapBuckets, mapNextGame } from '../server/contextQueries.mjs'
import { COMPARISONS, MIN_TEAM_GAMES, applicableComparisons, difference, fmtDiff, fmtValue, nextGameFacts, ordinal, restWords } from '../src/lib/context.ts'
import { hashFor, isAdvancedHash, pageFromHash, parseHash, rememberTeam } from '../src/lib/pages.ts'

// A bucket row in the order the SQL returns it: bucket, n, then the six stats, then first and last season.
const brow = (bucket, n, o = {}) => [bucket, String(n), o.pts ?? '112.5', o.allowed ?? '110.0', o.margin ?? '2.5', o.fg ?? '47.1', o.fg3 ?? '13.2', o.tov ?? '13.0', '2021-22', o.last ?? '2026-27']

test('outside values only enter the context SQL as named parameters', () => {
  for (const s of [TEAM_CONTEXT_SQL, NEXT_GAME_SQL]) {
    assert.match(s, /team_tricode = :team\b/)
    assert.doesNotMatch(s, /\$\{/)
  }
  for (const s of [TEAM_CONTEXT_SQL, LEAGUE_CONTEXT_SQL, NEXT_GAME_SQL]) assert.match(s, /game_type = :gt\b/)
  assert.doesNotMatch(LEAGUE_CONTEXT_SQL, /:team\b/)
})

test('only played games feed the splits and only unplayed games feed the next game', () => {
  assert.match(TEAM_CONTEXT_SQL, /c\.is_final/)
  assert.match(LEAGUE_CONTEXT_SQL, /c\.is_final/)
  assert.match(NEXT_GAME_SQL, /NOT is_final/)
  assert.match(NEXT_GAME_SQL, /ORDER BY game_date, game_id LIMIT 1/)
  assert.match(TEAM_CONTEXT_SQL, /FROM workspace\.nba_v2_gold\.game_context c JOIN workspace\.nba_v2_gold\.team_game_log l/)
})

test('the next game is the first unplayed game dated today or later in US Eastern time, not in UTC', () => {
  assert.match(EASTERN_TODAY, /from_utc_timestamp\(current_timestamp\(\), 'America\/New_York'\)/)
  assert.ok(NEXT_GAME_SQL.includes(`game_date >= ${EASTERN_TODAY}`))
  assert.doesNotMatch(NEXT_GAME_SQL, /current_date\(\)/) // current_date() is the UTC date, which is ahead of Eastern for 4 to 5 hours every evening
})

test('every bucket the page compares is produced by the SQL', () => {
  for (const b of BUCKETS) assert.ok(TEAM_CONTEXT_SQL.includes(`'${b}'`), b)
  for (const c of COMPARISONS) assert.ok(BUCKETS.includes(c.a) && BUCKETS.includes(c.b), c.key)
})

test('bucket rows become numbers per stat, with the season range that fed them', () => {
  const m = mapBuckets([brow('home', 6150, { pts: '114.0' }), brow('away', 6150, { pts: '112.1', last: '2025-26' })])
  assert.deepEqual(Object.keys(m.buckets), ['home', 'away'])
  assert.equal(m.buckets.home.n, 6150)
  assert.equal(m.buckets.home.stats.pts, 114)
  assert.deepEqual(Object.keys(m.buckets.home.stats), CONTEXT_STATS)
  assert.deepEqual([m.firstSeason, m.lastSeason], ['2021-22', '2026-27'])
  assert.deepEqual(mapBuckets([]), { buckets: {}, firstSeason: null, lastSeason: null })
})

test('the next game maps its rest facts; no row means no game', () => {
  const g = mapNextGame([['0022600250', '2026-11-16', 'NYK', 'false', '0', 'true', '2', '3', 'false', 'false', '2', '2', '-2', '2026-27']])
  assert.deepEqual(g, {
    id: '0022600250', date: '2026-11-16', opp: 'NYK', isHome: false, daysRest: 0, isB2b: true, gamesIn4: 2, gamesIn6: 3, is3In4: false,
    is4In6: false, stintGame: 2, oppDaysRest: 2, restEdge: -2, seasonLabel: '2026-27',
  })
  assert.equal(mapNextGame([]), null)
  const opener = mapNextGame([['x', '2026-10-20', 'BOS', 'true', null, null, '1', '1', 'false', 'false', '1', null, null, '2026-27']])
  assert.deepEqual([opener.daysRest, opener.isB2b, opener.restEdge], [null, null, null])
})

test('a difference needs both groups, a number, and enough games', () => {
  const split = { buckets: { b2b: { n: 14, stats: { pts: 108, allowed: 112, margin: -4, fg_pct: 45, fg3m: 12, tov: 14 } }, rested: { n: 67, stats: { pts: 112, allowed: 110, margin: 2, fg_pct: 47.5, fg3m: 13, tov: 13 } } }, firstSeason: null, lastSeason: null }
  const d = difference(split, 'b2b', 'rested', 'pts', MIN_TEAM_GAMES)
  assert.deepEqual([d.a, d.b, d.diff, d.nA, d.nB], [108, 112, -4, 14, 67])
  assert.equal(difference(split, 'b2b', 'missing', 'pts', 1), null)
  assert.equal(difference(split, 'b2b', 'rested', 'pts', 20), null) // 14 games on one side is under 20
  const empty = { buckets: { a: { n: 10, stats: { pts: null } }, b: { n: 10, stats: { pts: 1 } } }, firstSeason: null, lastSeason: null }
  assert.equal(difference(empty, 'a', 'b', 'pts', 1), null)
  assert.equal(MIN_TEAM_GAMES, 1) // owner's choice 2026-11-16
  const one = { buckets: { b2b: { n: 1, stats: { pts: 99, allowed: 100, margin: -1, fg_pct: 44, fg3m: 10, tov: 12 } }, rested: { n: 9, stats: { pts: 110, allowed: 108, margin: 2, fg_pct: 47, fg3m: 12, tov: 13 } } }, firstSeason: null, lastSeason: null }
  const d1 = difference(one, 'b2b', 'rested', 'pts', MIN_TEAM_GAMES)
  assert.deepEqual([d1.diff, d1.nA, d1.nB], [-11, 1, 9]) // one game is shown, with its count
  const none = { buckets: { b2b: { n: 0, stats: { pts: null } }, rested: { n: 9, stats: { pts: 110 } } }, firstSeason: null, lastSeason: null }
  assert.equal(difference(none, 'b2b', 'rested', 'pts', MIN_TEAM_GAMES), null) // no games at all stays empty
})

test('numbers are written with one decimal; a difference carries a sign and never shows -0.0', () => {
  assert.equal(fmtValue('pts', 112.456), '112.5')
  assert.equal(fmtValue('fg_pct', 47.14), '47.1%')
  assert.equal(fmtDiff('pts', -1.27), '-1.3')
  assert.equal(fmtDiff('pts', 1.949), '+1.9')
  assert.equal(fmtDiff('fg_pct', 0.68), '+0.7 pts')
  assert.equal(fmtDiff('tov', -0.04), '0.0')
  assert.equal(fmtDiff('fg_pct', 0), '0.0 pts')
})

test('rest and ordinals are written in plain words', () => {
  assert.equal(restWords(null), 'first game of the season')
  assert.equal(restWords(0), 'second night of a back-to-back')
  assert.equal(restWords(1), '1 day of rest')
  assert.equal(restWords(3), '3 days of rest')
  assert.match(restWords(10), /long break, or games missing from the schedule/)
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22].map(ordinal), ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd'])
})

test('the next game reads as a list of plain facts', () => {
  const base = { id: 'g', date: '2026-11-16', opp: 'NYK', isHome: false, daysRest: 0, isB2b: true, gamesIn4: 3, gamesIn6: 3, is3In4: true, is4In6: false, stintGame: 3, oppDaysRest: 2, restEdge: -2, seasonLabel: '2026-27' }
  assert.deepEqual(nextGameFacts(base), [
    'Away at NYK', 'game 3 of a road trip', 'second night of a back-to-back', '3rd game in 4 nights', 'NYK has 2 days of rest', 'less rested than NYK by 2 days',
  ])
  const home = nextGameFacts({ ...base, isHome: true, stintGame: 1, daysRest: 2, isB2b: false, is3In4: false, oppDaysRest: 0, restEdge: 2 })
  assert.deepEqual(home, ['At home vs NYK', '2 days of rest', 'NYK has played the night before', 'more rested than NYK by 2 days'])
})

test('the comparisons that match the next game are the ones highlighted', () => {
  const g = (o) => ({ isHome: true, daysRest: 1, restEdge: 0, ...o })
  assert.deepEqual([...applicableComparisons(null)], [])
  assert.deepEqual([...applicableComparisons(g({ daysRest: 0, restEdge: -1 }))].sort(), ['b2b', 'edge', 'home'])
  assert.deepEqual([...applicableComparisons(g({ daysRest: 3 }))].sort(), ['home', 'rest'])
  assert.deepEqual([...applicableComparisons(g({ daysRest: null }))].sort(), ['home'])
  assert.deepEqual([...applicableComparisons(g({ daysRest: 12 }))].sort(), ['home']) // a long gap is not "2+ days of rest" to compare with
})

test('the Advanced stats address opens the Teams page on the Advanced tab; every other address is unchanged', () => {
  assert.equal(isAdvancedHash('#/teams/advanced'), true)
  assert.equal(isAdvancedHash('#/teams/advanced?team=BOS'), true)
  for (const h of ['', '#/teams', '#/teams?team=BOS', '#/players', '#/today', '#/teams/advancedx']) assert.equal(isAdvancedHash(h), false, h)
  assert.equal(pageFromHash('#/teams/advanced?team=BOS'), 'teams')
  assert.deepEqual(parseHash('#/teams/advanced?team=BOS'), { page: 'teams', team: 'BOS' })
  assert.equal(hashFor('teams', 'BOS', 'advanced'), '#/teams/advanced?team=BOS')
  assert.equal(hashFor('teams', 'BOS'), '#/teams?team=BOS')
  assert.equal(hashFor('teams', '', 'advanced'), '#/teams/advanced')
  assert.equal(hashFor('players', 'BOS', 'advanced'), '#/players/advanced?team=BOS') // the Players page has the tab too (release 061)
  assert.equal(typeof rememberTeam, 'function')
  assert.equal(pageFromHash('#/teams/advancedx'), 'today')
})
