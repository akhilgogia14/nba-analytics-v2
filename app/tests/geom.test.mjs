import test from 'node:test'
import assert from 'node:assert/strict'
import { complete, f1, geometry, shareSegments } from '../src/lib/geom.ts'
import { daysSince, shortDate, teamLabel } from '../src/lib/format.ts'

const near = (actual, expected, msg) => assert.ok(Math.abs(actual - expected) < 0.01, `${msg}: ${actual} vs ${expected}`)

test('f1 rounds to one decimal and never shows -0.0', () => {
  assert.equal(f1(26.54), '26.5')
  assert.equal(f1(-0.04), '0.0')
  assert.equal(f1(0), '0.0')
  assert.equal(f1(-8.1), '-8.1')
})

test('geometry: Brunson points, worked by hand', () => {
  // bar runs from 0 to 38 * 1.06 = 40.28
  const g = geometry({ mean: 26.5, median: 25.5, p10: 19, p90: 33.5, min: 19, max: 38 })
  near(g.minLeft, (19 / 40.28) * 100, 'minLeft')
  near(g.minWidth, (19 / 40.28) * 100, 'minWidth')
  near(g.bandLeft, (19 / 40.28) * 100, 'bandLeft')
  near(g.bandWidth, (14.5 / 40.28) * 100, 'bandWidth')
  near(g.medianLeft, (25.5 / 40.28) * 100, 'medianLeft')
  near(g.meanLeft, (26.5 / 40.28) * 100, 'meanLeft')
})

test('geometry: a stat that can go below zero keeps 0 on the bar', () => {
  // lo = -9 * 1.06 = -9.54, hi = 32 * 1.06 = 33.92, span 43.46
  const g = geometry({ mean: 8.1, median: 9, p10: -8.1, p90: 30.2, min: -9, max: 32 })
  near(g.minLeft, (0.54 / 43.46) * 100, 'minLeft')
  near(g.bandLeft, (1.44 / 43.46) * 100, 'bandLeft')
  assert.ok(g.minLeft >= 0 && g.minLeft + g.minWidth <= 100)
})

test('geometry: all zeros does not divide by zero', () => {
  const g = geometry({ mean: 0, median: 0, p10: 0, p90: 0, min: 0, max: 0 })
  for (const v of Object.values(g)) assert.ok(Number.isFinite(v) && v >= 0 && v <= 100)
})

test('complete returns null when any number is missing', () => {
  const ok = { mean: 1, median: 1, p10: 0, p90: 2, min: 0, max: 3, seasonMean: null, shares: null }
  assert.deepEqual(complete(ok), { mean: 1, median: 1, p10: 0, p90: 2, min: 0, max: 3 })
  assert.equal(complete({ ...ok, median: null }), null)
  assert.equal(complete(undefined), null)
})

test('shareSegments: labels, order and zero pieces', () => {
  const segs = shareSegments([0.1, 0.2, 0.1, 0.6])
  assert.deepEqual(segs.map((s) => s.text), ['10%', '1 · 20%', '10%', '3+ · 60%'])
  assert.deepEqual(shareSegments([1, 0, 0, 0]).map((s) => [s.key, s.text]), [['0', '0 · 100%']])
  const noZero = shareSegments([0, 0.6, 0.1, 0.3])
  assert.deepEqual(noZero.map((s) => s.index), [1, 2, 3])
  assert.deepEqual(shareSegments(null), [])
})

test('dates and team names', () => {
  assert.equal(shortDate('2026-10-23'), 'Oct 23')
  assert.equal(shortDate('2026-11-01'), 'Nov 1')
  assert.equal(shortDate('not a date'), 'not a date')
  assert.equal(daysSince('2026-11-11', new Date(Date.UTC(2026, 10, 13, 3, 0))), 2)
  assert.equal(daysSince('2026-11-13', new Date(Date.UTC(2026, 10, 13, 23, 0))), 0)
  assert.equal(teamLabel('NYK'), 'New York Knicks (NYK)')
  assert.equal(teamLabel('XXX'), 'XXX')
})
