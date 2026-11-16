import test from 'node:test'
import assert from 'node:assert/strict'
import { SLATE_SQL, mapSlate, mapSlateGame, validDate } from '../server/slateQueries.mjs'
import { chipsFor, dateHeading, easternDate, emptyText, gameStatus, isIsoDate, shiftDate, winner } from '../src/lib/slate.ts'
import { hashFor, pageFromHash, parseHash } from '../src/lib/pages.ts'

// A row in the order the SQL returns it.
const final = ['0022600240', '2026-11-13', 'CHI', 'ATL', 'Chicago Bulls', 'Atlanta Hawks', '125', '117', 'true', 'true']
const future = ['0022600244', '2026-11-15', 'SAC', 'OKC', 'Sacramento Kings', 'Oklahoma City Thunder', null, null, 'false', null]

test('outside values only enter the slate SQL as named parameters', () => {
  assert.match(SLATE_SQL, /game_date = CAST\(:date AS DATE\)/)
  assert.match(SLATE_SQL, /game_type = :gt\b/)
  assert.doesNotMatch(SLATE_SQL, /\$\{/)
  assert.match(SLATE_SQL, /FROM workspace\.nba_v2_gold\.game_slate\b/)
})

test('rest facts come from game_context by LEFT JOIN on the game and the team, so a missing row never drops a game', () => {
  assert.match(SLATE_SQL, /LEFT JOIN workspace\.nba_v2_gold\.game_context h ON h\.game_id = s\.game_id AND h\.team_tricode = s\.home_tricode/)
  assert.match(SLATE_SQL, /LEFT JOIN workspace\.nba_v2_gold\.game_context a ON a\.game_id = s\.game_id AND a\.team_tricode = s\.away_tricode/)
  assert.doesNotMatch(SLATE_SQL, /(?<!LEFT )JOIN/)
  assert.match(SLATE_SQL, /s\.game_type = :gt\b/) // still one game type at a time
  // the 7 columns per side come back in the order mapSlateGame reads them
  assert.equal(SLATE_SQL.match(/h\.game_id, h\.days_rest, h\.is_b2b, h\.is_3_in_4, h\.is_4_in_6, h\.stint_game_number, h\.rest_edge/)?.length, 1)
  assert.equal(SLATE_SQL.match(/a\.game_id, a\.days_rest, a\.is_b2b, a\.is_3_in_4, a\.is_4_in_6, a\.stint_game_number, a\.rest_edge/)?.length, 1)
})

// home: id, days_rest, b2b, 3in4, 4in6, stint, edge; then away: the same.
const withContext = [...final,
  '0022600240', '0', 'true', 'true', 'true', '2', '-3',
  '0022600240', '3', 'false', 'false', 'false', '4', '3']

test('rest facts are mapped per side; a game with no context row has none; a season opener has empty rest numbers', () => {
  const g = mapSlateGame(withContext)
  assert.deepEqual(g.homeContext, { daysRest: 0, isB2b: true, is3In4: true, is4In6: true, stintGame: 2, restEdge: -3 })
  assert.deepEqual(g.awayContext, { daysRest: 3, isB2b: false, is3In4: false, is4In6: false, stintGame: 4, restEdge: 3 })
  const oneMissing = mapSlateGame([...final, null, null, null, null, null, null, null, ...withContext.slice(17)])
  assert.equal(oneMissing.homeContext, null)
  assert.notEqual(oneMissing.awayContext, null)
  const opener = mapSlateGame([...final, 'g', null, null, null, null, '1', null, ...withContext.slice(17)])
  assert.deepEqual(opener.homeContext, { daysRest: null, isB2b: false, is3In4: false, is4In6: false, stintGame: 1, restEdge: null })
})

const ctx = (o = {}) => ({ daysRest: 1, isB2b: false, is3In4: false, is4In6: false, stintGame: 1, restEdge: 0, ...o })
const labels = (c, home) => chipsFor(c, home).map((x) => x.label)

test('a team with nothing unusual, no context, or an opener gets no chips', () => {
  assert.deepEqual(chipsFor(ctx(), true), [])
  assert.deepEqual(chipsFor(null, true), [])
  assert.deepEqual(chipsFor(ctx({ daysRest: null, restEdge: null }), false), [])
})

test('back-to-back and the stronger crowded stretch: 3 in 4 beats 4 in 6, never both', () => {
  assert.deepEqual(labels(ctx({ daysRest: 0, isB2b: true }), true), ['Back-to-back'])
  assert.deepEqual(labels(ctx({ daysRest: 0, isB2b: true, is3In4: true, is4In6: true }), true), ['Back-to-back', '3 in 4 nights'])
  assert.deepEqual(labels(ctx({ is4In6: true }), true), ['4 in 6 nights'])
})

test('rested starts at 3 days off; rest edge starts at +2 and only shows on the more rested team', () => {
  assert.deepEqual(labels(ctx({ daysRest: 2 }), true), [])
  assert.deepEqual(labels(ctx({ daysRest: 3 }), true), ['Rested · 3 days'])
  assert.deepEqual(labels(ctx({ restEdge: 1 }), true), [])
  assert.deepEqual(labels(ctx({ restEdge: 2 }), true), ['Rest edge +2'])
  assert.deepEqual(labels(ctx({ restEdge: -2 }), true), []) // the opponent carries the chip
  assert.deepEqual(labels(ctx({ daysRest: 4, restEdge: 3 }), false), ['Rested · 4 days', 'Rest edge +3'])
})

test('road trip shows for the away team only, from its 3rd game of the trip', () => {
  assert.deepEqual(labels(ctx({ stintGame: 2 }), false), [])
  assert.deepEqual(labels(ctx({ stintGame: 3 }), false), ['Road trip · game 3'])
  assert.deepEqual(labels(ctx({ stintGame: 5 }), true), []) // a homestand is not a road trip
})

test('every chip has a unique key within a team and the warn tone only marks the tiring ones', () => {
  const all = chipsFor(ctx({ daysRest: 0, isB2b: true, is3In4: true, is4In6: true, stintGame: 4, restEdge: 2 }), false)
  assert.equal(new Set(all.map((c) => c.key)).size, all.length)
  assert.deepEqual(all.filter((c) => c.tone === 'warn').map((c) => c.key), ['b2b', 'crowded'])
})

test('only real calendar dates written YYYY-MM-DD are accepted by the server', () => {
  for (const ok of ['2026-11-14', '2028-02-29']) assert.equal(validDate(ok), true)
  for (const bad of ['2026-02-30', '2026-13-01', '2026-1-1', '11/14/2026', '2026-11-14; DROP', '', undefined, null, 20261114]) assert.equal(validDate(bad), false)
})

test('a played game has numbers and a winner; a game to come has none', () => {
  assert.deepEqual(mapSlateGame(final), {
    id: '0022600240', date: '2026-11-13', home: 'CHI', away: 'ATL', homeName: 'Chicago Bulls', awayName: 'Atlanta Hawks',
    homePts: 125, awayPts: 117, isFinal: true, homeWon: true, homeContext: null, awayContext: null,
  })
  const g = mapSlateGame(future)
  assert.deepEqual([g.homePts, g.awayPts, g.isFinal, g.homeWon], [null, null, false, null])
  assert.deepEqual(mapSlate([final, future]).games.map((x) => x.id), ['0022600240', '0022600244'])
  assert.deepEqual(mapSlate([]), { games: [] })
})

test('the page client checks dates the same way', () => {
  assert.equal(isIsoDate('2026-11-14'), true)
  assert.equal(isIsoDate('2026-02-30'), false)
  assert.equal(isIsoDate('nope'), false)
})

test('shiftDate moves by calendar days across month, year and leap-day edges', () => {
  assert.equal(shiftDate('2026-11-14', 1), '2026-11-15')
  assert.equal(shiftDate('2026-11-30', 1), '2026-12-01')
  assert.equal(shiftDate('2026-12-31', 1), '2027-01-01')
  assert.equal(shiftDate('2028-03-01', -1), '2028-02-29')
  assert.equal(shiftDate('2026-11-07', 0), '2026-11-07') // the day clocks change in the US: no skipped or repeated day
  assert.equal(shiftDate('2026-11-01', 1), '2026-11-02')
})

test('"today" is the US Eastern date, whatever the viewer\'s own clock says', () => {
  // 03:30 UTC on Nov 15 is still the evening of Nov 14 in New York (EST, UTC-5).
  assert.equal(easternDate(new Date('2026-11-15T03:30:00Z')), '2026-11-14')
  assert.equal(easternDate(new Date('2026-11-15T05:30:00Z')), '2026-11-15')
  // In summer time (EDT, UTC-4) the switch is an hour earlier.
  assert.equal(easternDate(new Date('2026-07-15T03:59:00Z')), '2026-07-14')
  assert.equal(easternDate(new Date('2026-07-15T04:00:00Z')), '2026-07-15')
})

test('the heading names yesterday, today and tomorrow, and shows plain dates otherwise', () => {
  assert.equal(dateHeading('2026-11-14', '2026-11-14'), 'Today · Sat, Nov 14')
  assert.equal(dateHeading('2026-11-13', '2026-11-14'), 'Yesterday · Fri, Nov 13')
  assert.equal(dateHeading('2026-11-15', '2026-11-14'), 'Tomorrow · Sun, Nov 15')
  assert.equal(dateHeading('2026-11-20', '2026-11-14'), 'Fri, Nov 20')
})

test('status and winner follow the final flag, never the scores alone', () => {
  const played = mapSlateGame(final)
  const toCome = mapSlateGame(future)
  assert.equal(gameStatus(played), 'Final')
  assert.equal(winner(played), 'home')
  assert.equal(winner({ ...played, homeWon: false }), 'away')
  assert.equal(gameStatus(toCome), 'Not played yet')
  assert.equal(winner(toCome), null)
  assert.equal(gameStatus({ ...played, homePts: null }), 'Not played yet') // a final game missing a score is not shown as final
})

test('the empty message names the game type and the day', () => {
  assert.match(emptyText('2026-11-20', '2026-11-14', true), /^No regular-season games on Fri, Nov 20\./)
  assert.match(emptyText('2026-11-14', '2026-11-14', false), /^No playoff games on Sat, Nov 14\./)
})

test('an empty address opens Today\'s games; "#/teams" and "#/players" still open their own pages', () => {
  assert.equal(pageFromHash('#/today'), 'today')
  assert.equal(hashFor('today', ''), '#/today')
  assert.equal(parseHash('#/today').team, '')
  assert.equal(pageFromHash(''), 'today')
  assert.equal(pageFromHash('#/players?team=BOS'), 'players')
  assert.deepEqual(parseHash('#/teams?team=BOS'), { page: 'teams', team: 'BOS' })
  assert.equal(pageFromHash('#/todayy'), 'today')
})
