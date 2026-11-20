import assert from 'node:assert/strict'
import test from 'node:test'
import { GAME_DETAIL_SQL, mapGameDetail, validGameId } from '../server/queries.mjs'
import { againstAverage, detailTiles, resultText } from '../src/lib/gameDetail.ts'

test('game id check: 8 to 12 digits only, leading zeros kept', () => {
  assert.equal(validGameId('0022600101'), true)
  for (const bad of ['', 'abc', "0022600101' OR 1=1", '123', '0022600101 ', undefined, 22600101]) assert.equal(validGameId(bad), false, String(bad))
})

test('game detail SQL: named parameters only, two gold tables, one row, the result joined on game and team', () => {
  assert.deepEqual([...new Set([...GAME_DETAIL_SQL.matchAll(/:\w+/g)].map((m) => m[0]))].sort(), [':gid', ':id'])
  assert.deepEqual([...new Set([...GAME_DETAIL_SQL.matchAll(/workspace\.nba_v2_\w+\.\w+/g)].map((m) => m[0]))].sort(),
    ['workspace.nba_v2_gold.player_season_games', 'workspace.nba_v2_gold.team_game_log'])
  assert.doesNotMatch(GAME_DETAIL_SQL, /nba_v2_(silver|bronze)|\$\{/)
  assert.match(GAME_DETAIL_SQL, /LEFT JOIN workspace\.nba_v2_gold\.team_game_log g ON g\.game_id = t\.game_id AND g\.team_id = t\.team_id/) // a missing result never drops the player row
  assert.match(GAME_DETAIL_SQL, /t\.person_id = :id AND t\.game_id = :gid/)
  assert.doesNotMatch(GAME_DETAIL_SQL, /\bplayed\b.*=/) // a game he missed is returned too, with played = false
})

// the 23 box-score columns (GAMELOG order), then played, won, team pts, opp pts, overtimes
const played = ['0022600101', '2026-10-31', 'PHI', 'false', '2026-27', '30.4', '23', '7', '5', '3', '1', '2', 'true', '8', '17', '7', '4', '5', '1', '6', '2', '3', '+9', 'true', 'true', '118', '110', '0']
test('mapGameDetail: his box score and the team result', () => {
  const d = mapGameDetail([played.map((v) => (v === '+9' ? '9' : v))])
  assert.equal(d.played, true)
  assert.deepEqual([d.game.id, d.game.date, d.game.opp, d.game.isHome, d.game.minutes], ['0022600101', '2026-10-31', 'PHI', false, 30.4])
  assert.deepEqual(d.game.stats, { pts: 23, reb: 7, ast: 5, fg3m: 3, blk: 1, stl: 2 })
  assert.deepEqual(d.game.box, { started: true, fgm: 8, fga: 17, fg3a: 7, ftm: 4, fta: 5, oreb: 1, dreb: 6, tov: 2, pf: 3, plusMinus: 9 })
  assert.deepEqual(d.result, { won: true, teamPts: 118, oppPts: 110, overtimes: 0 })
})

test('mapGameDetail: no row is null; a missed game has played false and empty numbers; no result is null, not zeros', () => {
  assert.equal(mapGameDetail([]), null)
  const missed = [...played]
  for (const i of [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22]) missed[i] = null
  missed[23] = 'false'
  const m = mapGameDetail([missed])
  assert.equal(m.played, false)
  assert.equal(m.game.stats.pts, null)
  assert.equal(m.game.box.started, null)
  const noResult = [...played]
  noResult[24] = null; noResult[25] = null; noResult[26] = null; noResult[27] = null
  assert.equal(mapGameDetail([noResult]).result, null)
})

test('result text: W or L, the score, overtimes; nothing without a score', () => {
  assert.equal(resultText({ won: true, teamPts: 118, oppPts: 110, overtimes: 0 }), 'W 118-110')
  assert.equal(resultText({ won: false, teamPts: 102, oppPts: 104, overtimes: 1 }), 'L 102-104 (OT)')
  assert.equal(resultText({ won: false, teamPts: 102, oppPts: 104, overtimes: 2 }), 'L 102-104 (2OT)')
  assert.equal(resultText(null), '')
  assert.equal(resultText({ won: true, teamPts: null, oppPts: null, overtimes: 0 }), '')
})

test('detail tiles: twelve, shooting as made-attempted, plus/minus with its sign, dashes for gaps', () => {
  const d = mapGameDetail([played.map((v) => (v === '+9' ? '9' : v))])
  const t = Object.fromEntries(detailTiles(d.game).map((x) => [x.label, x.value]))
  assert.equal(detailTiles(d.game).length, 12)
  assert.deepEqual([t.MIN, t.PTS, t['3P'], t.FG, t.FT, t.TOV, t['+/-']], ['30', '23', '3-7', '8-17', '4-5', '2', '+9'])
  const gap = { ...d.game, minutes: null, stats: { ...d.game.stats, pts: null }, box: { ...d.game.box, plusMinus: null } }
  const g = Object.fromEntries(detailTiles(gap).map((x) => [x.label, x.value]))
  assert.deepEqual([g.MIN, g.PTS, g['+/-']], ['–', '–', '–'])
})

test('against the season average: above, below, equal, and nothing when a number is missing', () => {
  assert.equal(againstAverage(23, 18.2, 'pts'), '23 PTS: 4.8 above his season average of 18.2')
  assert.equal(againstAverage(10, 18.2, 'pts'), '10 PTS: 8.2 below his season average of 18.2')
  assert.equal(againstAverage(18, 18, 'reb'), '18 REB: equal to his season average of 18.0')
  assert.equal(againstAverage(null, 18, 'pts'), '')
  assert.equal(againstAverage(5, null, 'pts'), '')
})
