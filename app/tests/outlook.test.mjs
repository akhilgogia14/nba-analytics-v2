import assert from 'node:assert/strict'
import test from 'node:test'
import { hashFor, pageFromHash, parseHash, playerFromHash } from '../src/lib/pages.ts'
import { OUTLOOK_STATS, VIEWS, baseline, fmtOutlook, fromMeeting, fromRecent, seasonGames, summarize } from '../src/lib/outlook.ts'

const stats = (o = {}) => ({ pts: 20, reb: 5, ast: 4, fg3m: 2, blk: 0, stl: 1, ...o })
const g = (id, date, o = {}, minutes = 30) => ({ id, date, opp: 'BOS', isHome: true, seasonLabel: '2026-27', values: { ...stats(o), minutes } })

test('seven stats, small counts get two decimals, and three views in a fixed order', () => {
  assert.deepEqual(OUTLOOK_STATS.map((s) => s.key), ['pts', 'reb', 'ast', 'fg3m', 'blk', 'stl', 'minutes'])
  assert.deepEqual(OUTLOOK_STATS.map((s) => s.digits), [1, 1, 1, 2, 2, 2, 1])
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
