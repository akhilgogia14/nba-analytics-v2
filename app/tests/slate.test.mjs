import test from 'node:test'
import assert from 'node:assert/strict'
import { SLATE_SQL, mapSlate, mapSlateGame, validDate } from '../server/slateQueries.mjs'
import { dateHeading, easternDate, emptyText, gameStatus, isIsoDate, shiftDate, winner } from '../src/lib/slate.ts'
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

test('only real calendar dates written YYYY-MM-DD are accepted by the server', () => {
  for (const ok of ['2026-11-14', '2028-02-29']) assert.equal(validDate(ok), true)
  for (const bad of ['2026-02-30', '2026-13-01', '2026-1-1', '11/14/2026', '2026-11-14; DROP', '', undefined, null, 20261114]) assert.equal(validDate(bad), false)
})

test('a played game has numbers and a winner; a game to come has none', () => {
  assert.deepEqual(mapSlateGame(final), {
    id: '0022600240', date: '2026-11-13', home: 'CHI', away: 'ATL', homeName: 'Chicago Bulls', awayName: 'Atlanta Hawks',
    homePts: 125, awayPts: 117, isFinal: true, homeWon: true,
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

test('"#/today" opens Today\'s games; every other address still works as before', () => {
  assert.equal(pageFromHash('#/today'), 'today')
  assert.equal(hashFor('today', ''), '#/today')
  assert.equal(parseHash('#/today').team, '')
  assert.equal(pageFromHash(''), 'teams')
  assert.equal(pageFromHash('#/players?team=BOS'), 'players')
  assert.deepEqual(parseHash('#/teams?team=BOS'), { page: 'teams', team: 'BOS' })
  assert.equal(pageFromHash('#/todayy'), 'teams')
})
