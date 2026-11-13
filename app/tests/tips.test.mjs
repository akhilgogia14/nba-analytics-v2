import test from 'node:test'
import assert from 'node:assert/strict'
import { ANCHOR_MAX, ANCHOR_MIN, clampAnchor, markTips, shareTips } from '../src/lib/tips.ts'
import { geometry, shareSegments } from '../src/lib/geom.ts'

// Jalen Brunson's points from the live data: 26.5 average, 25.5 median, 19.0 to 33.5 middle 80%, 19.0 to 38.0 range.
const D = { mean: 26.5, median: 25.5, p10: 19, p90: 33.5, min: 19, max: 38 }

test('markTips: four tips with the real numbers and plain words', () => {
  const tips = markTips(D, geometry(D), 10)
  assert.deepEqual(tips.map((t) => t.key), ['mean', 'median', 'band', 'range'])
  assert.equal(tips[0].title, 'Average 26.5')
  assert.equal(tips[0].text, 'All of the last 10 games added up and divided by the number of games.')
  assert.equal(tips[1].title, 'Median 25.5')
  assert.equal(tips[1].text, 'The middle game of the last 10 games: half were above this, half below.')
  assert.equal(tips[2].title, 'Middle 80%: 19.0 to 33.5')
  assert.equal(tips[2].text, 'About 8 of every 10 of the last 10 games landed in this range.')
  assert.equal(tips[3].title, 'Lowest 19.0, highest 38.0')
})

test('markTips: no game count falls back to wording that is still true; never shows -0.0', () => {
  const t = markTips({ mean: -0.04, median: 0, p10: -1, p90: 2, min: -3, max: 4 }, geometry({ mean: -0.04, median: 0, p10: -1, p90: 2, min: -3, max: 4 }), null)
  assert.match(t[0].text, /the recent games/)
  assert.equal(t[0].title, 'Average 0.0')
})

test('anchors sit over their mark and are kept inside the bar', () => {
  const g = geometry(D)
  const tips = markTips(D, g, 10)
  assert.ok(Math.abs(tips[0].left - g.meanLeft) < 1e-9) // the mean is mid-bar, so it is not clamped
  assert.ok(Math.abs(tips[2].left - (g.bandLeft + g.bandWidth / 2)) < 1e-9)
  assert.equal(clampAnchor(-5), ANCHOR_MIN)
  assert.equal(clampAnchor(120), ANCHOR_MAX)
  assert.equal(clampAnchor(50), 50)
  // A stat that is all zeros puts the marks at the very edge: the bubble is still inside the card.
  const zero = { mean: 0, median: 0, p10: 0, p90: 0, min: 0, max: 0 }
  for (const t of markTips(zero, geometry(zero), 10)) assert.ok(t.left >= ANCHOR_MIN && t.left <= ANCHOR_MAX)
})

test('shareTips: one per piece, centred over its piece', () => {
  const segs = shareSegments([0.1, 0.2, 0.1, 0.6])
  const tips = shareTips(segs)
  assert.equal(tips.length, 4)
  assert.equal(tips[0].left, 16) // piece 0..10% -> centre 5%, clamped to the minimum
  assert.ok(Math.abs(tips[1].left - 20) < 1e-9) // piece 10..30% -> centre 20%, clamped up to 16 is not needed
  assert.ok(Math.abs(tips[3].left - 70) < 1e-9) // piece 40..100% -> centre 70%
  assert.equal(tips[3].title, '3+ made: 60% of games')
  assert.deepEqual(shareTips([]), [])
})
