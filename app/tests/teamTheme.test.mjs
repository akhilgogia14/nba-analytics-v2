import test from 'node:test'
import assert from 'node:assert/strict'
import {
  MIN_ACCENT_CONTRAST, MIN_TEXT_CONTRAST, NO_LOOK, THEME_BASE, WASH_TARGET, accentFor, blend, maxReadableAlpha, mutedUnderTint,
  teamLook, washAlphaFor,
} from '../src/lib/teamTheme.ts'
import { TEAM_STYLES, contrast } from '../src/lib/teams.ts'
import { THEME } from '../src/lib/themes.ts'

const teams = Object.keys(TEAM_STYLES)

test('the readability samples still match the real theme, and the limits are the usual 4.5', () => {
  assert.equal(MIN_ACCENT_CONTRAST, 4.5)
  assert.equal(MIN_TEXT_CONTRAST, 4.5)
  assert.equal(THEME_BASE.text.toLowerCase(), THEME['--text'].toLowerCase())
  assert.equal(THEME_BASE.muted.toLowerCase(), THEME['--muted'].toLowerCase())
  assert.equal(THEME_BASE.bg.toLowerCase(), THEME['--bg'].toLowerCase())
})

test('blend: hand-worked values', () => {
  assert.equal(blend('#000000', '#ffffff', 0.5), '#808080')
  assert.equal(blend('#ff0000', '#000000', 0.2), '#330000')
  assert.equal(blend('#123456', '#ffffff', 0), '#ffffff')
  assert.equal(blend('#123456', '#ffffff', 1), '#123456')
})

test('text and muted text stay readable (contrast 4.5+) under the tint actually used, every team', () => {
  for (const t of teams) {
    const a = washAlphaFor(t)
    assert.equal(a, WASH_TARGET, `${t}: tint lowered to ${a}`) // every team gets the full tint
    const under = blend(TEAM_STYLES[t].primary, THEME_BASE.bg, a)
    for (const fg of [THEME_BASE.text, mutedUnderTint()]) {
      const c = contrast(fg, under)
      assert.ok(c >= 4.5, `${t} ${fg} on ${under}: ${c.toFixed(2)}`)
    }
  }
})

test('the lowering rule works when a team cannot take the tint', () => {
  assert.equal(maxReadableAlpha('#000000', '#ffffff', ['#000000'], 0.5), 0.5) // black text on mid-grey: readable at full
  assert.equal(maxReadableAlpha('#ff0000', '#ffffff', ['#ffffff'], 0.5), 0) // white text on white-ish: never readable
  const lowered = maxReadableAlpha('#C4CED4', THEME_BASE.bg, [THEME_BASE.text, THEME_BASE.muted], 0.9) // silver, too strong
  assert.ok(lowered > 0 && lowered < 0.9, `${lowered}`)
})

test('the adjusted muted text is a plain colour and lighter than the plain one', () => {
  assert.match(mutedUnderTint(), /^#[0-9a-f]{6}$/)
  assert.ok(contrast(mutedUnderTint(), THEME_BASE.bg) > contrast(THEME_BASE.muted, THEME_BASE.bg))
})

test('the accent colour is readable on the page and on the cards, every team', () => {
  for (const t of teams) {
    const c = accentFor(t)
    assert.ok(contrast(c, THEME_BASE.bg) >= 4.5 - 0.001, `${t} ${c} on page`)
    assert.ok(contrast(c, THEME_BASE.panel) >= 4.5 - 0.001, `${t} ${c} on cards`)
  }
})

test('accent choice: primary when it reads, secondary when it does not, theme accent as the last resort', () => {
  assert.equal(accentFor('SAS'), '#C4CED4') // silver reads on dark
  assert.equal(accentFor('NYK'), '#F58426') // blue is too dark on near-black, orange reads
  assert.equal(accentFor('BKN'), '#FFFFFF') // black vanishes on dark, white reads
  assert.equal(accentFor('ZZZ'), THEME['--accent']) // unknown team
})

test('teamLook: a CSS tint from the primary colour, and accent variables', () => {
  const l = teamLook('NYK')
  assert.equal(l.wash, 'linear-gradient(180deg, rgba(0, 107, 182, 0.32) 0px, rgba(0, 107, 182, 0) 560px)')
  assert.equal(l.vars['--accent'], '#F58426')
  assert.equal(l.vars['--median'], '#F58426')
  assert.equal(l.vars['--muted'], mutedUnderTint())
  assert.match(l.vars['--band'], /^color-mix\(in srgb, #F58426 38%, transparent\)$/)
  assert.equal(teamLook('nyk').wash, l.wash) // case does not matter
})

test('no team or an unknown team changes nothing', () => {
  for (const x of [undefined, null, '', 'ZZZ']) assert.deepEqual(teamLook(x), NO_LOOK)
  assert.deepEqual(NO_LOOK.vars, {})
})
