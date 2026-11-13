import test from 'node:test'
import assert from 'node:assert/strict'
import {
  FORM_SQL, GAMES_SQL, GAMES_WINDOW, MEETINGS_LIMIT, MEETINGS_MIN, MEETINGS_SQL, GAME_TYPES, PLAYERS_SQL, PLAYOFF_PLAYERS_SQL, PLAYOFF_TEAMS_SQL, SEASON_SQL, TEAMS_SQL, mapForm,
  mapGames, mapMeetings, mapPlayers, previousSeasonLabel, mapSeason, mapTeams, playersSqlFor, teamsSqlFor, validGameType, validPlayerId, validTeam,
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
  assert.match(FORM_SQL, /game_type = :gt\b/)
  assert.doesNotMatch(TEAMS_SQL, /:\w+/)
  for (const s of [TEAMS_SQL, PLAYERS_SQL, FORM_SQL]) assert.doesNotMatch(s, /\$\{/)
})

test('the team and player lists read regular-season rows (the current roster); the form reads exactly ONE game type', () => {
  for (const s of [TEAMS_SQL, PLAYERS_SQL]) assert.match(s, /game_type = 'regular-season'/)
  assert.match(PLAYERS_SQL, /m\.game_type = p\.game_type/)  // minutes come from the same game type
  assert.doesNotMatch(FORM_SQL, /not_regular/)
  // the form query is filtered to one game type by a parameter, never to a list, so no figure blends the two
  assert.doesNotMatch(FORM_SQL, /game_type\s+(IN|<>|!=)/i)
  assert.doesNotMatch(FORM_SQL, /'regular-season'|'playoffs'/)
})

test('validGameType accepts exactly the two game types the page toggles between', () => {
  assert.deepEqual(GAME_TYPES, ['regular-season', 'playoffs'])
  for (const ok of GAME_TYPES) assert.equal(validGameType(ok), true)
  for (const bad of ['', 'play-in', 'nba-cup', 'Playoffs', 'playoffs ', "playoffs' OR 1=1 --", undefined, null, 5, ['playoffs']]) {
    assert.equal(validGameType(bad), false, `should reject ${JSON.stringify(bad)}`)
  }
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

// ---- the pickers in playoffs mode ----

test('playoff team and player lists: one table, playoff rows of the NEWEST playoffs season, named parameter only', () => {
  for (const s of [PLAYOFF_TEAMS_SQL, PLAYOFF_PLAYERS_SQL]) {
    assert.match(s, /FROM workspace\.nba_v2_gold\.player_season_games/)
    assert.match(s, /game_type = 'playoffs'/)
    assert.doesNotMatch(s, /regular-season/)
    assert.doesNotMatch(s, /\$\{/)
    // the newest season that has any playoff game, looked up inside the playoff rows (so it is last year's until the new playoffs start)
    assert.match(s, /season = \(SELECT max\(season\) FROM workspace\.nba_v2_gold\.player_season_games WHERE game_type = 'playoffs'\)/)
  }
  assert.doesNotMatch(PLAYOFF_TEAMS_SQL, /:\w+/)
  assert.match(PLAYOFF_PLAYERS_SQL, /team_tricode = :team\b/)
  assert.equal([...PLAYOFF_PLAYERS_SQL.matchAll(/:\w+/g)].length, 1)
  assert.match(PLAYOFF_PLAYERS_SQL, /ORDER BY minutes DESC NULLS LAST/) // Spark puts NULLs first on DESC otherwise
})

test('playoff lists give the same columns as the regular lists, so the same mappers read them', () => {
  const cols = (s) => s.match(/SELECT([\s\S]*?)FROM/)[1].split(/,(?![^()]*\))/).map((c) => c.trim())
  assert.equal(cols(PLAYOFF_PLAYERS_SQL).length, cols(PLAYERS_SQL).length) // id, name, games, minutes
  assert.equal(cols(PLAYOFF_TEAMS_SQL).length, cols(TEAMS_SQL).length) // team, players
  assert.deepEqual(mapPlayers([['1628973', 'Jalen Brunson', '19', '38.2']]), [{ id: '1628973', name: 'Jalen Brunson', l10Games: 19, minutes: 38.2 }])
  assert.deepEqual(mapPlayers([['7', 'A Player', '2', null]]), [{ id: '7', name: 'A Player', l10Games: 2, minutes: null }])
})

test('teamsSqlFor and playersSqlFor pick the lists for the page game type', () => {
  assert.equal(teamsSqlFor('playoffs'), PLAYOFF_TEAMS_SQL)
  assert.equal(teamsSqlFor('regular-season'), TEAMS_SQL)
  assert.equal(playersSqlFor('playoffs'), PLAYOFF_PLAYERS_SQL)
  assert.equal(playersSqlFor('regular-season'), PLAYERS_SQL)
  assert.equal(teamsSqlFor(undefined), TEAMS_SQL) // the routes refuse any other type before this is called
})

// ---- the games behind the lines under the scorecards ----

test('GAMES_SQL: named parameters only, one table, one game type, played games, newest first, last 10', () => {
  assert.match(GAMES_SQL, /person_id = :id\b/)
  assert.match(GAMES_SQL, /game_type = :gt\b/)
  assert.equal([...GAMES_SQL.matchAll(/:\w+/g)].length, 2)
  assert.match(GAMES_SQL, /FROM workspace\.nba_v2_gold\.player_season_games/)
  assert.match(GAMES_SQL, /AND played\b/)
  assert.match(GAMES_SQL, /ORDER BY game_date DESC, game_id DESC/)
  assert.equal(GAMES_WINDOW, 10)
  assert.match(GAMES_SQL, /LIMIT 10$/)
  assert.doesNotMatch(GAMES_SQL, /\$\{|'regular-season'|'playoffs'|game_type\s+IN/i) // exactly one game type, by parameter
})

test('GAMES_SQL columns come back in the order mapGames reads them', () => {
  const cols = GAMES_SQL.match(/SELECT([\s\S]*?)FROM/)[1].split(',').map((c) => c.trim())
  assert.deepEqual(cols, ['game_id', 'game_date', 'opponent_tricode', 'is_home', 'season_label', 'minutes', 'pts', 'reb', 'ast', 'fg3m', 'blk', 'stl'])
})

test('mapGames: rows arrive newest first and leave oldest first, with numbers and booleans converted', () => {
  const rows = [
    ['g3', '2026-11-11', 'BOS', 'false', '2026-27', '36.5', '31', '4', '6', '3', '0', '2'],
    ['g2', '2026-11-09', 'MIA', 'true', '2026-27', '30', '22', '5', '7', '2', '1', null],
    ['g1', '2026-11-07', 'ORL', true, '2026-27', null, '18', '3', '5', '0', '0', '1'],
  ]
  const { games } = mapGames(rows)
  assert.deepEqual(games.map((g) => g.id), ['g1', 'g2', 'g3'])
  assert.deepEqual(games[2], { id: 'g3', date: '2026-11-11', opp: 'BOS', isHome: false, seasonLabel: '2026-27', minutes: 36.5, stats: { pts: 31, reb: 4, ast: 6, fg3m: 3, blk: 0, stl: 2 } })
  assert.equal(games[1].stats.stl, null) // a gap stays null, never 0
  assert.equal(games[0].isHome, true)
  assert.equal(games[0].minutes, null)
  assert.deepEqual(mapGames([]), { games: [] })
})

// ---- the meetings view: one player against one opponent ----

test('MEETINGS_SQL: named parameters only, one table, one game type, played games, newest first, capped', () => {
  assert.deepEqual([...new Set([...MEETINGS_SQL.matchAll(/:\w+/g)].map((m) => m[0]))].sort(), [':gt', ':id', ':opp'])
  assert.match(MEETINGS_SQL, /FROM workspace\.nba_v2_gold\.player_season_games/)
  assert.doesNotMatch(MEETINGS_SQL, /nba_v2_(silver|bronze)|player_form|player_game_log/) // only the table the app can read
  assert.match(MEETINGS_SQL, /person_id = :id AND game_type = :gt AND played/)
  assert.match(MEETINGS_SQL, /opponent_team_id = \(SELECT max_by\(team_id, game_date\) FROM [\w.]+ WHERE team_tricode = :opp\)/)
  assert.match(MEETINGS_SQL, /season = \(SELECT max\(season\) FROM [\w.]+ WHERE game_type = :gt\) AS is_current/)
  assert.match(MEETINGS_SQL, /\(SELECT max_by\(season_label, season\) FROM [\w.]+ WHERE game_type = :gt\) AS current_season/)
  assert.match(MEETINGS_SQL, /ORDER BY game_date DESC, game_id DESC/)
  assert.equal(MEETINGS_LIMIT, 100)
  assert.match(MEETINGS_SQL, /LIMIT 100$/)
  assert.doesNotMatch(MEETINGS_SQL, /'regular-season'|'playoffs'|game_type\s+IN/i) // one game type, by parameter
})

test('MEETINGS_SQL columns come back in the order mapMeetings reads them', () => {
  const cols = MEETINGS_SQL.match(/SELECT([\s\S]*?)\n\s*FROM workspace\.nba_v2_gold\.player_season_games\n\s*WHERE/)[1]
    .replace(/\([^()]*(\([^()]*\))?[^()]*\)/g, '').split(',').map((c) => c.trim().replace(/\s+AS \w+$/, ''))
  assert.deepEqual(cols.slice(0, 13), ['game_id', 'game_date', 'team_tricode', 'opponent_tricode', 'is_home', 'season_label', 'minutes', 'pts', 'reb', 'ast', 'fg3m', 'blk', 'stl'])
  assert.equal(cols.length, 15) // ... then is_current, current_season
  assert.match(MEETINGS_SQL, /AS is_current,\s+\(SELECT[^\n]*AS current_season\s+FROM/)
})

test('previousSeasonLabel', () => {
  assert.equal(previousSeasonLabel('2026-27'), '2025-26')
  assert.equal(previousSeasonLabel('2000-01'), '1999-00')
  assert.equal(previousSeasonLabel('nonsense'), null)
  assert.equal(previousSeasonLabel(null), null)
})

const meet = (id, date, season, current, pts = '20') => [id, date, 'NYK', 'BOS', 'true', season, '33', pts, '4', '5', '2', '0', '1', current, '2026-27']
const ids = (o) => o.games.map((g) => g.id)

test('mapMeetings: 7 or more meetings this season shows all of them and nothing from earlier', () => {
  const rows = [...Array.from({ length: 8 }, (_, i) => meet(`c${8 - i}`, `2026-11-${20 - i}`, '2026-27', 'true')), meet('x', '2026-04-01', '2025-26', 'false')]
  const out = mapMeetings(rows)
  assert.equal(out.scope, 'season')
  assert.equal(out.games.length, 8)
  assert.ok(out.games.every((g) => g.kind === 'this'))
  assert.equal(out.currentSeason, '2026-27')
})

test('mapMeetings: fewer than 7 this season is topped up to 7 with the most recent earlier meetings, each marked', () => {
  const rows = [
    meet('c2', '2026-11-10', '2026-27', 'true', '31'), meet('c1', '2026-11-02', '2026-27', 'true'),
    meet('l3', '2026-04-01', '2025-26', 'false'), meet('l2', '2026-02-01', '2025-26', 'false'),
    meet('l1', '2025-12-01', '2025-26', 'false'), meet('o2', '2025-03-01', '2024-25', 'false'),
    meet('o1', '2025-01-01', '2024-25', 'false'), meet('o0', '2024-01-01', '2023-24', 'false'),
  ]
  const out = mapMeetings(rows)
  assert.equal(MEETINGS_MIN, 7)
  assert.equal(out.scope, 'filled')
  assert.deepEqual(ids(out), ['c2', 'c1', 'l3', 'l2', 'l1', 'o2', 'o1']) // 2 this season + 5 earlier = 7, newest first
  assert.deepEqual(out.games.map((g) => g.kind), ['this', 'this', 'last', 'last', 'last', 'older', 'older'])
  assert.deepEqual(out.games[0].stats, { pts: 31, reb: 4, ast: 5, fg3m: 2, blk: 0, stl: 1 })
  assert.deepEqual([out.games[0].isHome, out.games[0].team, out.games[0].opp], [true, 'NYK', 'BOS'])
})

test('mapMeetings: a fill that stays within last season is all marked last season', () => {
  const out = mapMeetings([meet('c1', '2026-11-02', '2026-27', 'true'), ...Array.from({ length: 6 }, (_, i) => meet(`l${i}`, `2026-0${i + 1}-01`, '2025-26', 'false')).reverse()])
  assert.equal(out.games.length, 7)
  assert.deepEqual(out.games.map((g) => g.kind), ['this', 'last', 'last', 'last', 'last', 'last', 'last'])
})

test('mapMeetings: fewer meetings in total than 7 shows them all', () => {
  const out = mapMeetings([meet('c1', '2026-11-02', '2026-27', 'true'), meet('l1', '2026-02-01', '2025-26', 'false')])
  assert.deepEqual([out.scope, ids(out)], ['filled', ['c1', 'l1']])
})

test('mapMeetings: none this season gives the last 7, newest first, marked last season or older', () => {
  const rows = Array.from({ length: 10 }, (_, i) => meet(`g${10 - i}`, `2025-0${(i % 9) + 1}-01`, i < 3 ? '2025-26' : '2024-25', 'false'))
  const out = mapMeetings(rows)
  assert.equal(out.scope, 'earlier')
  assert.deepEqual(ids(out), ['g10', 'g9', 'g8', 'g7', 'g6', 'g5', 'g4'])
  assert.deepEqual(out.games.map((g) => g.kind), ['last', 'last', 'last', 'older', 'older', 'older', 'older'])
})

test('mapMeetings: never met is scope none', () => {
  assert.deepEqual(mapMeetings([]), { scope: 'none', currentSeason: null, games: [] })
})

test('mapMeetings: a gap stays null and the warehouse\'s string booleans convert', () => {
  const row = ['g1', '2026-11-10', 'NYK', 'BOS', 'false', '2026-27', null, '12', null, '3', '0', '0', '0', 'true', '2026-27']
  const [g] = mapMeetings([row]).games
  assert.equal(g.isHome, false)
  assert.equal(g.minutes, null)
  assert.equal(g.stats.reb, null)
  assert.equal(g.stats.pts, 12)
})
