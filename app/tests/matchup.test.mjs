import test from 'node:test'
import assert from 'node:assert/strict'
import { focusRosterFromHash, hashFor, oppFromHash, parseHash } from '../src/lib/pages.ts'
import { ROSTER_COLUMNS, rosterNote, startsText, statText } from '../src/lib/roster.ts'
import { ROSTER_SQL, ROSTER_STATS, mapRoster } from '../server/queries.mjs'

test('the opponent travels in the address and only three capital letters are accepted', () => {
  assert.equal(oppFromHash('#/teams?team=NYK&opp=POR'), 'POR')
  assert.equal(oppFromHash('#/players?opp=BOS&team=NYK&player=12'), 'BOS')
  for (const bad of ['#/teams?team=NYK&opp=por', '#/teams?opp=POOR', "#/teams?opp='%20OR%201=1", '#/teams?opp=', '#/teams?opp=P1R', '#/teams', '']) assert.equal(oppFromHash(bad), '', bad)
  assert.deepEqual(parseHash('#/teams?team=NYK&opp=POR'), { page: 'teams', team: 'NYK' }) // the route itself is unchanged
})

test('links carry the opponent on Teams, Players and Predictions, never on Today, never the team itself, and focus only on Teams', () => {
  assert.equal(hashFor('teams', 'NYK', 'overview', '', 'POR'), '#/teams?team=NYK&opp=POR')
  assert.equal(hashFor('teams', 'NYK', 'advanced', '', 'POR'), '#/teams/advanced?team=NYK&opp=POR')
  assert.equal(hashFor('players', 'NYK', 'overview', '1628973', 'POR'), '#/players?team=NYK&player=1628973&opp=POR')
  assert.equal(hashFor('predictions', 'NYK', 'overview', '1628973', 'POR'), '#/predictions?team=NYK&player=1628973&opp=POR')
  assert.equal(hashFor('today', 'NYK', 'overview', '', 'POR'), '#/today?team=NYK')
  assert.equal(hashFor('teams', 'NYK', 'overview', '', 'NYK'), '#/teams?team=NYK') // an opponent equal to the team is dropped
  assert.equal(hashFor('teams', 'NYK', 'overview', '', 'por'), '#/teams?team=NYK') // so is a malformed one
  assert.equal(hashFor('teams', 'NYK', 'overview', '', 'POR', 'roster'), '#/teams?team=NYK&opp=POR&focus=roster')
  assert.equal(hashFor('players', 'NYK', 'overview', '', 'POR', 'roster'), '#/players?team=NYK&opp=POR') // focus is a Teams-page thing
  assert.equal(hashFor('teams', 'NYK'), '#/teams?team=NYK') // nothing changes when there is no opponent
})

test('a link built from the address, followed, gives the same team and opponent', () => {
  const h = hashFor('teams', 'CHA', 'overview', '', 'ATL', 'roster')
  assert.equal(parseHash(h).team, 'CHA')
  assert.equal(oppFromHash(h), 'ATL')
  assert.equal(focusRosterFromHash(h), true)
  assert.equal(focusRosterFromHash('#/teams?team=CHA&opp=ATL'), false)
  assert.equal(focusRosterFromHash('#/teams?focus=other'), false)
})

test('the roster query is one fixed statement: this season, regular season, last 10 games, starts counted', () => {
  assert.match(ROSTER_SQL, /FROM workspace\.nba_v2_gold\.player_form/)
  assert.match(ROSTER_SQL, /team_tricode = :team/)
  assert.match(ROSTER_SQL, /game_type = 'regular-season'/)
  assert.match(ROSTER_SQL, /row_number\(\) OVER \(PARTITION BY person_id ORDER BY game_date DESC, game_id DESC\)/)
  assert.match(ROSTER_SQL, /rn <= 10/)
  assert.match(ROSTER_SQL, /count_if\(started\)/)
  assert.match(ROSTER_SQL, /ORDER BY starts DESC, minutes DESC NULLS LAST, player_name/)
  assert.deepEqual(ROSTER_STATS, ['minutes', 'pts', 'reb', 'ast', 'fg3m', 'blk', 'stl'])
  assert.deepEqual(ROSTER_COLUMNS.map((c) => c.key), ROSTER_STATS) // the table's columns are the query's stats, in order
})

test('roster rows are mapped in the query order, with numbers as numbers and missing stats as null', () => {
  const rows = [['1', 'Jalen Brunson', '10', '10', '34.1', '28.7', '3.0', '6.4', '3.6', '0.2', '0.8'], ['2', 'Bench Guy', '4', '0', '9.5', null, '1', '0', '0', '0', '0']]
  const r = mapRoster(rows)
  assert.deepEqual(r[0], { id: '1', name: 'Jalen Brunson', games: 10, starts: 10, stats: { minutes: 34.1, pts: 28.7, reb: 3, ast: 6.4, fg3m: 3.6, blk: 0.2, stl: 0.8 } })
  assert.equal(r[1].stats.pts, null)
  assert.equal(r[1].starts, 0)
  assert.deepEqual(mapRoster([]), [])
})

test('the roster text: one decimal everywhere, a dash for nothing, "8/10" for starts', () => {
  assert.equal(statText(28.74), '28.7')
  assert.equal(statText(3), '3.0')
  assert.equal(statText(0.04), '0.0')
  assert.equal(statText(null), '-')
  assert.equal(statText(undefined), '-')
  assert.equal(startsText({ starts: 8, games: 10 }), '8/10')
  assert.equal(startsText({ starts: 0, games: 4 }), '0/4')
  assert.equal(startsText({ starts: 0, games: null }), '-')
  assert.match(rosterNote([{}, {}]), /^2 players\./)
  assert.match(rosterNote(null), /last 10 games played/)
})
