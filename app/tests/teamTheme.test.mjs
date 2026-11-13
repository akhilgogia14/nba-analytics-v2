import test from 'node:test'
import assert from 'node:assert/strict'
import {
  CARD_LIFT, CORE_SHARE, GLOW_SHARE, MIN_ACCENT_CONTRAST, MIN_TEXT_CONTRAST, NO_LOOK, THEME_BASE, WASH_TARGET, accentFor, beamPeak,
  blend, maxReadableScale, mutedUnderTint, teamLook, washAlphaFor,
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

// The brightest point of the beam, worked out here step by step (not by calling beamPeak): cone, then glow, then core,
// then the card's own lightening on top.
const r2 = (x) => Math.round(x * 100) / 100
function peak(team, scale) {
  const { primary, secondary } = TEAM_STYLES[team]
  let c = blend(primary, THEME_BASE.bg, r2(scale))
  c = blend(primary, c, r2(scale * 0.8))
  c = blend(secondary, c, r2(scale * 0.5))
  return blend('#ffffff', c, 0.06)
}

test('the beam constants are what the CSS and the maths below assume', () => {
  assert.equal(GLOW_SHARE, 0.8)
  assert.equal(CORE_SHARE, 0.5)
  assert.equal(CARD_LIFT, 0.06)
  assert.equal(WASH_TARGET, 0.32)
})

test('text and muted text stay readable (contrast 4.5+) at the brightest point of the beam, every team', () => {
  const scales = []
  for (const t of teams) {
    const a = washAlphaFor(t)
    scales.push(a)
    assert.ok(a <= WASH_TARGET + 1e-9, `${t}: ${a} above the target`)
    const under = peak(t, a)
    for (const fg of [THEME_BASE.text, mutedUnderTint()]) {
      const c = contrast(fg, under)
      assert.ok(c >= 4.5, `${t} ${fg} on ${under}: ${c.toFixed(2)}`)
    }
    assert.equal(beamPeak(TEAM_STYLES[t].primary, TEAM_STYLES[t].secondary, a), under) // the helper agrees with the hand maths
  }
  // The beam must still be visible: most teams get the full strength and nobody is dimmed to almost nothing.
  const full = scales.filter((a) => a === WASH_TARGET).length
  console.log(`beam: full strength for ${full} of 30 teams, weakest ${Math.min(...scales)}`)
  assert.ok(full >= 20, `only ${full} teams get the full beam`)
  assert.ok(Math.min(...scales) >= 0.15, `weakest beam ${Math.min(...scales)}`)
})

test('the lowering rule works when a team cannot take the beam', () => {
  assert.equal(maxReadableScale(() => '#808080', ['#000000'], 0.5), 0.5) // black text on mid-grey: readable at full
  assert.equal(maxReadableScale(() => '#ffffff', ['#ffffff'], 0.5), 0) // white text on white: never readable
  const hot = maxReadableScale((a) => blend('#ffffff', THEME_BASE.bg, a), [THEME_BASE.text], 0.9) // white light on dark: too strong
  assert.ok(hot > 0 && hot < 0.9, `${hot}`)
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

test('teamLook: three light layers from the right colours, the core on top', () => {
  const l = teamLook('NYK') // primary #006BB6 = 0,107,182; secondary #F58426 = 245,132,38; cone 0.32, glow 0.26, core 0.16
  assert.equal(
    l.wash,
    'conic-gradient(from 170deg at 50% -4%, transparent 0deg, rgba(245, 132, 38, 0) 2deg, rgba(245, 132, 38, 0.16) 10deg, rgba(245, 132, 38, 0) 18deg, transparent 20deg), ' +
      'radial-gradient(ellipse 38% 280px at 50% 0%, rgba(0, 107, 182, 0.26), rgba(0, 107, 182, 0)), ' +
      'conic-gradient(from 154deg at 50% -4%, transparent 0deg, rgba(0, 107, 182, 0) 4deg, rgba(0, 107, 182, 0.32) 26deg, rgba(0, 107, 182, 0) 48deg, transparent 52deg)',
  )
  assert.equal(l.vars['--accent'], '#F58426')
  assert.equal(l.vars['--median'], '#F58426')
  assert.equal(l.vars['--muted'], mutedUnderTint())
  assert.match(l.vars['--band'], /^color-mix\(in srgb, #F58426 38%, transparent\)$/)
  assert.equal(teamLook('nyk').wash, l.wash) // case does not matter
})

test('both cones point straight down (their brightest stop lands on 180 degrees) for every team', () => {
  for (const t of teams) {
    const cones = [...teamLook(t).wash.matchAll(/conic-gradient\(from (\d+)deg at 50% -4%, (.*?)\)(?=, (?:radial|conic)-gradient|$)/g)]
    assert.equal(cones.length, 2, t)
    for (const [, from, stops] of cones) {
      const stopsList = [...stops.matchAll(/rgba\((\d+), (\d+), (\d+), ([0-9.]+)\) (\d+)deg/g)].map((m) => [Number(m[4]), Number(m[5])])
      const [, atPeak] = stopsList.reduce((best, s) => (s[0] > best[0] ? s : best))
      assert.equal(Number(from) + atPeak, 180, `${t}: cone from ${from}deg peaks at ${Number(from) + atPeak}deg`)
    }
  }
})

test('no team or an unknown team changes nothing', () => {
  for (const x of [undefined, null, '', 'ZZZ']) assert.deepEqual(teamLook(x), NO_LOOK)
  assert.deepEqual(NO_LOOK.vars, {})
})

// A real CSS parser (lightningcss, which Tailwind already installs) must understand the spotlight CSS for every team.
// It leaves a value it cannot parse untouched, so "understood" means no rgba( text is left in its output.
let lightning = null
try {
  lightning = await import('lightningcss')
} catch {
  /* not installed here: the test below is skipped */
}
const fullyParsed = (value) => {
  const out = lightning.transform({ filename: 'x.css', code: Buffer.from(`.a{background-image:${value}}`), minify: true }).code.toString()
  return !out.includes('rgba(') && !out.includes('bogus') && !out.includes('170zz')
}

test('the spotlight CSS is valid: a real CSS parser fully understands it for all 30 teams', { skip: !lightning }, () => {
  for (const t of teams) assert.ok(fullyParsed(teamLook(t).wash), `${t}: not fully parsed`)
  // The check itself must be able to fail: broken versions are left unparsed.
  const w = teamLook('NYK').wash
  assert.equal(fullyParsed(w.replace('transparent 0deg', 'bogus 0deg')), false)
  assert.equal(fullyParsed(w.replace('from 170deg', 'from 170zz')), false)
})
