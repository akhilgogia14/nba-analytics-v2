import test from 'node:test'
import assert from 'node:assert/strict'
import { MEETINGS_MIN } from '../server/queries.mjs'
import {
  LEAGUE_SQL, LEAGUE_STATS, TEAM_FORM_SQL, TEAM_GAMES_SQL, TEAM_LOG_SQL, TEAM_MEETINGS_SQL, TEAM_STATS, mapLeague, mapTeamForm, mapTeamGame, mapTeamGames,
  mapTeamLog, mapTeamMeetings, pickMeetings,
} from '../server/teamQueries.mjs'

// A game row in the order the SQL returns it: GAME_COLUMNS, then (meetings only) is_current and current_season.
const row = (id, date, o = {}) => [
  id, date, o.opp ?? 'CLE', o.home ?? true, o.season ?? '2026-27', o.won ?? true, o.pts ?? 110, o.oppPts ?? 100, o.ot ?? 0,
  o.fgm ?? 40, o.fga ?? 80, o.fg3m ?? 15, o.fg3a ?? 40, o.ftm ?? 15, o.fta ?? 20, o.oreb ?? 10, o.dreb ?? 33, o.reb ?? 43,
  o.ast ?? 25, o.stl ?? 7, o.blk ?? 5, o.tov ?? 12, o.pf ?? 18,
]
const meet = (id, date, current, season, o = {}) => [...row(id, date, { season, ...o }), current, '2026-27']

test('outside values only enter the team SQL as named parameters', () => {
  for (const s of [TEAM_FORM_SQL, TEAM_GAMES_SQL, TEAM_LOG_SQL, TEAM_MEETINGS_SQL]) {
    assert.match(s, /= :team\b/)
    assert.doesNotMatch(s, /\$\{/)
  }
  for (const s of [TEAM_FORM_SQL, TEAM_GAMES_SQL, TEAM_LOG_SQL, TEAM_MEETINGS_SQL]) assert.match(s, /game_type = :gt\b/)
  assert.match(TEAM_MEETINGS_SQL, /team_tricode = :opp\b/)
})

test('the windows are 10 games for the sparklines and 15 for the table, newest first', () => {
  assert.match(TEAM_GAMES_SQL, /ORDER BY game_date DESC, game_id DESC\s+LIMIT 10\b/)
  assert.match(TEAM_LOG_SQL, /ORDER BY game_date DESC, game_id DESC\s+LIMIT 15\b/)
})

test('the page reads only the two granted gold tables', () => {
  for (const s of [TEAM_FORM_SQL, TEAM_GAMES_SQL, TEAM_LOG_SQL, TEAM_MEETINGS_SQL]) {
    const tables = [...s.matchAll(/workspace\.nba_v2_\w+\.\w+/g)].map((m) => m[0])
    for (const t of tables) assert.ok(['workspace.nba_v2_gold.team_form', 'workspace.nba_v2_gold.team_game_log'].includes(t), t)
  }
})

test('mapTeamForm: no rows is null; rows become team facts and numbers by stat', () => {
  assert.equal(mapTeamForm([]), null)
  const r = (stat, mean) => [stat, 'New York Knicks', 'NYK', '2026-11-11', '2026-27', '9', '2026-27', '9', '9', '2026-10-25', '0', '6',
    mean, '110', '100', '120', '95', '130', '109.5']
  const form = mapTeamForm([r('pts', '111.3'), r('fg_pct', '44.331')])
  assert.deepEqual(form.team, {
    name: 'New York Knicks', tricode: 'NYK', lastGameDate: '2026-11-11', lastSeasonLabel: '2026-27', totalGames: 9, seasonLabel: '2026-27',
    seasonGames: 9, l10Games: 9, l10FirstDate: '2026-10-25', l10GamesBeforeCurrentSeason: 0, l10Wins: 6,
  })
  assert.deepEqual(form.stats.fg_pct, { mean: 44.331, median: 110, p10: 100, p90: 120, min: 95, max: 130, seasonMean: 109.5 })
  assert.equal(form.stats.pts.mean, 111.3)
})

test('mapTeamGame works out percentages, margin and the box score', () => {
  const g = mapTeamGame(row('g1', '2026-11-11', { fgm: 41, fga: 83, fg3m: 14, fg3a: 39, ftm: 11, fta: 11, pts: 107, oppPts: 115, won: false, home: true }))
  assert.equal(g.won, false)
  assert.equal(g.isHome, true)
  assert.equal(g.margin, -8)
  assert.equal(g.stats.allowed, 115)
  assert.equal(g.stats.margin, -8)
  assert.ok(Math.abs(g.stats.fg_pct - (41 / 83) * 100) < 1e-9)
  assert.ok(Math.abs(g.stats.fg3_pct - (14 / 39) * 100) < 1e-9)
  assert.equal(g.stats.ft_pct, 100)
  assert.deepEqual(g.box, { fgm: 41, fga: 83, fg3m: 14, fg3a: 39, ftm: 11, fta: 11, oreb: 10, dreb: 33, reb: 43, ast: 25, stl: 7, blk: 5, tov: 12, pf: 18 })
  for (const k of TEAM_STATS) assert.ok(k in g.stats, `stats has ${k}`)
})

test('a percentage with no attempts is empty, not zero', () => {
  const g = mapTeamGame(row('g1', '2026-11-11', { fg3a: 0, fg3m: 0 }))
  assert.equal(g.stats.fg3_pct, null)
  assert.equal(g.stats.fg3m, 0)
})

test('sparkline games run oldest first and the table newest first', () => {
  const rows = [row('g3', '2026-11-03'), row('g2', '2026-11-02'), row('g1', '2026-11-01')]
  assert.deepEqual(mapTeamGames(rows).games.map((g) => g.id), ['g1', 'g2', 'g3'])
  assert.deepEqual(mapTeamLog(rows).games.map((g) => g.id), ['g3', 'g2', 'g1'])
  assert.deepEqual(mapTeamGames([]), { games: [] })
})

test('meetings: seven or more this season shows this season only', () => {
  const rows = Array.from({ length: MEETINGS_MIN }, (_, i) => meet(`c${i}`, `2026-11-${20 - i}`, true, '2026-27'))
  rows.push(meet('l1', '2026-03-01', false, '2025-26'))
  const m = mapTeamMeetings(rows)
  assert.equal(m.scope, 'season')
  assert.equal(m.games.length, MEETINGS_MIN)
  assert.ok(m.games.every((g) => g.kind === 'this'))
})

test('meetings: few this season are filled from LAST season only, never older', () => {
  const rows = [meet('c1', '2026-11-05', true, '2026-27'), meet('c2', '2026-10-30', true, '2026-27')]
  for (let i = 0; i < 6; i++) rows.push(meet(`l${i}`, `2026-03-${20 - i}`, false, '2025-26'))
  rows.push(meet('o1', '2025-01-01', false, '2024-25'), meet('o2', '2024-01-01', false, '2023-24'))
  const m = mapTeamMeetings(rows)
  assert.equal(m.scope, 'filled')
  assert.equal(m.games.length, MEETINGS_MIN)
  assert.deepEqual(m.games.map((g) => g.kind), ['this', 'this', 'last', 'last', 'last', 'last', 'last'])
  assert.ok(m.games.every((g) => g.seasonLabel !== '2024-25' && g.seasonLabel !== '2023-24'))
})

test('meetings: none this season gives last season; nothing recent says none', () => {
  const earlier = mapTeamMeetings([meet('l1', '2026-03-01', false, '2025-26'), meet('o1', '2025-01-01', false, '2024-25')])
  assert.equal(earlier.scope, 'earlier')
  assert.deepEqual(earlier.games.map((g) => g.id), ['l1'])
  assert.equal(mapTeamMeetings([meet('o1', '2025-01-01', false, '2024-25')]).scope, 'none')
  assert.deepEqual(mapTeamMeetings([]), { scope: 'none', currentSeason: null, games: [] })
})

test('pickMeetings is the same rule the player page uses', () => {
  const games = [{ id: 'a', seasonLabel: '2026-27', isCurrent: true }, { id: 'b', seasonLabel: '2025-26', isCurrent: false }]
  const m = pickMeetings(games, '2026-27')
  assert.equal(m.scope, 'filled')
  assert.deepEqual(m.games.map((g) => g.id), ['a', 'b'])
  assert.equal(pickMeetings([games[0]], '2026-27').scope, 'season')
})

test('league averages: the game type is the only input, one table is read, and every stat team_form has is covered', () => {
  assert.match(LEAGUE_SQL, /game_type = :gt\b/)
  assert.deepEqual([...LEAGUE_SQL.matchAll(/:\w+/g)].map((m) => m[0]).filter((v, i, a) => a.indexOf(v) === i), [':gt'])
  assert.doesNotMatch(LEAGUE_SQL, /\$\{/)
  assert.deepEqual([...LEAGUE_SQL.matchAll(/workspace\.nba_v2_\w+\.\w+/g)].map((m) => m[0]).filter((v, i, a) => a.indexOf(v) === i), ['workspace.nba_v2_gold.team_game_log'])
  assert.deepEqual([...LEAGUE_STATS].sort(), [...TEAM_STATS].sort())
  assert.match(LEAGUE_SQL, /try_divide\(sum\(fgm\), sum\(fga\)\)/) // percentages are pooled, and safe with no attempts
})

test('mapLeague turns one row into the league figures by stat name', () => {
  const row = ['300', '2026-27', '112.5', '47.1', '14.2', '36.4', '78.2', '26.1', '13.8', '44.5', '10.9', '89.3', '22.4', '0', '112.5', '4.9', '7.3']
  const m = mapLeague([row])
  assert.equal(m.seasonLabel, '2026-27')
  assert.equal(m.games, 300)
  assert.deepEqual(m.stats, {
    pts: 112.5, fg_pct: 47.1, fg3m: 14.2, fg3_pct: 36.4, ft_pct: 78.2, ast: 26.1, tov: 13.8, reb: 44.5, oreb: 10.9, fga: 89.3,
    fta: 22.4, margin: 0, allowed: 112.5, blk: 4.9, stl: 7.3,
  })
})

test('mapLeague: no games of the type gives games 0 and no figures', () => {
  assert.deepEqual(mapLeague([]), { seasonLabel: null, games: 0, stats: {} })
  assert.deepEqual(mapLeague([['0', null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null]]), { seasonLabel: null, games: 0, stats: {} })
})
