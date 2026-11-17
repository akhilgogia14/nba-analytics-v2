import assert from 'node:assert/strict'
import test from 'node:test'
import { MEETINGS_COUNT, meetingsNote, meetingsNoteFor, seasonTag } from '../src/lib/meetings.ts'

const g = (kind, seasonLabel = kind === 'this' ? '2026-27' : '2024-25') => ({ kind, seasonLabel })
const m = (scope, games, currentSeason = '2026-27') => ({ scope, currentSeason, games })

test('the page shows at most 10 meetings, the same number the server asks for', () => {
  assert.equal(MEETINGS_COUNT, 10)
})

test('season: ten from this season says "the last 10"; fewer says "all N on record"', () => {
  assert.equal(meetingsNote(m('season', Array(10).fill(g('this'))), 'BOS', 'games'), 'The last 10 games against BOS, all in 2026-27.')
  assert.equal(meetingsNote(m('season', Array(4).fill(g('this'))), 'BOS', 'games'), 'All 4 games against BOS on record, all in 2026-27.')
})

test('filled: counts this season and the earlier seasons, names them, and says they are marked', () => {
  const games = [g('this'), g('this'), g('earlier', '2025-26'), g('earlier', '2023-24'), g('earlier', '2021-22'), ...Array(5).fill(g('earlier', '2022-23'))]
  assert.equal(meetingsNote(m('filled', games), 'BOS', 'games'),
    'The last 10 games against BOS: 2 in 2026-27, plus 8 from earlier seasons (2021-22 to 2025-26), which are marked.')
  assert.equal(meetingsNote(m('filled', [g('this'), g('earlier', '2024-25'), g('earlier', '2024-25')]), 'BOS', 'games'),
    'All 3 games against BOS on record: 1 in 2026-27, plus 2 from earlier seasons (2024-25), which are marked.')
})

test('earlier: says none yet this season, then the last meetings and the seasons they come from', () => {
  assert.equal(meetingsNote(m('earlier', [g('earlier', '2025-26'), g('earlier', '2022-23'), g('earlier', '2022-23')]), 'LAL', 'playoff games'),
    'No playoff games against LAL in 2026-27 yet. These are his last 3 meetings, from 2022-23 to 2025-26, marked as such.')
  assert.equal(meetingsNote(m('earlier', [g('earlier', '2023-24')]), 'LAL', 'games'), 'No games against LAL in 2026-27 yet. These are his 1 meeting, from 2023-24, marked as such.')
})

test('the team page uses the same wording with "the team\'s"; never met -> nothing on record', () => {
  assert.equal(meetingsNoteFor(m('earlier', [g('earlier', '2024-25')]), 'LAL', 'games', "the team's"), "No games against LAL in 2026-27 yet. These are the team's 1 meeting, from 2024-25, marked as such.")
  assert.equal(meetingsNote({ scope: 'none', currentSeason: null, games: [] }, 'LAL', 'games'), 'No games against LAL on record for this player.')
  assert.equal(meetingsNoteFor({ scope: 'none', currentSeason: null, games: [] }, 'LAL', 'games', "the team's"), 'No games against LAL on record for this team.')
  assert.doesNotMatch(meetingsNote(m('filled', [g('this'), g('earlier')]), 'BOS', 'games'), /last season/i) // the old "last season only" wording is gone
})

test('seasonTag: earlier seasons are spelled out, the current season is plain', () => {
  assert.equal(seasonTag('earlier', '2022-23'), 'Earlier · 2022-23')
  assert.equal(seasonTag('this', '2026-27'), '2026-27')
})
