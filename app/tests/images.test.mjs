import test from 'node:test'
import assert from 'node:assert/strict'
import { avatarView, badgeView } from '../src/lib/images.ts'

test('avatar: the headshot address while it works, initials when it failed or there is no id', () => {
  assert.deepEqual(avatarView('Jalen Brunson', '1628973', false), {
    src: 'https://cdn.nba.com/headshots/nba/latest/1040x760/1628973.png', initials: 'JB',
  })
  assert.deepEqual(avatarView('Jalen Brunson', '1628973', true), { src: null, initials: 'JB' })
  assert.deepEqual(avatarView('Jalen Brunson', '', false), { src: null, initials: 'JB' })
  assert.deepEqual(avatarView('Jalen Brunson', '../x', false), { src: null, initials: 'JB' })
})

test('badge: the logo while it works, a readable coloured badge when it failed or the team is unknown', () => {
  const ok = badgeView('NYK', false)
  assert.equal(ok.src, 'https://cdn.nba.com/logos/nba/1610612752/global/L/logo.svg')
  assert.equal(ok.label, 'NYK')
  const failed = badgeView('NYK', true)
  assert.equal(failed.src, null)
  assert.deepEqual([failed.bg, failed.fg, failed.ring], ['#006BB6', '#ffffff', '#F58426'])
  const light = badgeView('SAS', true) // silver: needs dark letters
  assert.deepEqual([light.bg, light.fg], ['#C4CED4', '#0a0a0b'])
  const unknown = badgeView('zzz', false)
  assert.equal(unknown.src, null)
  assert.equal(unknown.label, 'ZZZ')
  assert.equal(unknown.bg, '#3f3f46')
  assert.equal(badgeView(undefined, false).label, '?')
})
