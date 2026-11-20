import assert from 'node:assert/strict'
import test from 'node:test'
import { hashFor, pageFromHash, parseHash, playerFromHash } from '../src/lib/pages.ts'
import { OUTLOOK_STATS, VIEWS, baseline, fmtOutlook, fromMeeting, fromRecent, behindTile, fmtGame, headlineTiles, seasonGames, summarize } from '../src/lib/outlook.ts'

const stats = (o = {}) => ({ pts: 20, reb: 5, ast: 4, fg3m: 2, blk: 0, stl: 1, ...o })
const g = (id, date, o = {}, minutes = 30) => ({ id, date, opp: 'BOS', isHome: true, seasonLabel: '2026-27', values: { ...stats(o), minutes } })

test('seven stats, one decimal for every average, and three views in a fixed order', () => {
  assert.deepEqual(OUTLOOK_STATS.map((s) => s.key), ['pts', 'reb', 'ast', 'fg3m', 'blk', 'stl', 'minutes'])
  assert.deepEqual(OUTLOOK_STATS.map((s) => s.digits), [1, 1, 1, 1, 1, 1, 1])
  assert.deepEqual(VIEWS.map((v) => v.key), ['last10', 'season', 'opponent'])
})

test('summarize gives the lowest, average and highest with the number of games', () => {
  const s = summarize([g('a', '1', { pts: 10 }), g('b', '2', { pts: 20 }), g('c', '3', { pts: 33 })], 'pts')
  assert.deepEqual(s, { n: 3, min: 10, avg: 21, max: 33 })
  assert.equal(summarize([g('a', '1', { blk: 0 })], 'blk').avg, 0) // a zero is a real number, not a gap
})

test('a gap in the data is skipped, not counted as zero; no numbers at all gives null', () => {
  const s = summarize([g('a', '1', { pts: 10 }), g('b', '2', { pts: null }), g('c', '3', { pts: 30 })], 'pts')
  assert.deepEqual(s, { n: 2, min: 10, avg: 20, max: 30 })
  assert.equal(summarize([g('a', '1', { pts: null })], 'pts'), null)
  assert.equal(summarize([], 'pts'), null)
})

test('the baseline is the plain half-and-half blend of last-10 and season averages, or the one there is', () => {
  const l = { n: 10, min: 1, avg: 24, max: 40 }
  const s = { n: 13, min: 1, avg: 20, max: 40 }
  assert.equal(baseline(l, s), 22)
  assert.equal(baseline(l, null), 24)
  assert.equal(baseline(null, s), 20)
  assert.equal(baseline(null, null), null)
})

test('games from the three routes become the same shape, with minutes alongside the stats', () => {
  const recent = fromRecent({ id: 'r', date: '2026-11-10', opp: 'TOR', isHome: false, seasonLabel: '2026-27', minutes: 34.5, stats: stats({ pts: 31 }) })
  assert.deepEqual(recent.values, { pts: 31, reb: 5, ast: 4, fg3m: 2, blk: 0, stl: 1, minutes: 34.5 })
  const meeting = fromMeeting({ id: 'm', date: '2025-01-10', team: 'NYK', opp: 'BOS', isHome: true, seasonLabel: '2024-25', minutes: 36, stats: stats(), kind: 'earlier' })
  assert.deepEqual([meeting.opp, meeting.seasonLabel, meeting.values.minutes], ['BOS', '2024-25', 36])
})

test('season games: only games he played, only the chosen game type, all team grids, newest first', () => {
  const sg = (id, date, played, pts) => ({ id, n: 1, date, opp: 'BOS', isHome: true, played, minutes: played ? 30 : null, stats: stats({ pts: played ? pts : null }) })
  const season = {
    grids: [
      { gameType: 'regular-season', seasonLabel: '2026-27', teamId: '1', team: 'NYK', otherTeams: null, teamGames: 3, games: [sg('a', '2026-11-01', true, 10), sg('b', '2026-11-03', false, null), sg('c', '2026-11-05', true, 30)] },
      { gameType: 'regular-season', seasonLabel: '2026-27', teamId: '2', team: 'AAA', otherTeams: 'NYK', teamGames: 1, games: [sg('d', '2026-10-25', true, 20)] },
      { gameType: 'playoffs', seasonLabel: '2025-26', teamId: '1', team: 'NYK', otherTeams: null, teamGames: 1, games: [sg('p', '2026-05-01', true, 99)] },
    ],
  }
  const out = seasonGames(season, 'regular-season')
  assert.deepEqual(out.map((x) => x.id), ['c', 'a', 'd'])
  assert.equal(summarize(out, 'pts').avg, 20)
  assert.deepEqual(seasonGames(season, 'playoffs').map((x) => x.id), ['p'])
  assert.deepEqual(seasonGames({ grids: [] }, 'regular-season'), [])
})

test('figures are written to the stat\'s decimals, with a dash for none', () => {
  assert.equal(fmtOutlook(21.04, 1), '21.0')
  assert.equal(fmtOutlook(0.5, 2), '0.50')
  assert.equal(fmtOutlook(null, 1), '-')
})

test('the Predictions page has its own address and keeps the team and the player in it', () => {
  assert.equal(pageFromHash('#/predictions'), 'predictions')
  assert.equal(pageFromHash('#/predictions?team=NYK&player=1628973'), 'predictions')
  assert.deepEqual(parseHash('#/predictions?team=BOS'), { page: 'predictions', team: 'BOS' })
  assert.equal(hashFor('predictions', 'NYK', 'overview', '1628973'), '#/predictions?team=NYK&player=1628973')
  assert.equal(hashFor('predictions', ''), '#/predictions')
  assert.equal(playerFromHash('#/predictions?team=NYK&player=1628973'), '1628973')
  assert.equal(hashFor('players', 'NYK', 'overview', '1628973'), '#/players?team=NYK&player=1628973') // unchanged
  assert.equal(hashFor('today', 'NYK', 'overview', '1628973'), '#/today?team=NYK') // a player is only carried by Players and Predictions
})

// ---- chart layout ----
import { CHART_PAD, ROW_HEIGHT, chartLayout } from '../src/lib/outlookChart.ts'
const mk = (id, pts, date = '2026-11-01', extra = {}, minutes = 30) => ({ id, date, opp: 'BOS', isHome: true, seasonLabel: '2026-27', values: { pts, reb: 5, ast: 4, fg3m: 2, blk: 0, stl: 1, minutes }, ...extra })
const views = (last10, season, opponent) => ({ last10, season, opponent })

test('chart: one shared scale, lowest value at the left edge and highest at the right, the same dot at the same place in every row', () => {
  const v = views([mk('a', 10), mk('b', 30)], [mk('a', 10), mk('b', 30), mk('c', 20)], [mk('o', 20)])
  const l = chartLayout(v, 'pts')
  assert.equal(l.lo, 10)
  assert.equal(l.hi, 30)
  assert.equal(l.rows.length, 3)
  assert.ok(Math.abs(l.rows[0].minX - CHART_PAD) < 1e-9 && Math.abs(l.rows[0].maxX - (100 - CHART_PAD)) < 1e-9)
  assert.ok(Math.abs(l.rows[2].avgX - 50) < 1e-9) // 20 is the middle of 10 and 30
  assert.equal(l.rows[1].dots.length, 3)
  assert.ok(Math.abs(l.rows[1].dots[2].x - l.rows[2].dots[0].x) < 1e-9) // 20 sits at the same x in the season row and the opponent row
  assert.ok(ROW_HEIGHT > 0)
})

test('chart: the baseline is on the scale, and widens it when it falls outside every game', () => {
  const l = chartLayout(views([mk('a', 10), mk('b', 30)], [mk('a', 10), mk('b', 30)], []), 'pts')
  assert.ok(Math.abs(l.baselineX - 50) < 1e-9) // blend of 20 and 20
  assert.deepEqual([l.rows[2].minX, l.rows[2].avgX, l.rows[2].maxX, l.rows[2].dots.length, l.rows[2].games], [null, null, null, 0, 0])
})

test('chart: dots carry a hover text with the date, home or away, the opponent and the number', () => {
  const l = chartLayout(views([mk('a', 31.4, '2026-10-23', { opp: 'MIN', isHome: false })], [], []), 'pts')
  assert.deepEqual([l.rows[0].dots[0].label, l.rows[0].dots[0].value], ['Oct 23 at MIN', 31.4])
  const h = chartLayout(views([mk('a', 12)], [], []), 'pts')
  assert.equal(h.rows[0].dots[0].label, 'Nov 1 vs BOS')
})

test('chart: a gap is not drawn, and identical values do not divide by zero', () => {
  const l = chartLayout(views([mk('a', null), mk('b', 7)], [mk('b', 7)], [mk('b', 7)]), 'pts')
  assert.equal(l.rows[0].dots.length, 1)
  assert.equal(l.rows[0].games, 2)
  assert.deepEqual([l.lo, l.hi], [6, 8])
  assert.ok(Number.isFinite(l.rows[0].avgX) && Number.isFinite(l.baselineX))
})

test('chart: nothing at all gives empty rows and no baseline', () => {
  const l = chartLayout(views([], [], []), 'pts')
  assert.equal(l.baselineX, null)
  assert.ok(l.rows.every((r) => r.dots.length === 0 && r.minX === null))
})

// ---- typical miss ----
import { MISS_BANDS, TYPICAL_MISS, missBand, missBandText, typicalMiss } from '../src/lib/outlook.ts'

test('typical miss: one figure per stat and minutes band, from the back-test; higher-minute players miss by more on counts, by less on minutes', () => {
  assert.deepEqual(Object.keys(TYPICAL_MISS), ['pts', 'reb', 'ast', 'fg3m', 'blk', 'stl', 'minutes'])
  assert.deepEqual(TYPICAL_MISS.pts, { under10: 2.918, from10: 3.875, from20: 4.893, from30: 5.892, all: 4.665 }) // MAE of the 50/50 blend, docs/predictions-backtest.md
  for (const s of ['pts', 'reb', 'ast', 'fg3m', 'blk', 'stl']) {
    const m = TYPICAL_MISS[s]
    assert.ok(m.under10 < m.from10 && m.from10 < m.from20 && m.from20 < m.from30, s) // more minutes, bigger numbers, bigger misses
    assert.ok(m.under10 < m.all && m.all < m.from30, s)
  }
  assert.ok(TYPICAL_MISS.minutes.from30 < TYPICAL_MISS.minutes.from20 && TYPICAL_MISS.minutes.from20 < TYPICAL_MISS.minutes.from10) // minutes are steadier for starters
})

test('typical miss: the band follows his average minutes over his last 10 games, lower edge included', () => {
  const withMinutes = (m) => views([mk('a', 10, '1', {}, m), mk('b', 10, '2', {}, m)], [], [])
  assert.deepEqual(MISS_BANDS.map((b) => b.from), [0, 10, 20, 30])
  assert.equal(missBand(withMinutes(34)), 'from30')
  assert.equal(missBand(withMinutes(30)), 'from30')
  assert.equal(missBand(withMinutes(29.9)), 'from20')
  assert.equal(missBand(withMinutes(20)), 'from20')
  assert.equal(missBand(withMinutes(14)), 'from10')
  assert.equal(missBand(withMinutes(3)), 'under10')
  assert.equal(missBand(withMinutes(0)), 'under10')
  assert.equal(missBand(views([], [mk('a', 10)], [])), 'all') // no last-10 games: the all-players figure
  assert.equal(typicalMiss('pts', 'from30'), 5.892)
  assert.equal(missBandText('from30'), 'players averaging 30+ minutes')
  assert.equal(missBandText('all'), 'all players')
})

import { dotGroups, tipGames, TIP_MAX_GAMES } from '../src/lib/outlookChart.ts'

test('tooltip: games with the same number share one tooltip, newest first, and a long list is cut with a count', () => {
  const l = chartLayout(views([mk('a', 20, '2026-11-03'), mk('b', 12, '2026-11-02'), mk('c', 20, '2026-11-01')], [], []), 'pts')
  const g = dotGroups(l.rows[0].dots)
  assert.equal(g.length, 2)
  assert.deepEqual(g.map((x) => x.value), [12, 20]) // left to right
  assert.deepEqual(g[1].games, ['Nov 3 vs BOS', 'Nov 1 vs BOS'])
  const many = Array.from({ length: TIP_MAX_GAMES + 3 }, (_, k) => `g${k}`)
  assert.equal(tipGames(many).length, TIP_MAX_GAMES + 1)
  assert.equal(tipGames(many).at(-1), 'and 3 more')
  assert.deepEqual(tipGames(['x']), ['x'])
})

test('headline tiles: the baseline, the band\'s typical miss, and his lowest to highest over the last 10 games', () => {
  const last10 = [g('a', '1', { pts: 10 }), g('b', '2', { pts: 30 })]
  const season = [g('a', '1', { pts: 10 }), g('b', '2', { pts: 30 }), g('c', '3', { pts: 20 }), g('d', '4', { pts: 20 })]
  const tiles = headlineTiles({ last10, season, opponent: [] })
  assert.deepEqual(tiles.map((t) => t.key), OUTLOOK_STATS.map((s) => s.key))
  const pts = tiles[0]
  assert.equal(pts.base, 20) // half the last-10 average (20), half the season average (20)
  assert.deepEqual([pts.lo, pts.hi, pts.games], [10, 30, 2])
  assert.equal(pts.miss, typicalMiss('pts', 'from30')) // 30 minutes a game is the 30+ band
  // the tile's baseline is the same number the table shows
  assert.equal(pts.base, baseline(summarize(last10, 'pts'), summarize(season, 'pts')))
})

test('headline tiles with no games show no figures rather than zeros', () => {
  const t = headlineTiles({ last10: [], season: [], opponent: [] })[0]
  assert.deepEqual([t.base, t.lo, t.hi, t.games], [null, null, null, 0])
})

test('behind a tile: the same baseline as the tile, each game once, newest first, flagged by window', () => {
  const season = [g('d', '2026-11-04', { pts: 30 }), g('c', '2026-11-03', { pts: 20 }), g('b', '2026-11-02', { pts: 10 }), g('a', '2026-11-01', { pts: 20 })]
  const last10 = [g('d', '2026-11-04', { pts: 30 }), g('c', '2026-11-03', { pts: 20 }), g('z', '2025-04-01', { pts: 40 })] // z is from an earlier season
  const views = { last10, season, opponent: [g('o1', '2026-10-20', { pts: 8 }), g('o2', '2026-10-25', { pts: 12 })] }
  const b = behindTile(views, 'pts')
  assert.equal(b.base, headlineTiles(views)[0].base) // the tile and the panel can never disagree
  assert.ok(Math.abs(b.base - ((30 + 20 + 40) / 3 + (30 + 20 + 10 + 20) / 4) / 2) < 1e-9)
  // newest first by date: d (Nov 4), c, b, a, then z (April 2025); each game once
  assert.deepEqual(b.rows.map((r) => [r.game.id, r.inLast10, r.inSeason]), [['d', true, true], ['c', true, true], ['b', false, true], ['a', false, true], ['z', true, false]])
  assert.deepEqual(b.opponentRows.map((r) => r.game.id), ['o2', 'o1']) // newest first, outside the baseline
  assert.equal(b.opponent.avg, 10)
  assert.deepEqual([b.label, b.digits], ['Points', 1])
})

test('behind a tile: a gap shows as no value and is left out of the averages; no games gives empty lists and no baseline', () => {
  const b = behindTile({ last10: [g('a', '2026-11-01', { blk: null }), g('b', '2026-11-02', { blk: 2 })], season: [], opponent: [] }, 'blk')
  assert.deepEqual(b.rows.map((r) => r.value), [2, null])
  assert.equal(b.last10.avg, 2)
  const none = behindTile({ last10: [], season: [], opponent: [] }, 'pts')
  assert.deepEqual([none.rows, none.opponentRows, none.base, none.last10, none.season, none.opponent], [[], [], null, null, null, null])
})

test('a single game is written whole, an average with one decimal, whatever the stat', () => {
  assert.deepEqual([fmtGame(5), fmtGame(39.0), fmtGame(13.8), fmtGame(0), fmtGame(-0.2), fmtGame(null)], ['5', '39', '14', '0', '0', '-'])
  assert.deepEqual([fmtOutlook(2.83, 1), fmtOutlook(0.63, 1), fmtOutlook(20.708, 1), fmtOutlook(null, 1)], ['2.8', '0.6', '20.7', '-'])
})
