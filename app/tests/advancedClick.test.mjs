import assert from 'node:assert/strict'
import test from 'node:test'
import { BUCKETS_SQL, BUCKET_ARRAY_SQL, TEAM_CONTEXT_GAMES_SQL, TEAM_CONTEXT_SQL, mapTeamContextGames } from '../server/contextQueries.mjs'
import { PLAYER_CONTEXT_GAMES_SQL, PLAYER_CONTEXT_SQL, mapPlayerContextGames } from '../server/playerContextQueries.mjs'
import { explainPlayerTile, explainShareTile, explainTeamTile, gameCount, gameLine, splitGames, teamScore } from '../src/lib/contextGames.ts'

const names = (sql) => [...new Set([...sql.matchAll(/workspace\.nba_v2_\w+\.\w+/g)].map((m) => m[0]))].sort()

test('the grouped queries and the game lists share one bucket rule', () => {
  assert.ok(BUCKETS_SQL.includes(BUCKET_ARRAY_SQL))
  assert.ok(TEAM_CONTEXT_GAMES_SQL.includes(BUCKET_ARRAY_SQL))
  assert.ok(PLAYER_CONTEXT_GAMES_SQL.includes(BUCKET_ARRAY_SQL))
})

test('team games SQL: named parameters, two gold tables, the same season and games as the grouped table, newest first', () => {
  assert.deepEqual([...new Set([...TEAM_CONTEXT_GAMES_SQL.matchAll(/:\w+/g)].map((m) => m[0]))].sort(), [':gt', ':team'])
  assert.deepEqual(names(TEAM_CONTEXT_GAMES_SQL), ['workspace.nba_v2_gold.game_context', 'workspace.nba_v2_gold.team_game_log'])
  assert.doesNotMatch(TEAM_CONTEXT_GAMES_SQL, /nba_v2_(silver|bronze)|\$\{|LIMIT/)
  const where = (sql) => sql.slice(sql.indexOf('WHERE'), sql.indexOf('GROUP BY') > 0 ? sql.indexOf('GROUP BY') : sql.indexOf('ORDER BY')).replace(/\s+/g, ' ').trim()
  assert.equal(where(TEAM_CONTEXT_GAMES_SQL), where(TEAM_CONTEXT_SQL)) // exactly the games the table averages
  assert.match(TEAM_CONTEXT_GAMES_SQL, /ORDER BY c\.game_date DESC, c\.game_id DESC/)
  assert.match(TEAM_CONTEXT_GAMES_SQL, /try_divide\(100 \* l\.fgm, l\.fga\)/)
})

test('player games SQL: named parameters, two gold tables, the same season and games as the grouped table, missed games kept', () => {
  assert.deepEqual([...new Set([...PLAYER_CONTEXT_GAMES_SQL.matchAll(/:\w+/g)].map((m) => m[0]))].sort(), [':gt', ':id'])
  assert.deepEqual(names(PLAYER_CONTEXT_GAMES_SQL), ['workspace.nba_v2_gold.game_context', 'workspace.nba_v2_gold.player_season_games'])
  assert.doesNotMatch(PLAYER_CONTEXT_GAMES_SQL, /nba_v2_(silver|bronze)|\$\{|LIMIT/)
  const where = (sql) => sql.slice(sql.indexOf('WHERE'), sql.indexOf('GROUP BY') > 0 ? sql.indexOf('GROUP BY') : sql.indexOf('ORDER BY')).replace(/\s+/g, ' ').trim()
  assert.equal(where(PLAYER_CONTEXT_GAMES_SQL), where(PLAYER_CONTEXT_SQL))
  assert.doesNotMatch(where(PLAYER_CONTEXT_GAMES_SQL), /p\.played/) // a game he missed is listed, with played = false
})

test('mapTeamContextGames: stats by name, situations split, gaps stay null', () => {
  const { games } = mapTeamContextGames([['g1', '2026-11-14', 'MIA', 'true', '1', '-1', 'all,home,rested,rest1,edge_minus', '118', '110', '8', '47.5', '14', '12'], ['g2', '2026-11-12', 'BOS', 'false', null, null, 'all,away', '100', '104', '-4', null, '9', '15']])
  assert.deepEqual(games[0], { id: 'g1', date: '2026-11-14', opp: 'MIA', isHome: true, daysRest: 1, restEdge: -1, buckets: ['all', 'home', 'rested', 'rest1', 'edge_minus'], stats: { pts: 118, allowed: 110, margin: 8, fg_pct: 47.5, fg3m: 14, tov: 12 } })
  assert.deepEqual([games[1].daysRest, games[1].buckets, games[1].stats.fg_pct], [null, ['all', 'away'], null])
  assert.deepEqual(mapTeamContextGames([]), { games: [] })
})

test('mapPlayerContextGames: played flag, seven stats, a missed game has empty numbers', () => {
  const { games } = mapPlayerContextGames([
    ['g1', '2026-11-14', 'MIA', 'true', '2', '0', 'all,home,rested,rest2plus', 'true', '23', '7', '5', '3', '1', '2', '30.4'],
    ['g0', '2026-11-12', 'BOS', 'false', '0', '1', 'all,away,b2b,edge_plus', 'false', null, null, null, null, null, null, null],
  ])
  assert.equal(games[0].played, true)
  assert.deepEqual(games[0].stats, { pts: 23, reb: 7, ast: 5, fg3m: 3, blk: 1, stl: 2, minutes: 30.4 })
  assert.equal(games[1].played, false)
  assert.equal(games[1].stats.pts, null)
  assert.deepEqual(games[1].buckets, ['all', 'away', 'b2b', 'edge_plus'])
})

test('splitGames: each comparison side takes the games in its situation; a game can be on two comparisons but not twice on one', () => {
  const g = (id, buckets) => ({ id, date: '2026-11-0' + id, opp: 'X', isHome: true, daysRest: 1, restEdge: 0, buckets })
  const games = [g('1', ['all', 'home', 'rested']), g('2', ['all', 'away', 'b2b']), g('3', ['all', 'home', 'b2b'])]
  const home = splitGames(games, 'home', 'away')
  assert.deepEqual([home.a.map((x) => x.id), home.b.map((x) => x.id)], [['1', '3'], ['2']])
  const b2b = splitGames(games, 'b2b', 'rested')
  assert.deepEqual([b2b.a.map((x) => x.id), b2b.b.map((x) => x.id)], [['2', '3'], ['1']])
  assert.deepEqual(splitGames([], 'home', 'away'), { a: [], b: [] })
})

test('small wording helpers', () => {
  assert.deepEqual([gameCount(1), gameCount(7), gameCount(0)], ['1 game', '7 games', '0 games'])
  assert.deepEqual(gameLine({ id: 'x', date: '', opp: 'MIA', isHome: false, daysRest: 0, restEdge: null, buckets: [] }), { title: '@ MIA', note: 'back-to-back' })
  assert.equal(gameLine({ id: 'x', date: '', opp: 'MIA', isHome: true, daysRest: null, restEdge: null, buckets: [] }).note, 'first game of the season')
  assert.equal(teamScore({ stats: { pts: 118, allowed: 110 } }), 'W 118-110')
  assert.equal(teamScore({ stats: { pts: 100, allowed: 104 } }), 'L 100-104')
  assert.equal(teamScore({ stats: { pts: null, allowed: 104 } }), '')
})

test('tile explanations show the two averages, their game counts and the gap; no figure says so', () => {
  const d = { a: 115.2, b: 112.6, diff: 2.6, nA: 21000, nB: 20990 }
  assert.equal(explainTeamTile('Points scored', 'Home', 'Away', 'pts', d), 'Points scored: Home 115.2 (average over 21,000 games) minus Away 112.6 (20,990 games) = +2.6.')
  assert.match(explainTeamTile('FG%', 'Home', 'Away', 'fg_pct', { a: 47.1, b: 46.0, diff: 1.1, nA: 5, nB: 6 }), /Home 47\.1% .* minus Away 46\.0% .* = \+1\.1 pts\./)
  assert.match(explainTeamTile('Points scored', 'Home', 'Away', 'pts', { a: 114.84, b: 112.76, diff: 2.08, nA: 9, nB: 9 }), /= \+2\.1 \(worked out from unrounded figures\)\.$/) // 114.8 - 112.8 = 2.0, not 2.1
  assert.match(explainTeamTile('Points scored', 'Home', 'Away', 'pts', null), /no league figure/)
  assert.equal(explainPlayerTile('Points', 'Home', 'Away', { a: 0.21, b: -0.2, diff: 0.41, nA: 50000, nB: 49000 }),
    "Points: in Home games a player is +0.21 against his own season average (over 50,000 player games); in Away games -0.20 (49,000). Difference +0.41.")
  assert.match(explainPlayerTile('Points', 'Home', 'Away', { a: 0.046, b: -0.046, diff: 0.092, nA: 9, nB: 9 }), /Difference \+0\.09 \(worked out from unrounded figures\)\.$/) // shown +0.05 and -0.05 would subtract to 0.10, not 0.09
  assert.equal(explainShareTile('Home', 'Away', 91.2, 88, '+3.2 pts'), 'Share of games played: players appeared in 91% of team games in Home situations and 88% in Away ones, a difference of +3.2 pts.')
})
