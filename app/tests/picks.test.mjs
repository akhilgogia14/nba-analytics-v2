import assert from 'node:assert/strict'
import test from 'node:test'
import { agreesWithBaseline, gradePick, orderPicks, parseLine, parsePicks, pickId, pickText, recordOf, resultFrom, withPick } from '../src/lib/picks.ts'

const pick = (o = {}) => ({ id: pickId('1', '22600001', 'pts'), playerId: '1', playerName: 'A B', team: 'NYK', opp: 'ATL', isHome: true, gameId: '22600001', gameDate: '2026-11-20', stat: 'pts', side: 'over', line: 20.5, baseline: 22, savedAt: '2026-11-19T10:00:00Z', ...o })

test('over wins above the line, under wins below it, exactly on the line is a push', () => {
  assert.deepEqual([gradePick('over', 20.5, 21), gradePick('over', 20.5, 20), gradePick('under', 20.5, 20), gradePick('under', 20.5, 21)], ['win', 'loss', 'win', 'loss'])
  assert.deepEqual([gradePick('over', 20, 20), gradePick('under', 20, 20)], ['push', 'push'])
})

test('the line is read as typed: half-steps, a comma, and nothing odd', () => {
  assert.deepEqual(['20.5', ' 6 ', '20,5', '0', '200'].map(parseLine), [20.5, 6, 20.5, 0, 200])
  assert.deepEqual(['', 'abc', '-3', '201', '1e3', '20.555', '20..5'].map(parseLine), [null, null, null, null, null, null, null])
})

const detail = (played, result, pts) => ({ played, game: { stats: { pts, reb: 1, ast: 1, fg3m: 0, blk: 0, stl: 0 } }, result })
test('a game is graded only once it is final: no team result means still open', () => {
  assert.equal(resultFrom(pick(), null), null) // game not found yet
  assert.equal(resultFrom(pick(), detail(false, null, null)), null) // not final: never grade (or void) early
  assert.deepEqual(resultFrom(pick(), detail(true, { won: true }, 24)), { outcome: 'win', actual: 24 })
  assert.deepEqual(resultFrom(pick({ side: 'under' }), detail(true, { won: true }, 24)), { outcome: 'loss', actual: 24 })
  assert.deepEqual(resultFrom(pick(), detail(false, { won: true }, null)), { outcome: 'void', actual: null }) // final and he did not play
})

test('the record counts wins, losses, pushes and voids; the hit rate leaves pushes and voids out', () => {
  const r = (outcome) => ({ outcome, actual: 1 })
  const picks = [pick({ id: 'a', result: r('win') }), pick({ id: 'b', result: r('win') }), pick({ id: 'c', result: r('loss') }), pick({ id: 'd', result: r('push') }), pick({ id: 'e', result: r('void') }), pick({ id: 'f' })]
  const rec = recordOf(picks)
  assert.deepEqual([rec.wins, rec.losses, rec.pushes, rec.voids, rec.graded, rec.pending], [2, 1, 1, 1, 5, 1])
  assert.ok(Math.abs(rec.hitRate - 2 / 3) < 1e-9)
  assert.equal(recordOf([]).hitRate, null) // nothing decided is not 0%
})

test('picks are split by whether they went with the baseline or against it', () => {
  assert.equal(agreesWithBaseline(pick({ baseline: 22, line: 20.5, side: 'over' })), true)
  assert.equal(agreesWithBaseline(pick({ baseline: 22, line: 20.5, side: 'under' })), false)
  assert.equal(agreesWithBaseline(pick({ baseline: 20.5 })), null)
  assert.equal(agreesWithBaseline(pick({ baseline: null })), null)
  const rec = recordOf([pick({ id: 'a', result: { outcome: 'win', actual: 25 } }), pick({ id: 'b', side: 'under', result: { outcome: 'loss', actual: 25 } })])
  assert.deepEqual([rec.agreed.wins, rec.agreed.losses, rec.against.wins, rec.against.losses], [1, 0, 0, 1])
})

test('saving the same player, game and stat again replaces the pick; the list shows open picks first', () => {
  const first = pick({ line: 20.5 })
  const list = withPick([first], pick({ line: 22.5 }))
  assert.equal(list.length, 1)
  assert.equal(list[0].line, 22.5)
  const open = pick({ id: 'o', gameDate: '2026-11-25' })
  const soon = pick({ id: 's', gameDate: '2026-11-21' })
  const old = pick({ id: 'x', gameDate: '2026-11-01', result: { outcome: 'win', actual: 30 } })
  const newer = pick({ id: 'y', gameDate: '2026-11-10', result: { outcome: 'loss', actual: 3 } })
  assert.deepEqual(orderPicks([old, open, newer, soon]).map((p) => p.id), ['s', 'o', 'y', 'x'])
  assert.equal(pickText(first), 'Over 20.5 points')
})

test('stored picks are checked: damaged, edited or foreign data is dropped, never trusted', () => {
  assert.deepEqual(parsePicks(null), [])
  assert.deepEqual(parsePicks('not json'), [])
  assert.deepEqual(parsePicks('{"a":1}'), [])
  const good = pick({ result: { outcome: 'win', actual: 24 } })
  const bad = [{ ...good, playerId: 'x; drop' }, { ...good, gameId: '12' }, { ...good, stat: 'minutes' }, { ...good, side: 'maybe' }, { ...good, line: 'high' }, { ...good, line: 999 }, null, 5]
  const got = parsePicks(JSON.stringify([good, ...bad]))
  assert.equal(got.length, 1)
  assert.deepEqual(got[0].result, { outcome: 'win', actual: 24 })
  assert.equal(parsePicks(JSON.stringify([{ ...good, result: { outcome: 'huge', actual: 1 }, opp: '<b>' }]))[0].result, undefined) // a made-up result is ignored
  assert.equal(parsePicks(JSON.stringify([{ ...good, opp: '<b>' }]))[0].opp, '')
})
