import assert from 'node:assert/strict'
import test from 'node:test'
import { RANKING_SQL, RANKING_STATS, mapRanking } from '../server/teamQueries.mjs'
import { RANK_STATS, defenseSummary, fmtRank, rankOf, recordText, standings, statByKey, strengthsAndWeaknesses, tierOf, verdictLine } from '../src/lib/teamSummary.ts'

const stat = (k) => statByKey(k)
const team = (code, o = {}) => ({ team: code, games: 14, wins: 9, stats: { pts: 110, allowed: 110, margin: 0, fg_pct: 46, fg3m: 12, ast: 25, reb: 44, tov: 14, stl: 7, blk: 5, ...o } })

test('ranking SQL: one named parameter, one gold table, the latest season of the type, one row per team id', () => {
  assert.deepEqual([...new Set([...RANKING_SQL.matchAll(/:\w+/g)].map((m) => m[0]))], [':gt'])
  assert.deepEqual([...new Set([...RANKING_SQL.matchAll(/workspace\.nba_v2_\w+\.\w+/g)].map((m) => m[0]))], ['workspace.nba_v2_gold.team_game_log'])
  assert.doesNotMatch(RANKING_SQL, /nba_v2_(silver|bronze)|\$\{/)
  assert.match(RANKING_SQL, /GROUP BY team_id/)
  assert.match(RANKING_SQL, /season = \(SELECT max\(season\) FROM workspace\.nba_v2_gold\.team_game_log WHERE game_type = :gt\)/)
  assert.match(RANKING_SQL, /try_divide\(sum\(fgm\), sum\(fga\)\) \* 100/) // pooled FG%, like the team's own season figure
})

test('mapRanking: stats by name, no rows gives no teams', () => {
  const r = mapRanking([['CHA', '2026-27', '14', '9', '110.4', '113.8', '-3.4', '45.2', '13', '26', '44', '14', '7', '5']])
  assert.equal(r.seasonLabel, '2026-27')
  assert.deepEqual(r.teams[0], { team: 'CHA', games: 14, wins: 9, stats: { pts: 110.4, allowed: 113.8, margin: -3.4, fg_pct: 45.2, fg3m: 13, ast: 26, reb: 44, tov: 14, stl: 7, blk: 5 } })
  assert.deepEqual(RANKING_STATS, Object.keys(r.teams[0].stats))
  assert.deepEqual(mapRanking([]), { seasonLabel: null, teams: [] })
})

test('standings: best first, lower is better for points allowed and turnovers, ties share a rank, missing figures are left out', () => {
  const teams = [team('A', { pts: 120, allowed: 105 }), team('B', { pts: 115, allowed: 105 }), team('C', { pts: 115, allowed: 112 }), team('D', { pts: null, allowed: 118 })]
  assert.deepEqual(standings(teams, stat('pts')).map((s) => [s.team, s.rank]), [['A', 1], ['B', 2], ['C', 2]])
  assert.deepEqual(standings(teams, stat('allowed')).map((s) => [s.team, s.rank]), [['A', 1], ['B', 1], ['C', 3], ['D', 4]]) // fewest allowed first; a tie shares rank 1
  assert.equal(rankOf(teams, 'D', stat('pts')), null)
  assert.deepEqual(rankOf(teams, 'C', stat('pts')), { stat: stat('pts'), value: 115, rank: 2, of: 3 })
})

test('tiers are thirds of the teams ranked, and no verdict with fewer than six', () => {
  assert.deepEqual([1, 10, 11, 20, 21, 30].map((r) => tierOf(r, 30)), ['strong', 'strong', 'average', 'average', 'weak', 'weak'])
  assert.deepEqual([1, 5, 6, 11, 12, 16].map((r) => tierOf(r, 16)), ['strong', 'strong', 'average', 'average', 'weak', 'weak'])
  assert.deepEqual([1, 3, 5].map((r) => tierOf(r, 5)), ['average', 'average', 'average'])
})

test('verdict sentence names the tier, the rank and what it is ranked on; a missing rank is skipped', () => {
  const r = (key, rank, of = 30) => ({ stat: stat(key), value: 1, rank, of })
  assert.equal(verdictLine(r('pts', 3), r('allowed', 14)), 'Offense: strong (3rd of 30 in points scored). Defense: in the middle (14th of 30 in points allowed).')
  assert.equal(verdictLine(r('pts', 22), r('allowed', 30)), 'Offense: weak (22nd of 30 in points scored). Defense: weak (30th of 30 in points allowed).')
  assert.equal(verdictLine(null, r('allowed', 1)), 'Defense: strong (1st of 30 in points allowed).')
})

test('strengths and weaknesses: only top-third and bottom-third stats, two at most each, best and worst first', () => {
  // 30 teams; the team under test is X. Give it a spread of ranks by giving the other 29 teams values around its own.
  const others = Array.from({ length: 29 }, (_, i) => team(`T${String(i).padStart(2, '0')}`, { fg3m: 5 + i * 0.5, ast: 20 + i * 0.5, tov: 10 + i * 0.5, reb: 40 + i * 0.5, fg_pct: 40 + i * 0.4, stl: 5 + i * 0.1, blk: 3 + i * 0.1 }))
  const x = team('X', { fg3m: 30, ast: 21, tov: 30, reb: 60, fg_pct: 46, stl: 6.5, blk: 4.5 }) // 3PM 1st, rebounds 1st, assists 27th (tied with one team on 21.0), turnovers 30th (most); FG%, steals and blocks mid-table
  const { best, worst } = strengthsAndWeaknesses([...others, x], 'X')
  assert.deepEqual(best.map((b) => [b.stat.key, b.rank]), [['fg3m', 1], ['reb', 1]])
  assert.deepEqual(worst.map((b) => [b.stat.key, b.rank]), [['tov', 30], ['ast', 27]])
})

test('numbers and record are written plainly', () => {
  assert.equal(fmtRank(stat('pts'), 110.44), '110.4')
  assert.equal(fmtRank(stat('fg_pct'), 45.23), '45.2%')
  assert.deepEqual([fmtRank(stat('margin'), 3.44), fmtRank(stat('margin'), -3.44), fmtRank(stat('margin'), -0.02)], ['+3.4', '-3.4', '0.0'])
  assert.equal(recordText({ wins: 9, games: 14 }), '9-5')
  assert.equal(RANK_STATS.filter((s) => s.lowerIsBetter).map((s) => s.key).join(), 'allowed,tov')
})

test('defense summary uses the ranked list rule: 10+ opposing player-games, the biggest gives and the biggest holds', () => {
  const cell = (perGame) => ({ perGame, low: 1, high: 30, per36: 17 })
  const group = (role, label, playerGames, pts) => ({ role, label, games: 13, playerGames, minutes: 30, stats: { pts: cell(pts), reb: cell(7), ast: cell(4), fg3m: cell(1), blk: cell(0.4), stl: cell(0.6) } })
  const d = {
    team: { groups: [group('bench', 'G', 39, 20.3), group('starter', 'G', 24, 30.4), group('bench', 'F', 30, 7.8), group('starter', 'F', 26, 17.9), group('starter', 'C', 3, 9)], firstSeason: '2026-27', lastSeason: '2026-27' },
    league: { groups: [group('bench', 'G', 5000, 14.7), group('starter', 'G', 5000, 29.6), group('bench', 'F', 5000, 9.1), group('starter', 'F', 5000, 19.3), group('starter', 'C', 5000, 7)], firstSeason: '2021-22', lastSeason: '2026-27' },
  }
  const s = defenseSummary(d)
  assert.deepEqual(s.gives.map((r) => r.key), ['bench:G', 'starter:G'])
  assert.deepEqual(s.holds.map((r) => r.key), ['starter:F', 'bench:F']) // most below the league first; the 3-game center group is left out
})
