import assert from 'node:assert/strict'
import test from 'node:test'
import { meetingsNote, seasonTag } from '../src/lib/meetings.ts'

const g = (kind) => ({ kind })
const m = (scope, kinds, currentSeason = '2026-27') => ({ scope, currentSeason, games: kinds.map(g) })

test('season: says all games this season and mentions no earlier season', () => {
  const note = meetingsNote(m('season', Array(8).fill('this')), 'BOS', 'games')
  assert.equal(note, 'All 8 games against BOS in 2026-27.')
})

test('filled: counts this season, last season and older games and says the earlier ones are marked', () => {
  const note = meetingsNote(m('filled', ['this', 'this', 'last', 'last', 'last', 'older', 'older']), 'BOS', 'games')
  assert.equal(note, '2 games against BOS in 2026-27, plus 3 from last season and 2 from older seasons to fill it out. The earlier games are marked.')
})

test('filled: one game is singular, and a fill only from last season does not mention older seasons', () => {
  const note = meetingsNote(m('filled', ['this', 'last', 'last']), 'BOS', 'games')
  assert.equal(note, '1 game against BOS in 2026-27, plus 2 from last season to fill it out. The earlier games are marked.')
})

test('earlier: says none yet this season, then the last N meetings and where they are from', () => {
  const note = meetingsNote(m('earlier', ['last', 'last', 'older']), 'LAL', 'playoff games')
  assert.equal(note, 'No playoff games against LAL in 2026-27 yet. These are the last 3 meetings, 2 from last season and 1 from older seasons. The earlier games are marked.')
})

test('none: says there is nothing on record', () => {
  assert.equal(meetingsNote({ scope: 'none', currentSeason: null, games: [] }, 'LAL', 'games'), 'No games against LAL on record for this player.')
})

test('seasonTag: last season is spelled out, older seasons show the season, this season is plain', () => {
  assert.equal(seasonTag('last', '2025-26'), 'Last season · 2025-26')
  assert.equal(seasonTag('older', '2023-24'), '2023-24')
  assert.equal(seasonTag('this', '2026-27'), '2026-27')
})
