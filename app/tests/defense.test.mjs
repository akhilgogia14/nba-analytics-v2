import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DEFENSE_STAT_LIST, THIN_PLAYER_GAMES, defendedGames, defenseRows, fmtDelta, fmtFigure, fmtRange, roleLabel, seasonSpan,
} from '../src/lib/defense.ts'

const cell = (perGame, per36 = 17, low = 1, high = 30) => ({ perGame, low, high, per36 })
const stats = (pts) => ({ pts, reb: cell(7), ast: cell(4), fg3m: cell(1.234), blk: cell(0.4), stl: cell(0.6) })
const group = (role, label, playerGames, pts) => ({ role, label, games: 13, playerGames, minutes: 30, stats: stats(pts) })
const defense = {
  team: { groups: [group('starter', 'G', 27, cell(31.4, 17.5)), group('starter', 'G-F', 5, cell(4.9, 14.9)), group('bench', 'Not listed', 0, cell(0, null, 0, 0))], firstSeason: '2026-27', lastSeason: '2026-27' },
  league: { groups: [group('starter', 'G', 22555, cell(29.6, 19.1)), group('starter', 'G-F', 5180, cell(6.0, 17.4)), group('bench', 'Not listed', 6864, cell(2.6, 13.1))], firstSeason: '2021-22', lastSeason: '2026-27' },
}

test('six stats in the switch, with two decimals for the small ones', () => {
  assert.deepEqual(DEFENSE_STAT_LIST.map((s) => s.key), ['pts', 'reb', 'ast', 'fg3m', 'blk', 'stl'])
  assert.deepEqual(DEFENSE_STAT_LIST.map((s) => s.digits), [1, 1, 1, 2, 2, 2])
})

test('rows put the team beside the league for the same group and subtract', () => {
  const [g, gf, nl] = defenseRows(defense, 'pts')
  assert.deepEqual([g.key, g.label, g.role, g.playerGames, g.games], ['starter:G', 'G', 'starter', 27, 13])
  assert.deepEqual([g.perGame, g.leaguePerGame], [31.4, 29.6])
  assert.ok(Math.abs(g.diffPerGame - 1.8) < 1e-9)
  assert.ok(Math.abs(g.diffPer36 - -1.6) < 1e-9)
  assert.deepEqual([g.low, g.high], [1, 30])
  assert.ok(Math.abs(gf.diffPerGame - -1.1) < 1e-9) // hyphenated labels are their own rows, matched to the league's same label
  assert.equal(nl.perGame, 0)
  assert.equal(nl.diffPerGame, -2.6)
})

test('a group with fewer than 10 opposing player-games is marked thin', () => {
  assert.equal(THIN_PLAYER_GAMES, 10)
  const rows = defenseRows(defense, 'pts')
  assert.deepEqual(rows.map((r) => r.thin), [false, true, true])
})

test('a missing league group or a missing per-36 gives no difference, not zero', () => {
  const noLeague = { ...defense, league: { ...defense.league, groups: [] } }
  const r = defenseRows(noLeague, 'pts')[0]
  assert.deepEqual([r.leaguePerGame, r.diffPerGame, r.diffPer36], [null, null, null])
  const nl = defenseRows(defense, 'pts')[2]
  assert.deepEqual([nl.per36, nl.diffPer36], [null, null]) // nobody played, so no per-36
})

test('other stats read the matching cell', () => {
  assert.equal(defenseRows(defense, 'reb')[0].perGame, 7)
  assert.equal(defenseRows(defense, 'fg3m')[0].perGame, 1.234)
})

test('numbers are written plainly: dashes for none, signs on differences, no negative zero', () => {
  assert.equal(fmtFigure(null, 1), '-')
  assert.equal(fmtFigure(31.44, 1), '31.4')
  assert.equal(fmtFigure(0.4, 2), '0.40')
  assert.equal(fmtDelta(1.84, 1), '+1.8')
  assert.equal(fmtDelta(-1.1, 1), '-1.1')
  assert.equal(fmtDelta(-0.04, 1), '0.0')
  assert.equal(fmtDelta(0.004, 2), '0.00')
  assert.equal(fmtDelta(null, 1), '-')
  assert.equal(fmtRange(1, 30, 1), '1.0 to 30.0')
  assert.equal(fmtRange(null, 30, 1), '-')
})

test('season span and the defended-games count', () => {
  assert.equal(seasonSpan('2026-27', '2026-27'), '2026-27')
  assert.equal(seasonSpan('2021-22', '2026-27'), '2021-22 to 2026-27')
  assert.equal(seasonSpan(null, null), '')
  assert.equal(defendedGames(defense), 13)
  assert.equal(defendedGames({ team: { groups: [], firstSeason: null, lastSeason: null }, league: defense.league }), 0)
  assert.deepEqual([roleLabel('starter'), roleLabel('bench')], ['Starters', 'Bench'])
})
