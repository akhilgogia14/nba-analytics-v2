import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DEFENSE_STAT_LIST, THIN_PLAYER_GAMES, barShare, defendedGames, defenseTotals, listRows, defenseRows, groupSummary, linesForGroup, fmtDelta, fmtFigure, fmtRange, roleLabel, seasonSpan,
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

test('totals add the groups together: the whole-game figure for the team and for the league, and their difference', () => {
  const t = defenseTotals(defense, 'pts')
  assert.ok(Math.abs(t.team - (31.4 + 4.9 + 0)) < 1e-9)
  assert.ok(Math.abs(t.league - (29.6 + 6.0 + 2.6)) < 1e-9)
  assert.ok(Math.abs(t.diff - (36.3 - 38.2)) < 1e-9)
  const none = { team: { groups: [], firstSeason: null, lastSeason: null }, league: { groups: [], firstSeason: null, lastSeason: null } }
  assert.deepEqual(defenseTotals(none, 'pts'), { team: null, league: null, diff: null })
})

test('the list puts the biggest "gives up more" first, the biggest "holds below" last, and keeps small or empty groups out', () => {
  const more = group('bench', 'G', 39, cell(20.3, 14.0))
  const less = group('starter', 'C', 12, cell(4.3, 10.9))
  const d = {
    team: { groups: [group('starter', 'G', 24, cell(30.4)), less, more, group('starter', 'F-G', 2, cell(5, 35.3)), group('bench', 'Not listed', 0, cell(0, null))], firstSeason: '2026-27', lastSeason: '2026-27' },
    league: { groups: [group('starter', 'G', 5000, cell(29.6)), group('starter', 'C', 5000, cell(7.0)), group('bench', 'G', 5000, cell(14.7)), group('starter', 'F-G', 900, cell(3.6)), group('bench', 'Not listed', 900, cell(2.6))], firstSeason: '2021-22', lastSeason: '2026-27' },
  }
  const { main, small, scale } = listRows(defenseRows(d, 'pts'))
  assert.deepEqual(main.map((r) => r.key), ['bench:G', 'starter:G', 'starter:C'])
  assert.deepEqual(small.map((r) => r.key), ['starter:F-G', 'bench:Not listed']) // 2 and 0 opposing player-games
  assert.ok(Math.abs(scale - 5.6) < 1e-9)
  assert.ok(main.every((r) => r.playerGames >= THIN_PLAYER_GAMES))
})

test('a bar reaches from the centre: the biggest difference reaches the end, none or no scale gives no bar', () => {
  assert.equal(barShare(5.6, 5.6), 50)
  assert.equal(barShare(-2.8, 5.6), 25)
  assert.equal(barShare(null, 5.6), 0)
  assert.equal(barShare(3, 0), 0)
  assert.equal(barShare(99, 5.6), 50) // never past the end
})

const line = (id, date, role, label, pts, name = `P${id}`) => ({ id, name, team: 'MIA', gameId: `g${id}${date}`, date, home: true, role, label, minutes: 20, stats: { pts, reb: 1, ast: 1, fg3m: 0, blk: 0, stl: 0 } })

test('a group lists every opposing player-game in it, biggest first, ties newest first, other groups left out', () => {
  const lines = [line('1', '2026-11-01', 'bench', 'G', 12), line('2', '2026-11-03', 'bench', 'G', 30), line('1', '2026-11-05', 'bench', 'G', 12), line('3', '2026-11-04', 'starter', 'G', 40), line('4', '2026-11-02', 'bench', 'G', null)]
  const got = linesForGroup(lines, 'bench:G', 'pts')
  assert.deepEqual(got.map((l) => [l.id, l.date]), [['2', '2026-11-03'], ['1', '2026-11-05'], ['1', '2026-11-01'], ['4', '2026-11-02']]) // a missing figure goes last, never dropped
  assert.deepEqual(linesForGroup(lines, 'starter:C', 'pts'), []) // an empty group is an empty list
  assert.equal(linesForGroup([line('9', '2026-11-01', 'starter', 'C', 2)], 'starter:C', 'pts').length, 1) // one player-game is still shown: no minimum
})

test('the group summary counts player-games, different players and the total', () => {
  const lines = [line('1', '2026-11-01', 'bench', 'G', 12), line('1', '2026-11-05', 'bench', 'G', 12), line('2', '2026-11-03', 'bench', 'G', 30)]
  assert.deepEqual(groupSummary(lines, 'pts'), { playerGames: 3, players: 2, total: 54 })
  assert.deepEqual(groupSummary([], 'pts'), { playerGames: 0, players: 0, total: 0 })
})
