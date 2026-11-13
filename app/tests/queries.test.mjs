import test from 'node:test'
import assert from 'node:assert/strict'
import {
  FORM_SQL, PLAYERS_SQL, TEAMS_SQL, mapForm, mapPlayers, mapTeams, validPlayerId, validTeam,
} from '../server/queries.mjs'

test('validTeam accepts only three capital letters', () => {
  assert.equal(validTeam('NYK'), true)
  for (const bad of ['nyk', 'NY', 'NYKS', "NYK' OR 1=1 --", 'N1K', '', ' NYK', undefined, null, 123, ['NYK']]) {
    assert.equal(validTeam(bad), false, `should reject ${JSON.stringify(bad)}`)
  }
})

test('validPlayerId accepts only digits, 1 to 12 long', () => {
  assert.equal(validPlayerId('1628973'), true)
  assert.equal(validPlayerId('203999'), true)
  for (const bad of ['', 'abc', '12a', '1; DROP TABLE x', '-5', '1.5', '1234567890123', undefined, null, 5]) {
    assert.equal(validPlayerId(bad), false, `should reject ${JSON.stringify(bad)}`)
  }
})

test('outside values only enter the SQL as named parameters', () => {
  assert.match(PLAYERS_SQL, /= :team\b/)
  assert.match(FORM_SQL, /= :id\b/)
  assert.doesNotMatch(TEAMS_SQL, /:\w+/)
  for (const s of [TEAMS_SQL, PLAYERS_SQL, FORM_SQL]) assert.doesNotMatch(s, /\$\{/)
})

test('every query reads regular-season rows only, so no figure blends in playoff games', () => {
  for (const s of [TEAMS_SQL, PLAYERS_SQL, FORM_SQL]) assert.match(s, /game_type = 'regular-season'/)
  assert.match(PLAYERS_SQL, /m\.game_type = p\.game_type/)  // minutes come from the same game type
  assert.doesNotMatch(FORM_SQL, /not_regular/)
})

test('FORM_SQL columns come back in the order mapForm reads them', () => {
  const cols = FORM_SQL.match(/SELECT([\s\S]*?)FROM/)[1].split(',').map((c) => c.trim())
  assert.equal(cols.length, 22)
  assert.equal(cols[10], 'l10_games_before_current_season')
  assert.equal(cols[11], 'l10_mean')
  assert.equal(cols[17], 'l10_share_0')
  assert.equal(cols[21], 'season_mean')
})

test('mapTeams and mapPlayers turn strings into numbers', () => {
  assert.deepEqual(mapTeams([['DEN', '19'], ['NYK', '21']]), [
    { team: 'DEN', players: 19 }, { team: 'NYK', players: 21 },
  ])
  assert.deepEqual(mapPlayers([['1628973', 'Jalen Brunson', '10', '33.546']]), [
    { id: '1628973', name: 'Jalen Brunson', l10Games: 10, minutes: 33.546 },
  ])
})

// Row order is the SELECT order in FORM_SQL.
const row = (stat, nums, shares) => [
  stat, 'Jalen Brunson', 'NYK', '2026-11-11', '2026-27', '454', '2026-27',
  '11', '10', '2026-10-23', '0',
  ...nums, ...shares,
]

test('mapForm maps one player: names, windows, numbers, shares', () => {
  const pts = row('pts', ['26.5', '25.5', '19.0', '33.5', '19.0', '38.0'], [null, null, null, null])
  pts.push('26.0')
  const fg3m = row('fg3m', ['2.8', '3.0', '0.9', '5.1', '0.0', '6.0'], ['0.1', '0.2', '0.1', '0.6'])
  fg3m.push('2.636')

  const out = mapForm([pts, fg3m])
  assert.deepEqual(out.player, {
    name: 'Jalen Brunson', team: 'NYK', lastGameDate: '2026-11-11', lastSeasonLabel: '2026-27', totalGames: 454,
    seasonLabel: '2026-27', seasonGames: 11, l10Games: 10, l10FirstDate: '2026-10-23',
    l10GamesBeforeCurrentSeason: 0,
  })
  assert.deepEqual(out.stats.pts, {
    mean: 26.5, median: 25.5, p10: 19, p90: 33.5, min: 19, max: 38, seasonMean: 26, shares: null,
  })
  assert.deepEqual(out.stats.fg3m.shares, [0.1, 0.2, 0.1, 0.6])
  assert.equal(out.stats.fg3m.seasonMean, 2.636)
})

test('mapForm returns null for an unknown player', () => {
  assert.equal(mapForm([]), null)
})
