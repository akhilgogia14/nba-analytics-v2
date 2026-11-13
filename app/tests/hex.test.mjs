import test from 'node:test'
import assert from 'node:assert/strict'
import {
  BINS, CARD_BASE, COLUMNS, LOW_VS_MISSED, MISSED, REGULAR_SEASON_GAMES, RING_CONTRAST, TOP_CONTRAST, binFor, buildCells, chartPalette, chroma, hexLayout, hexPoints, hexTip, hitMean,
  lightenToContrast, playedSummary, seasonMean, valueRange,
} from '../src/lib/hex.ts'
import { TEAM_STYLES, contrast, luminance } from '../src/lib/teams.ts'
import { blend } from '../src/lib/teamTheme.ts'

// A made-up 6-game team season. Rebounds by game: 4, (missed), 8, 12, (missed), 6. He played 4 of 6.
const game = (n, played, reb, over = {}) => ({
  id: `g${n}`, n, date: `2026-11-0${n}`, opp: 'BOS', isHome: n % 2 === 0, played, minutes: played ? 30 : null,
  stats: { pts: played ? reb * 2 : null, reb: played ? reb : null, ast: null, fg3m: null, blk: null, stl: null }, ...over,
})
const grid = (over = {}) => ({
  gameType: 'regular-season', seasonLabel: '2026-27', teamId: '1', team: 'NYK', otherTeams: null, teamGames: 6,
  games: [game(1, true, 4), game(2, false), game(3, true, 8), game(4, true, 12), game(5, false), game(6, true, 6)], ...over,
})

test('hexLayout: 14 per row, odd rows shifted half a hexagon, size fits all of them', () => {
  const r = 20
  const w = Math.sqrt(3) * r
  const L = hexLayout(82)
  assert.equal(L.cells.length, 82)
  assert.equal(COLUMNS, 14)
  assert.ok(Math.abs(L.cells[0].cx - w / 2) < 1e-9 && L.cells[0].cy === r)
  assert.ok(Math.abs(L.cells[1].cx - L.cells[0].cx - w) < 1e-9) // next hexagon in the row
  assert.ok(Math.abs(L.cells[14].cx - L.cells[0].cx - w / 2) < 1e-9) // row 2 is shifted
  assert.ok(Math.abs(L.cells[28].cx - L.cells[0].cx) < 1e-9) // row 3 is not
  assert.equal(L.cells[14].cy, r + 1.5 * r)
  // 82 hexagons = 6 rows (5 full + 12): height = 5 * 1.5r + 2r
  assert.ok(Math.abs(L.height - (5 * 1.5 * r + 2 * r)) < 1e-9)
  for (const c of L.cells) assert.ok(c.cx + w / 2 <= L.width + 1e-9 && c.cx - w / 2 >= -1e-9 && c.cy + r <= L.height + 1e-9)
  assert.equal(hexLayout(0).height, 0)
})

test('hexPoints: six corners, all one radius from the centre, pointy at the top', () => {
  const pts = hexPoints(100, 50, 20).split(' ').map((p) => p.split(',').map(Number))
  assert.equal(pts.length, 6)
  for (const [x, y] of pts) assert.ok(Math.abs(Math.hypot(x - 100, y - 50) - 20) < 0.02)
  const ys = pts.map((p) => p[1])
  assert.ok(Math.abs(Math.min(...ys) - 30) < 0.02 && Math.abs(Math.max(...ys) - 70) < 0.02) // top and bottom corners
})

test('seasonMean and valueRange use only the games he played', () => {
  const g = [grid()]
  assert.equal(seasonMean(g, 'reb'), 7.5) // (4 + 8 + 12 + 6) / 4
  assert.deepEqual(valueRange(g, 'reb'), { min: 4, max: 12 })
  assert.equal(seasonMean(g, 'ast'), null) // no values
  assert.equal(valueRange(g, 'ast'), null)
  assert.equal(seasonMean([grid({ games: [game(1, false)] })], 'reb'), null)
})

test('a traded player: the mean and the colour range cover both teams', () => {
  const a = grid({ teamId: '1', team: 'AAA', games: [game(1, true, 2), game(2, false)] })
  const b = grid({ teamId: '2', team: 'BBB', games: [game(1, false), game(2, true, 10)] })
  assert.equal(seasonMean([a, b], 'reb'), 6)
  assert.deepEqual(valueRange([a, b], 'reb'), { min: 2, max: 10 })
})

test('binFor: five steps from his lowest to his highest game; all-equal games use the middle step', () => {
  assert.equal(BINS, 5)
  assert.deepEqual([4, 5, 6, 7, 8, 9, 10, 11, 12].map((v) => binFor(v, 4, 12)), [0, 0, 1, 1, 2, 3, 3, 4, 4]) // (v-4)/8*5 rounded down: 0, .6, 1.3, 1.9, 2.5, 3.1, 3.8, 4.4, 5 (capped)
  assert.equal(binFor(4, 4, 12), 0)
  assert.equal(binFor(12, 4, 12), 4) // the maximum is the top step, not one past it
  assert.equal(binFor(0, 0, 0), 2)
  assert.equal(binFor(3, 4, 12), 0) // out of range stays inside 0..4
})

test('chroma: white, grey and black have none; saturated colours have a lot', () => {
  for (const c of ['#ffffff', '#000000', '#808080', '#C4CED4']) assert.ok(chroma(c) < 0.12, c)
  for (const c of ['#006BB6', '#CE1141', '#552583', '#F58426']) assert.ok(chroma(c) > 0.3, c)
  assert.equal(chroma('#ff0000'), 1)
})

test('lightenToContrast: untouched if already enough; otherwise white mixed in only as needed', () => {
  assert.equal(lightenToContrast('#ffffff', CARD_BASE, 6), '#ffffff')
  assert.equal(lightenToContrast('#5eead4', CARD_BASE, 6), '#5eead4') // already bright enough
  const dark = lightenToContrast('#1d1160', CARD_BASE, 6) // a deep navy-purple
  assert.ok(contrast(dark, CARD_BASE) >= 6)
  assert.ok(contrast(blend('#ffffff', '#1d1160', 0.02 * Math.max(0, Math.round(((parseInt(dark.slice(1, 3), 16) - 0x1d) / (255 - 0x1d)) * 50) - 1)), CARD_BASE) < 6) // one notch less would not have been enough
  assert.equal(blend('#ffffff', '#000000', 0.5), '#808080') // hand-worked: half white over black
  assert.ok(contrast(lightenToContrast('#000000', CARD_BASE, 4.5), CARD_BASE) >= 4.5)
})

test('chartPalette: Knicks fills come from their blue and the ring from their orange', () => {
  const p = chartPalette('NYK')
  assert.equal(p.ramp.length, BINS)
  for (const c of [...p.ramp, p.ring, p.top]) assert.match(c, /^#[0-9a-f]{6}$/)
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(p.top.slice(i, i + 2), 16))
  assert.ok(b > r, 'the top fill is blue-ish') // #006BB6 lightened is still bluer than it is red
  const [rr, , rb] = [1, 3, 5].map((i) => parseInt(p.ring.slice(i, i + 2), 16))
  assert.ok(rr > rb, 'the ring is orange-ish')
  assert.equal(p.ramp[BINS - 1], p.top)
  void g
})

test('chartPalette: a white or silver primary hands the fills to the secondary colour; two plain colours give a white ring', () => {
  // Brooklyn is white and black, San Antonio silver and black: no colour at all, so the ring is white
  for (const t of ['BKN', 'SAS']) assert.equal(chartPalette(t).ring, '#ffffff')
  // ...and the fills run up to the LIGHT colour (white or silver), never to a lightened black
  for (const t of ['BKN', 'SAS']) assert.ok(luminance(chartPalette(t).top) > 0.5, `${t} top is light`)
  // Houston is silver and red: the red (the only real colour) drives the fills, so they are red-ish
  const hou = chartPalette('HOU').top
  const [r, g] = [1, 3].map((i) => parseInt(hou.slice(i, i + 2), 16))
  assert.ok(r > g, 'Houston fills are red-ish')
  // an unknown team gets the page's own teal accent
  assert.equal(chartPalette('ZZZ').top, '#5eead4')
  assert.equal(chartPalette(null).top, '#5eead4')
})

test('chartPalette, all 30 teams: steps get lighter, the darkest is clearly not the missed-game grey, the top and the ring show on the card', () => {
  const teams = Object.keys(TEAM_STYLES)
  assert.equal(teams.length, 30)
  for (const t of teams) {
    const p = chartPalette(t)
    for (let i = 1; i < p.ramp.length; i++) assert.ok(luminance(p.ramp[i]) > luminance(p.ramp[i - 1]), `${t}: step ${i} lighter than step ${i - 1}`)
    assert.ok(contrast(p.ramp[0], MISSED.fill) >= LOW_VS_MISSED - 0.01, `${t}: darkest step vs a missed game = ${contrast(p.ramp[0], MISSED.fill).toFixed(2)}`)
    assert.ok(contrast(p.top, CARD_BASE) >= TOP_CONTRAST - 0.01, `${t}: top vs card`)
    assert.ok(contrast(p.ring, CARD_BASE) >= RING_CONTRAST - 0.01, `${t}: ring vs card = ${contrast(p.ring, CARD_BASE).toFixed(2)}`)
    for (let i = 1; i < p.ramp.length; i++) assert.ok(contrast(p.ramp[i], p.ramp[i - 1]) >= 1.1, `${t}: neighbouring steps can be told apart`)
  }
})

test('hitMean: at or above the mean counts; nothing counts without a value or a mean', () => {
  assert.equal(hitMean(8, 7.5), true)
  assert.equal(hitMean(7.5, 7.5), true)
  assert.equal(hitMean(7, 7.5), false)
  assert.equal(hitMean(null, 7.5), false)
  assert.equal(hitMean(8, null), false)
  assert.equal(hitMean(0, 0), true) // a stat he never gets: 0 reaches a mean of 0
})

test('buildCells: played, missed and (regular season) upcoming slots up to 82, in date order', () => {
  const g = grid()
  const cells = buildCells(g, 'reb', [g])
  assert.equal(cells.length, REGULAR_SEASON_GAMES)
  assert.deepEqual(cells.slice(0, 6).map((c) => c.kind), ['played', 'missed', 'played', 'played', 'missed', 'played'])
  assert.ok(cells.slice(6).every((c) => c.kind === 'upcoming' && c.game === null))
  assert.deepEqual(cells.slice(0, 6).map((c) => c.value), [4, null, 8, 12, null, 6])
  assert.deepEqual(cells.slice(0, 6).map((c) => c.hit), [false, false, true, true, false, false]) // mean 7.5
  assert.deepEqual(cells.slice(0, 6).map((c) => c.bin), [0, 0, 2, 4, 0, 1]) // 4,8,12,6 over 4..12 = bins 0,2,4,1
  // a missed game is never "hit" and has no value
  assert.ok(cells[1].game && !cells[1].hit && cells[1].value === null)
})

test('buildCells: a full season and the playoffs get no empty slots', () => {
  const full = grid({ teamGames: 82, games: Array.from({ length: 82 }, (_, i) => game(i + 1, i % 2 === 0, 5, { date: '2026-11-01' })) })
  assert.equal(buildCells(full, 'reb', [full]).length, 82)
  const po = grid({ gameType: 'playoffs', teamGames: 3, games: [game(1, true, 5), game(2, false), game(3, true, 9)] })
  const cells = buildCells(po, 'reb', [po])
  assert.equal(cells.length, 3)
  assert.ok(cells.every((c) => c.kind !== 'upcoming'))
})

test('buildCells: a played game with no value for the stat is a gap, never a zero', () => {
  const g = grid()
  const cells = buildCells(g, 'ast', [g]) // no assist figures at all
  assert.deepEqual(cells.slice(0, 6).map((c) => c.kind), ['gap', 'missed', 'gap', 'gap', 'missed', 'gap'])
  assert.ok(cells.slice(0, 6).every((c) => c.value === null && !c.hit))
})

test('hexTip: value and opponent on top, date, home or away and the mean underneath', () => {
  const g = grid()
  const cells = buildCells(g, 'reb', [g])
  const home = hexTip(cells[3], 'reb', 7.5) // game 4: 12 rebounds, home, at or above the mean
  assert.equal(home.title, '12 REB ✓ · vs BOS')
  assert.equal(home.detail, 'Nov 4 · home · season average 7.5')
  assert.match(home.label, /^12 rebounds, vs BOS\. Nov 4 · home · season average 7\.5\. At or above his season average\.$/)
  const away = hexTip(cells[0], 'reb', 7.5) // game 1: 4 rebounds, away, below
  assert.equal(away.title, '4 REB · @ BOS')
  assert.equal(away.detail, 'Nov 1 · away · season average 7.5')
  assert.match(away.label, /Below his season average\.$/)
  const missed = hexTip(cells[1], 'reb', 7.5)
  assert.equal(missed.title, 'Did not play · vs BOS')
  assert.equal(missed.detail, 'Nov 2 · home')
  assert.equal(hexTip(cells[10], 'reb', 7.5), null) // an upcoming slot has no tip
  assert.equal(hexTip(buildCells(g, 'ast', [g])[0], 'ast', null).title, 'No AST figure · @ BOS')
})

test('playedSummary counts the games he played against the team games', () => {
  assert.deepEqual(playedSummary(grid()), { played: 4, total: 6 })
})
