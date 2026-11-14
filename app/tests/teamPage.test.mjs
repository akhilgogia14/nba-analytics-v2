import test from 'node:test'
import assert from 'node:assert/strict'
import { pageFromHash } from '../src/lib/pages.ts'
import { sparkLayout, sparkTip } from '../src/lib/spark.ts'
import { TEAM_CARDS, cardFormat, leagueNote, pctText, resultText, teamAverageRow, teamLogNote, teamMeetingsNote, teamNotices } from '../src/lib/teamPage.ts'

const game = (id, date, o = {}) => ({
  id, date, opp: o.opp ?? 'CLE', isHome: o.home ?? true, seasonLabel: o.season ?? '2026-27', won: o.won ?? true,
  pts: o.pts ?? 110, oppPts: o.oppPts ?? 100, margin: 10, overtimes: 0, stats: o.stats ?? {},
  box: { fgm: 40, fga: 80, fg3m: 15, fg3a: 40, ftm: 15, fta: 20, oreb: 10, dreb: 33, reb: 43, ast: 25, stl: 7, blk: 5, tov: 12, pf: 18, ...(o.box ?? {}) },
})
const info = (o = {}) => ({
  name: 'New York Knicks', tricode: 'NYK', lastGameDate: '2026-11-11', lastSeasonLabel: '2026-27', totalGames: 421, seasonLabel: '2026-27',
  seasonGames: 11, l10Games: 10, l10FirstDate: '2026-10-23', l10GamesBeforeCurrentSeason: 0, l10Wins: 6, ...o,
})

test('the address picks the page: #/teams is Teams, anything else is Players', () => {
  assert.equal(pageFromHash('#/teams'), 'teams')
  assert.equal(pageFromHash('#/teams?x=1'), 'teams')
  for (const h of ['', '#', '#/players', '#/team', '#/other']) assert.equal(pageFromHash(h), 'players')
})

test('the six cards are offense first and turnovers count lower as better', () => {
  assert.deepEqual(TEAM_CARDS.map((c) => c.key), ['pts', 'fg_pct', 'fg3m', 'fg3_pct', 'ast', 'tov'])
  assert.deepEqual(TEAM_CARDS.filter((c) => c.lowerIsBetter).map((c) => c.key), ['tov'])
  assert.deepEqual(TEAM_CARDS.filter((c) => c.pct).map((c) => c.key), ['fg_pct', 'fg3_pct'])
})

test('percentage cards are written with a % sign, the others plainly', () => {
  const [pts, fg] = [TEAM_CARDS[0], TEAM_CARDS[1]]
  assert.equal(cardFormat(pts)(111.34), '111.3')
  assert.equal(cardFormat(fg)(44.331), '44.3%')
})

test('result text puts the team points first', () => {
  assert.equal(resultText({ won: false, pts: 107, oppPts: 115 }), 'L 107-115')
  assert.equal(resultText({ won: true, pts: 115, oppPts: 107 }), 'W 115-107')
  assert.equal(resultText({ won: true, pts: null, oppPts: null }), 'W')
})

test('a percentage is made over attempts, and a dash with no attempts', () => {
  assert.equal(pctText(41, 83), '49.4%')
  assert.equal(pctText(0, 0), '–')
  assert.equal(pctText(null, 10), '–')
})

test('the average row pools percentages (total made over total attempts) and averages the rest', () => {
  const games = [
    game('a', '2026-11-02', { pts: 100, oppPts: 90, box: { fgm: 10, fga: 20, fg3m: 0, fg3a: 0, tov: 10 } }),
    game('b', '2026-11-01', { pts: 120, oppPts: 130, won: false, box: { fgm: 30, fga: 40, fg3m: 0, fg3a: 0, tov: 16 } }),
  ]
  const avg = teamAverageRow(games)
  assert.equal(avg.fgPct, '66.7%') // 40 of 60, not the average of 50% and 75%
  assert.equal(avg.fg3Pct, '–')
  assert.equal(avg.fg, '20-30')
  assert.equal(avg.pts, 110)
  assert.equal(avg.tov, 13)
  assert.equal(avg.wins, 1)
})

test('the notes above the table and the opponent panel say what the games are', () => {
  const games = [game('a', '2026-11-02'), game('b', '2026-04-01', { season: '2025-26', won: false })]
  assert.match(teamLogNote(games, 'games'), /last 2 games, newest first.*from 2025-26 to 2026-27.*1 won, 1 lost/)
  assert.equal(teamLogNote([], 'games'), 'No games on record for this team.')
  const m = { scope: 'filled', currentSeason: '2026-27', games: [{ ...game('a', 'x'), kind: 'this' }, { ...game('b', 'y'), kind: 'last' }] }
  assert.match(teamMeetingsNote(m, 'CLE', 'games'), /1 game against CLE in 2026-27, plus 1 from last season/)
  assert.match(teamMeetingsNote({ scope: 'none', currentSeason: '2026-27', games: [] }, 'CLE', 'games'), /No games against CLE in 2026-27 or last season/)
})

test('notices: a short window, a young season, a long break, and playoff windows', () => {
  const now = new Date('2026-11-13T12:00:00Z')
  assert.deepEqual(teamNotices(info(), 'regular-season', now), [])
  assert.match(teamNotices(info({ l10Games: 4 }), 'regular-season', now)[0], /Only 4 games on record/)
  assert.match(teamNotices(info({ l10GamesBeforeCurrentSeason: 3 }), 'regular-season', now)[0], /3 of these 10 games are from before this season/)
  assert.match(teamNotices(info({ lastGameDate: '2026-10-01' }), 'regular-season', now).join(' '), /last played on Oct 1, 43 days ago/)
  const po = teamNotices(info({ lastGameDate: '2026-06-13', lastSeasonLabel: '2025-26' }), 'playoffs', now)
  assert.match(po.join(' '), /Playoff games only.*Jun 13 \(2025-26 playoffs\)/)
})

test('a sparkline works for team stats, with their own names and number format', () => {
  const games = [game('a', '2026-11-01', { stats: { fg_pct: 40 } }), game('b', '2026-11-02', { stats: { fg_pct: 50 } })]
  const layout = sparkLayout(games, 'fg_pct', 45)
  assert.equal(layout.points.length, 2)
  assert.ok(layout.baseline !== null)
  const tip = sparkTip(games[1], 'fg_pct', 50, { short: 'FG%', name: 'Field goal %' }, (n) => `${n.toFixed(1)}%`)
  assert.equal(tip.title, '50.0% FG% · vs CLE')
  assert.match(tip.label, /50\.0% field goal %, vs CLE/)
  // the player page's own stats still work without names
  assert.equal(sparkTip(games[1], 'pts', 22).title, '22 PTS · vs CLE')
})

test('the average row also averages steals, blocks and fouls', () => {
  const games = [game('a', '2026-11-02', { box: { stl: 6, blk: 3, pf: 20 } }), game('b', '2026-11-01', { box: { stl: 9, blk: 6, pf: 17 } })]
  const avg = teamAverageRow(games)
  assert.equal(avg.stl, 7.5)
  assert.equal(avg.blk, 4.5)
  assert.equal(avg.pf, 18.5)
})

test('the note under the cards explains both lines, or is absent without a league figure', () => {
  const league = { seasonLabel: '2026-27', games: 300, stats: { pts: 112 } }
  assert.match(leagueNote(league, 'regular-season'), /Dashed line: the team's season average\. Dotted line: the league average per team game \(2026-27 regular-season, 300 team games\)/)
  assert.match(leagueNote({ ...league, seasonLabel: '2025-26' }, 'playoffs'), /2025-26 playoff, 300 team games/)
  assert.equal(leagueNote(null, 'regular-season'), null)
  assert.equal(leagueNote({ seasonLabel: null, games: 0, stats: {} }, 'playoffs'), null)
})
