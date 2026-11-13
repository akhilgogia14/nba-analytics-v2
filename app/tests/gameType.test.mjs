import test from 'node:test'
import assert from 'node:assert/strict'
import { GAME_TYPE_OPTIONS, formNotices, gamesWord } from '../src/lib/gameType.ts'
import { TEAM_NAMES } from '../src/lib/format.ts'
import { TEAM_STYLES } from '../src/lib/teams.ts'
import { chartPalette } from '../src/lib/hex.ts'

const player = (over = {}) => ({
  name: 'Jalen Brunson', team: 'NYK', lastGameDate: '2026-11-11', lastSeasonLabel: '2026-27', totalGames: 374,
  seasonLabel: '2026-27', seasonGames: 11, l10Games: 10, l10FirstDate: '2026-10-23', l10GamesBeforeCurrentSeason: 0, ...over,
})
const NOV_12 = new Date(Date.UTC(2026, 10, 12))

test('the toggle has exactly two options, regular season first', () => {
  assert.deepEqual(GAME_TYPE_OPTIONS, [{ key: 'regular-season', label: 'Regular season' }, { key: 'playoffs', label: 'Playoffs' }])
  assert.equal(gamesWord('regular-season'), 'games')
  assert.equal(gamesWord('playoffs'), 'playoff games')
})

test('regular-season notes: a fresh full window has none', () => {
  assert.deepEqual(formNotices(player(), 'regular-season', NOV_12), [])
})

test('regular-season notes: short window, games from before this season, long absence (hand-worked)', () => {
  const p = player({ l10Games: 4, l10GamesBeforeCurrentSeason: 2, lastGameDate: '2026-10-30' })
  assert.deepEqual(formNotices(p, 'regular-season', NOV_12), [
    'Only 4 games on record so far. These ranges are rough and will move a lot with each new game.',
    '2 of these 4 games are from before this season, because the new season is young.',
    'Jalen Brunson last played on Oct 30, 13 days ago.',
  ])
})

test('playoff notes: say they are playoff games, name the latest playoff game and season, never claim a long absence', () => {
  const p = player({ lastGameDate: '2026-06-13', lastSeasonLabel: '2025-26', l10GamesBeforeCurrentSeason: 10, totalGames: 79 })
  assert.deepEqual(formNotices(p, 'playoffs', NOV_12), [
    "Playoff games only. Jalen Brunson's latest playoff game on record was on Jun 13 (2025-26 playoffs), so these games can reach back across earlier playoff runs.",
  ])
  const short = formNotices(player({ l10Games: 3, lastGameDate: '2025-04-30', lastSeasonLabel: '2024-25' }), 'playoffs', NOV_12)
  assert.equal(short[0], 'Only 3 playoff games on record so far. These ranges are rough and will move a lot with each new game.')
  assert.equal(short.length, 2)
  for (const n of [...short]) assert.doesNotMatch(n, /days ago|young/) // a playoff window is old by nature
})

test('all 30 teams: every team can be listed (a name), lit (a style) and charted (a palette)', () => {
  const names = Object.keys(TEAM_NAMES).sort()
  assert.equal(names.length, 30)
  assert.deepEqual(Object.keys(TEAM_STYLES).sort(), names)
  for (const t of names) {
    const p = chartPalette(t)
    assert.equal(p.ramp.length, 5)
    assert.notEqual(p.top, '#5eead4', `${t} must not fall back to the theme teal`) // the old fallback for 12 teams
  }
})
