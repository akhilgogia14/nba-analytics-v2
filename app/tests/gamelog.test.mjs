import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_VIEW, LOG_COLUMNS, LOG_VIEWS, SPLITS, averageRow, logNote, madeAtt, mean, signed, splitValue } from '../src/lib/gamelog.ts'

const game = (id, pts, over = {}, box = {}) => ({
  id, date: '2026-11-11', opp: 'CLE', isHome: true, seasonLabel: '2026-27', minutes: 30,
  stats: { pts, reb: 4, ast: 6, fg3m: 2, blk: 0, stl: 1 },
  box: { started: true, fgm: 8, fga: 16, fg3a: 5, ftm: 2, fta: 2, oreb: 1, dreb: 3, tov: 2, pf: 3, plusMinus: 5, ...box },
  ...over,
})

test('the view switch has averages first (the page default) and box scores', () => {
  assert.deepEqual(LOG_VIEWS.map((v) => v.key), ['cards', 'log'])
  assert.deepEqual(LOG_VIEWS.map((v) => v.label), ['Averages', 'Box scores'])
  assert.equal(DEFAULT_VIEW, 'cards')
  assert.deepEqual(LOG_COLUMNS.map(([, l]) => l), ['REB', 'AST', 'STL', 'BLK'])
  assert.deepEqual(SPLITS.map(([, , l]) => l), ['FG', '3P', 'FT'])
})

test('madeAtt and signed: made-attempted, a dash for a gap, plus/minus with its sign', () => {
  assert.equal(madeAtt(7, 15), '7-15')
  assert.equal(madeAtt(0, 0), '0-0')
  assert.equal(madeAtt(null, 15), '–')
  assert.equal(signed(5), '+5')
  assert.equal(signed(-20), '-20')
  assert.equal(signed(0), '0')
  assert.equal(signed(null), '–')
})

test('splitValue: threes made come from the six stats, the other shooting numbers from the fuller box score', () => {
  const g = game('a', 20)
  assert.equal(splitValue(g, 'fg3m'), 2)
  assert.equal(splitValue(g, 'fga'), 16)
  assert.equal(splitValue(g, 'fta'), 2)
})

test('mean: to one decimal, a gap is skipped, all gaps is null', () => {
  assert.equal(mean([20, 25, 28]), 24.3)
  assert.equal(mean([20, null, 30]), 25)
  assert.equal(mean([null]), null)
  assert.equal(mean([]), null)
})

test('averageRow: every column, makes and attempts averaged separately, plus the number of starts', () => {
  const avg = averageRow([
    game('a', 20, {}, { fgm: 7, fga: 15, plusMinus: -6 }),
    game('b', 25, { minutes: 36 }, { fgm: 9, fga: 18, started: false, plusMinus: 10 }),
    game('c', 28, {}, { fgm: 8, fga: 17, plusMinus: 2 }),
  ])
  assert.equal(avg.pts, 24.3)
  assert.equal(avg.minutes, 32)
  assert.equal(avg.splits[0], '8-16.7') // 24/3 and 50/3
  assert.equal(avg.splits[1], '2-5') // threes made 2 and attempted 5 in every game
  assert.equal(avg.plusMinus, 2) // (-6 + 10 + 2) / 3
  assert.equal(avg.started, 2)
  assert.equal(avg.stats.reb, 4)
  assert.equal(avg.tov, 2)
  assert.equal('oreb' in avg || 'dreb' in avg, false) // the offensive/defensive split is not shown
})

test('averageRow: a missing figure is skipped, not counted as zero', () => {
  const avg = averageRow([game('a', 20, {}, { tov: null, plusMinus: null }), game('b', null, { minutes: null }, { tov: 4, plusMinus: null })])
  assert.equal(avg.pts, 20)
  assert.equal(avg.minutes, 30)
  assert.equal(avg.tov, 4)
  assert.equal(avg.plusMinus, null)
  assert.equal(averageRow([]).pts, null)
})

test('averageRow equals the card number for the same games (the first 10 average like the card)', () => {
  const games = Array.from({ length: 10 }, (_, i) => game(`g${i}`, 20 + i))
  assert.equal(averageRow(games).pts, 24.5)
})

test('logNote: counts the games, says newest first and any opponent, and names the seasons when it spans two', () => {
  assert.equal(logNote([game('a', 1), game('b', 2)], 'games'), 'His last 2 games played, newest first, against any opponent.')
  assert.equal(
    logNote([game('a', 1), game('b', 2, { seasonLabel: '2025-26' })], 'playoff games'),
    'His last 2 playoff games played, newest first, against any opponent, from 2025-26 to 2026-27.',
  )
  assert.equal(logNote([], 'playoff games'), 'No playoff games on record for this player.')
})
