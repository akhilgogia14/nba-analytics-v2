import test from 'node:test'
import assert from 'node:assert/strict'
import { SPARK_H, SPARK_PAD, SPARK_W, changeVsSeason, sparkLayout, sparkTip } from '../src/lib/spark.ts'

const game = (id, pts, over = {}) => ({
  id, date: '2026-10-21', opp: 'GSW', isHome: true, seasonLabel: '2026-27', minutes: 30,
  stats: { pts, reb: 5, ast: 3, fg3m: 1, blk: 0, stl: 1 }, ...over,
})

test('box constants: 300 wide, 56 tall, 8 pad', () => {
  assert.deepEqual([SPARK_W, SPARK_H, SPARK_PAD], [300, 56, 8])
})

test('sparkLayout: three games 10, 20, 30 with a season average of 20 (hand-worked)', () => {
  // inner height 56 - 16 = 40 over the range 10..30: y = 8 + (30 - v) / 20 * 40, so 10 -> 48, 20 -> 28, 30 -> 8
  // x runs 8 .. 292 in three steps: 8, 150, 292
  const L = sparkLayout([game('a', 10), game('b', 20), game('c', 30)], 'pts', 20)
  assert.deepEqual(L.points.map((p) => [p.x, p.y, p.value]), [[8, 48, 10], [150, 28, 20], [292, 8, 30]])
  assert.equal(L.baseline, 28)
  assert.equal(L.line, 'M8,48 L150,28 L292,8')
  assert.equal(L.area, 'M8,48 L150,28 L292,8 L292,56 L8,56 Z')
})

test('sparkLayout: the scale includes the season average, so its dashed line is always inside the box', () => {
  // values 20 and 22, average 30: range 20..30 -> y(22) = 8 + 8/10 * 40 = 40, y(20) = 48, baseline y(30) = 8
  const L = sparkLayout([game('a', 20), game('b', 22)], 'pts', 30)
  assert.deepEqual(L.points.map((p) => p.y), [48, 40])
  assert.equal(L.baseline, 8)
  for (const p of L.points) assert.ok(p.y >= SPARK_PAD && p.y <= SPARK_H - SPARK_PAD)
})

test('sparkLayout: no season average means no dashed line; all-equal values run flat through the middle', () => {
  const L = sparkLayout([game('a', 5), game('b', 5), game('c', 5)], 'pts', null)
  assert.equal(L.baseline, null)
  assert.deepEqual(L.points.map((p) => p.y), [28, 28, 28])
  assert.equal(sparkLayout([game('a', 5), game('b', 5)], 'pts', 5).baseline, 28) // equal to the average: flat too
})

test('sparkLayout: one game sits in the middle; a game with no figure is left out; none gives an empty line', () => {
  assert.equal(sparkLayout([game('a', 12)], 'pts', null).points[0].x, 150)
  const gap = sparkLayout([game('a', 10), game('b', null), game('c', 30)], 'pts', null)
  assert.deepEqual(gap.points.map((p) => [p.x, p.value]), [[8, 10], [292, 30]]) // two points share the full width
  const none = sparkLayout([], 'pts', 12)
  assert.deepEqual([none.points.length, none.line, none.area], [0, '', ''])
})

test('sparkLayout reads the stat asked for', () => {
  const L = sparkLayout([game('a', 10), game('b', 20)], 'reb', null) // rebounds are 5 in both games
  assert.deepEqual(L.points.map((p) => p.value), [5, 5])
})

test('changeVsSeason: arrows, one decimal, "level" when the difference rounds to zero, nothing without both numbers', () => {
  assert.deepEqual(changeVsSeason(26.5, 26.0), { dir: 'up', text: '↑ 0.5 vs season avg' })
  assert.deepEqual(changeVsSeason(25.0, 26.0), { dir: 'down', text: '↓ 1.0 vs season avg' })
  assert.deepEqual(changeVsSeason(26.04, 26.0), { dir: 'flat', text: 'level with season avg' })
  assert.deepEqual(changeVsSeason(2.8, 2.636), { dir: 'up', text: '↑ 0.2 vs season avg' }) // 0.164 rounds to 0.2
  assert.equal(changeVsSeason(26.5, null), null) // playoffs: no season average yet
  assert.equal(changeVsSeason(null, 26), null)
})

test('sparkTip: the number and opponent on top, date and home or away underneath', () => {
  const home = sparkTip(game('a', 28), 'pts', 28)
  assert.equal(home.title, '28 PTS · vs GSW')
  assert.equal(home.detail, 'Oct 21 · home')
  assert.equal(home.label, '28 points, vs GSW. Oct 21 · home.')
  const away = sparkTip(game('b', 8, { isHome: false, opp: 'LAC', date: '2026-10-28' }), 'reb', 8)
  assert.equal(away.title, '8 REB · @ LAC')
  assert.equal(away.detail, 'Oct 28 · away')
})

test('sparkLayout: the league average gets its own dotted line and the scale includes it', () => {
  // values 20 and 22, season average 21, league average 30: range 20..30 -> league line y(30) = 8, y(20) = 48, y(22) = 40
  const L = sparkLayout([game('a', 20), game('b', 22)], 'pts', 21, 30)
  assert.equal(L.leagueBaseline, 8)
  assert.deepEqual(L.points.map((p) => p.y), [48, 40])
  assert.equal(L.baseline, 44)
  // without a league figure there is no line, and the layout is what it was before
  assert.equal(sparkLayout([game('a', 20), game('b', 22)], 'pts', 21).leagueBaseline, null)
  assert.deepEqual(sparkLayout([game('a', 20), game('b', 22)], 'pts', 21, null).points, sparkLayout([game('a', 20), game('b', 22)], 'pts', 21).points)
})
