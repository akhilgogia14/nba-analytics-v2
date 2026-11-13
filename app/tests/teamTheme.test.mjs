import test from 'node:test'
import assert from 'node:assert/strict'
import { MIN_ACCENT_CONTRAST, NO_LOOK, THEME_BASE, WASH_TARGET, accentFor, blend, maxReadableAlpha, mutedFor, teamLook, washAlphaFor } from '../src/lib/teamTheme.ts'
import { TEAM_STYLES, contrast } from '../src/lib/teams.ts'
import { THEMES, THEME_ORDER } from '../src/lib/themes.ts'

const teams = Object.keys(TEAM_STYLES)

test('the readability samples still match the real themes, and the limits are the usual 4.5', () => {
  assert.equal(MIN_ACCENT_CONTRAST, 4.5)
  for (const k of THEME_ORDER) {
    assert.equal(THEME_BASE[k].text.toLowerCase(), THEMES[k].vars['--text'].toLowerCase(), `${k} text`)
    assert.equal(THEME_BASE[k].muted.toLowerCase(), THEMES[k].vars['--muted'].toLowerCase(), `${k} muted`)
  }
})

test('blend: hand-worked values', () => {
  assert.equal(blend('#000000', '#ffffff', 0.5), '#808080')
  assert.equal(blend('#ff0000', '#000000', 0.2), '#330000')
  assert.equal(blend('#123456', '#ffffff', 0), '#ffffff')
  assert.equal(blend('#123456', '#ffffff', 1), '#123456')
})

test('text and muted text stay readable (contrast 4.5+) under the tint actually used, every team on every theme', () => {
  for (const k of THEME_ORDER) {
    for (const t of teams) {
      const a = washAlphaFor(t, k)
      assert.equal(a, WASH_TARGET[k], `${k} ${t}: tint lowered to ${a}`) // every team gets the full tint
      const under = blend(TEAM_STYLES[t].primary, THEME_BASE[k].bg, a)
      for (const fg of [THEME_BASE[k].text, mutedFor(k)]) {
        const c = contrast(fg, under)
        assert.ok(c >= 4.5, `${k} ${t} ${fg} on ${under}: ${c.toFixed(2)}`)
      }
    }
  }
})

test('without the muted-text adjustment some teams could not take the tint (why the adjustment exists)', () => {
  const paper = THEME_BASE.paper
  const plain = maxReadableAlpha(TEAM_STYLES.ATL.primary, paper.bg, [paper.text, paper.muted], WASH_TARGET.paper)
  assert.ok(plain < WASH_TARGET.paper && plain >= 0.05, `plain muted text: ${plain}`)
  assert.equal(maxReadableAlpha('#000000', '#ffffff', ['#000000'], 0.5), 0.5) // black text on mid-grey: readable at full
  assert.equal(maxReadableAlpha('#ff0000', '#ffffff', ['#ffffff'], 0.5), 0) // white text on white-ish: never readable -> no tint
})

test('the adjusted muted text is a plain colour, darker on light themes and lighter on dark ones', () => {
  for (const k of THEME_ORDER) assert.match(mutedFor(k), /^#[0-9a-f]{6}$/)
  assert.ok(contrast(mutedFor('paper'), THEME_BASE.paper.bg) > contrast(THEME_BASE.paper.muted, THEME_BASE.paper.bg))
  assert.ok(contrast(mutedFor('midnight'), THEME_BASE.midnight.bg) > contrast(THEME_BASE.midnight.muted, THEME_BASE.midnight.bg))
})

test('the accent colour is readable on the page and on the cards, every team on every theme', () => {
  for (const k of THEME_ORDER) {
    for (const t of teams) {
      const c = accentFor(t, k, THEMES[k].vars['--accent'])
      assert.ok(contrast(c, THEME_BASE[k].bg) >= 4.5 - 0.001, `${k} ${t} ${c} on page`)
      assert.ok(contrast(c, THEME_BASE[k].panel) >= 4.5 - 0.001, `${k} ${t} ${c} on cards`)
    }
  }
})

test('accent choice: primary when it reads, secondary when it does not, theme accent as the last resort', () => {
  assert.equal(accentFor('NYK', 'paper', '#1F5FBF'), '#006BB6') // blue reads on paper
  assert.equal(accentFor('NYK', 'graphite', '#D4AF6A'), '#F58426') // blue is too dark on graphite, orange reads
  assert.equal(accentFor('SAS', 'paper', '#1F5FBF'), '#000000') // silver is too light on paper, black reads
  assert.equal(accentFor('BKN', 'midnight', '#5EEAD4'), '#FFFFFF') // black vanishes on midnight, white reads
  assert.equal(accentFor('ZZZ', 'paper', '#1F5FBF'), '#1F5FBF') // unknown team
})

test('teamLook: a CSS tint from the primary colour, and accent variables', () => {
  const l = teamLook('NYK', 'paper', '#1F5FBF')
  assert.equal(l.wash, 'linear-gradient(180deg, rgba(0, 107, 182, 0.22) 0px, rgba(0, 107, 182, 0) 560px)')
  assert.equal(l.vars['--accent'], '#006BB6')
  assert.equal(l.vars['--median'], '#006BB6')
  assert.match(l.vars['--band'], /^color-mix\(in srgb, #006BB6 38%, transparent\)$/)
  assert.equal(teamLook('nyk', 'paper', '#1F5FBF').wash, l.wash) // case does not matter
})

test('no team or an unknown team changes nothing', () => {
  for (const x of [undefined, null, '', 'ZZZ']) assert.deepEqual(teamLook(x, 'paper', '#1F5FBF'), NO_LOOK)
  assert.deepEqual(NO_LOOK.vars, {})
})
