import assert from 'node:assert/strict'
import test from 'node:test'
import { LOG_COLUMNS, LOG_VIEWS, averageRow, logNote } from '../src/lib/gamelog.ts'

const game = (id, pts, over = {}) => ({
  id, date: '2026-11-11', opp: 'CLE', isHome: true, seasonLabel: '2026-27', minutes: 30,
  stats: { pts, reb: 4, ast: 6, fg3m: 2, blk: 0, stl: 1 }, ...over,
})

test('the view switch has box scores first (the page default) and averages', () => {
  assert.deepEqual(LOG_VIEWS.map((v) => v.key), ['log', 'cards'])
  assert.deepEqual(LOG_COLUMNS.map(([, l]) => l), ['PTS', 'REB', 'AST', '3PM', 'BLK', 'STL'])
})

test('averageRow: mean of each column to one decimal', () => {
  const avg = averageRow([game('a', 20, { minutes: 30 }), game('b', 25, { minutes: 35 }), game('c', 28, { minutes: 33 })])
  assert.equal(avg.stats.pts, 24.3) // 73 / 3
  assert.equal(avg.minutes, 32.7) // 98 / 3
  assert.equal(avg.stats.reb, 4)
})

test('averageRow: a missing figure is skipped, not counted as zero; all missing is null', () => {
  const avg = averageRow([game('a', 20), game('b', null, { minutes: null }), game('c', 30)])
  assert.equal(avg.stats.pts, 25)
  assert.equal(avg.minutes, 30)
  assert.deepEqual(averageRow([game('a', null, { minutes: null })]).stats.pts, null)
  assert.equal(averageRow([]).stats.pts, null)
})

test('averageRow equals the card number for the same games (first 10 of 15 average like the card)', () => {
  const games = Array.from({ length: 10 }, (_, i) => game(`g${i}`, 20 + i))
  assert.equal(averageRow(games).stats.pts, 24.5)
})

test('logNote: counts the games, says newest first and any opponent, and names the seasons when it spans two', () => {
  assert.equal(logNote([game('a', 1), game('b', 2)], 'games'), 'His last 2 games played, newest first, against any opponent.')
  assert.equal(
    logNote([game('a', 1), game('b', 2, { seasonLabel: '2025-26' })], 'playoff games'),
    'His last 2 playoff games played, newest first, against any opponent, from 2025-26 to 2026-27.',
  )
  assert.equal(logNote([], 'playoff games'), 'No playoff games on record for this player.')
})
