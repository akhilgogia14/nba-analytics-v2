import test from 'node:test'
import assert from 'node:assert/strict'
import {
  FORM_SQL, PLAYERS_SQL, SEASON_SQL, TEAMS_SQL, mapForm, mapPlayers, mapSeason, mapTeams, validPlayerId, validTeam,
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

// ---- the season chart ----

test('SEASON_SQL: named parameter only, one table, regular season and playoffs only, latest season PER game type', () => {
  assert.match(SEASON_SQL, /= :id\b/)
  assert.doesNotMatch(SEASON_SQL, /\$\{/)
  assert.match(SEASON_SQL, /FROM workspace\.nba_v2_gold\.player_season_games t/)
  assert.match(SEASON_SQL, /t\.game_type IN \('regular-season', 'playoffs'\)/)
  // the newest season is looked up inside the same game type, so a playoff grid can be from an earlier season
  assert.match(SEASON_SQL, /x\.person_id = t\.person_id AND x\.game_type = t\.game_type/)
  assert.doesNotMatch(SEASON_SQL, /player_form|player_game_log/)
})

test('SEASON_SQL columns come back in the order mapSeason reads them', () => {
  const cols = SEASON_SQL.match(/SELECT([\s\S]*?)FROM/)[1].split(',').map((c) => c.trim().replace(/^t\./, ''))
  assert.deepEqual(cols, [
    'game_type', 'season_label', 'team_id', 'team_tricode', 'other_teams', 'team_games', 'game_number', 'game_id',
    'game_date', 'opponent_tricode', 'is_home', 'played', 'minutes', 'pts', 'reb', 'ast', 'fg3m', 'blk', 'stl',
  ])
})

// Row order is the SELECT order in SEASON_SQL: type, label, team id, tricode, other teams, team games, game number,
// game id, date, opponent, home, played, minutes, pts, reb, ast, fg3m, blk, stl. The warehouse sends strings.
const srow = (type, tid, tri, other, n, date, opp, home, played, st = [null, null, null, null, null, null]) =>
  [type, '2025-26', tid, tri, other, '3', String(n), `${tid}-${n}`, date, opp, home, played, played === 'true' ? '30.5' : null, ...st]

test('mapSeason: one grid per game type and team, regular season first, most recent team first, games in order', () => {
  const rows = [
    // a traded player: team 1 (AAA) early in the season, team 2 (BBB) later; rows arrive ordered by type, team, game
    srow('playoffs', '2', 'BBB', null, 1, '2026-04-20', 'CCC', 'true', 'true', ['10', '4', '2', '1', '0', '3']),
    srow('regular-season', '1', 'AAA', 'BBB', 1, '2026-01-02', 'CCC', 'true', 'true', ['20', '5', '3', '2', '1', '0']),
    srow('regular-season', '1', 'AAA', 'BBB', 2, '2026-01-04', 'DDD', 'false', 'false'),
    srow('regular-season', '1', 'AAA', 'BBB', 3, '2026-01-06', 'EEE', 'true', 'false'),
    srow('regular-season', '2', 'BBB', 'AAA', 2, '2026-02-04', 'DDD', 'false', 'true', ['8', '1', '1', '0', '0', '0']),
    srow('regular-season', '2', 'BBB', 'AAA', 1, '2026-02-02', 'CCC', 'true', 'false'),
  ]
  const { grids } = mapSeason(rows)
  assert.deepEqual(grids.map((g) => `${g.gameType}:${g.team}`), ['regular-season:BBB', 'regular-season:AAA', 'playoffs:BBB'])
  const [b, a, po] = grids
  assert.equal(a.otherTeams, 'BBB')
  assert.equal(b.otherTeams, 'AAA')
  assert.equal(po.otherTeams, null)
  assert.equal(b.teamGames, 3)
  assert.equal(a.seasonLabel, '2025-26')
  assert.deepEqual(b.games.map((g) => g.n), [1, 2]) // sorted by game number although they arrived 2, 1
  assert.deepEqual(a.games.map((g) => [g.n, g.played, g.isHome]), [[1, true, true], [2, false, false], [3, false, true]])
  assert.deepEqual(a.games[0], {
    id: '1-1', n: 1, date: '2026-01-02', opp: 'CCC', isHome: true, played: true, minutes: 30.5,
    stats: { pts: 20, reb: 5, ast: 3, fg3m: 2, blk: 1, stl: 0 },
  })
  assert.deepEqual(a.games[1].stats, { pts: null, reb: null, ast: null, fg3m: null, blk: null, stl: null }) // missed: empty, not 0
  assert.equal(a.games[1].minutes, null)
})

test('mapSeason: a player with no games gets no grids; real booleans work too', () => {
  assert.deepEqual(mapSeason([]), { grids: [] })
  const g = mapSeason([srow('regular-season', '1', 'AAA', null, 1, '2026-01-02', 'CCC', true, true, ['1', '2', '3', '4', '5', '6'])]).grids[0]
  assert.equal(g.games[0].isHome, true)
  assert.equal(g.games[0].played, true)
})
