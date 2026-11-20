import test from 'node:test'
import assert from 'node:assert/strict'
import { dateWithYear } from '../src/lib/format.ts'
import { meetingGames, meetingsWindowLabel, percentile, sparkFromMeeting, statFromGames } from '../src/lib/oppCards.ts'

test('percentile interpolates linearly between the two nearest games, like the warehouse', () => {
  assert.equal(percentile([1, 2, 3, 4], 0.5), 2.5)
  assert.ok(Math.abs(percentile([1, 2, 3, 4], 0.1) - 1.3) < 1e-9)
  assert.ok(Math.abs(percentile([1, 2, 3, 4], 0.9) - 3.7) < 1e-9)
  assert.equal(percentile([7], 0.9), 7)
  assert.equal(percentile([10, 20], 0), 10)
  assert.equal(percentile([10, 20], 1), 20)
  const ten = [19, 22, 25, 27, 28, 29, 30, 31, 33, 38] // ten games
  assert.equal(percentile(ten, 0.5), 28.5)
  assert.ok(Math.abs(percentile(ten, 0.1) - 21.7) < 1e-9)
})

test('the card summary: mean, median, middle 80%, lowest, highest, with the season mean passed through', () => {
  const s = statFromGames([30, 20, 25, 35], 'pts', 24.5)
  assert.deepEqual([s.mean, s.median, s.min, s.max, s.seasonMean], [27.5, 27.5, 20, 35, 24.5])
  assert.ok(Math.abs(s.p10 - 21.5) < 1e-9)
  assert.ok(Math.abs(s.p90 - 33.5) < 1e-9)
  assert.equal(s.shares, null) // points have no share strip
})

test('missing values are left out, and no games gives no card', () => {
  const s = statFromGames([10, null, 20, undefined], 'reb', null)
  assert.deepEqual([s.mean, s.min, s.max], [15, 10, 20])
  assert.equal(statFromGames([], 'pts', 20), null)
  assert.equal(statFromGames([null, null], 'pts', 20), null)
})

test('3-pointers, blocks and steals get the 0 / 1 / 2 / 3+ shares, which add up to one', () => {
  const s = statFromGames([0, 0, 1, 2, 3, 5], 'fg3m', 2)
  assert.deepEqual(s.shares, [2 / 6, 1 / 6, 1 / 6, 2 / 6])
  assert.ok(Math.abs(s.shares.reduce((a, b) => a + b, 0) - 1) < 1e-9)
  for (const k of ['fg3m', 'blk', 'stl']) assert.ok(statFromGames([1], k, null).shares)
  for (const k of ['pts', 'reb', 'ast']) assert.equal(statFromGames([1], k, null).shares, null)
})

test('one game is a valid, flat summary', () => {
  const s = statFromGames([22], 'pts', 20)
  assert.deepEqual([s.mean, s.median, s.p10, s.p90, s.min, s.max], [22, 22, 22, 22, 22, 22])
})

test('meetings are turned oldest first for the sparkline, and the label says how many', () => {
  const games = [{ id: 'new', date: '2026-11-01', team: 'CHA', opp: 'ATL', isHome: true, seasonLabel: '2026-27', minutes: 30, stats: { pts: 20 }, kind: 'this' }, { id: 'old', date: '2025-02-01', team: 'CHA', opp: 'ATL', isHome: false, seasonLabel: '2024-25', minutes: 28, stats: { pts: 10 }, kind: 'earlier' }]
  assert.deepEqual(meetingGames({ scope: 'filled', currentSeason: '2026-27', games }).map((g) => g.id), ['old', 'new'])
  assert.deepEqual(meetingGames(null), [])
  assert.deepEqual(sparkFromMeeting(games[0]), { id: 'new', date: '2026-11-01', opp: 'ATL', isHome: true, stats: { pts: 20 } })
  assert.equal(meetingsWindowLabel(8, 'ATL'), 'avg of last 8 meetings vs ATL')
  assert.equal(meetingsWindowLabel(1, 'ATL'), 'avg of his only meeting vs ATL')
})

test('a date that spans seasons is written with its year', () => {
  assert.equal(dateWithYear('2024-10-25'), 'Oct 25, 2024')
  assert.equal(dateWithYear('2026-11-01'), 'Nov 1, 2026')
  assert.equal(dateWithYear('nope'), 'nope')
})
