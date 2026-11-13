import assert from 'node:assert/strict'
import test from 'node:test'
import { meetingsNote, seasonTag } from '../src/lib/meetings.ts'

const g = (kind) => ({ kind })
const m = (scope, kinds, currentSeason = '2026-27') => ({ scope, currentSeason, games: kinds.map(g) })

test('season: says all games this season and mentions no earlier season', () => {
  const note = meetingsNote(m('season', Array(8).fill('this')), 'BOS', 'games')
  assert.equal(note, 'All 8 games against BOS in 2026-27.')
})

test('filled: counts this season and last season and says the last-season games are marked', () => {
  const note = meetingsNote(m('filled', ['this', 'this', 'last', 'last', 'last']), 'BOS', 'games')
  assert.equal(note, '2 games against BOS in 2026-27, plus 3 from last season to fill it out. The last-season games are marked.')
})

test('filled: one game is singular', () => {
  const note = meetingsNote(m('filled', ['this', 'last', 'last']), 'BOS', 'games')
  assert.equal(note, '1 game against BOS in 2026-27, plus 2 from last season to fill it out. The last-season games are marked.')
})

test('earlier: says none yet this season, then the meetings from last season', () => {
  assert.equal(meetingsNote(m('earlier', ['last', 'last', 'last']), 'LAL', 'playoff games'),
    'No playoff games against LAL in 2026-27 yet. These are his 3 meetings from last season, marked as such.')
  assert.equal(meetingsNote(m('earlier', ['last']), 'LAL', 'games'), 'No games against LAL in 2026-27 yet. These are his 1 meeting from last season, marked as such.')
})

test('none: only older meetings exist -> says nothing this or last season; never met -> nothing on record', () => {
  assert.equal(meetingsNote({ scope: 'none', currentSeason: '2026-27', games: [] }, 'LAL', 'games'), 'No games against LAL in 2026-27 or last season.')
  assert.equal(meetingsNote({ scope: 'none', currentSeason: null, games: [] }, 'LAL', 'games'), 'No games against LAL on record for this player.')
})

test('seasonTag: last season is spelled out, this season is plain', () => {
  assert.equal(seasonTag('last', '2025-26'), 'Last season · 2025-26')
  assert.equal(seasonTag('this', '2026-27'), '2026-27')
})
