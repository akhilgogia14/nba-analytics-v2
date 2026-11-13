import test from 'node:test'
import assert from 'node:assert/strict'
import {
  TEAM_IDS, TEAM_STYLES, contrast, headshotUrl, initials, luminance, readableOn, teamLogoUrl, teamStyle,
} from '../src/lib/teams.ts'

// Pasted from the real table (select team_tricode, team_id from silver team_game, 30 rows, one id each).
const REAL_IDS = `ATL 1610612737, BKN 1610612751, BOS 1610612738, CHA 1610612766, CHI 1610612741, CLE 1610612739,
DAL 1610612742, DEN 1610612743, DET 1610612765, GSW 1610612744, HOU 1610612745, IND 1610612754, LAC 1610612746,
LAL 1610612747, MEM 1610612763, MIA 1610612748, MIL 1610612749, MIN 1610612750, NOP 1610612740, NYK 1610612752,
OKC 1610612760, ORL 1610612753, PHI 1610612755, PHX 1610612756, POR 1610612757, SAC 1610612758, SAS 1610612759,
TOR 1610612761, UTA 1610612762, WAS 1610612764`

test('team ids match the real team_game table, all 30', () => {
  const real = Object.fromEntries(REAL_IDS.split(',').map((s) => s.trim().split(/\s+/)).map(([k, v]) => [k, Number(v)]))
  assert.equal(Object.keys(real).length, 30)
  assert.deepEqual(TEAM_IDS, real)
})

test('every team has colours and a logo address, with 30 distinct ids', () => {
  const teams = Object.keys(TEAM_IDS)
  assert.equal(teams.length, 30)
  assert.deepEqual(Object.keys(TEAM_STYLES).sort(), teams.slice().sort())
  assert.equal(new Set(Object.values(TEAM_IDS)).size, 30)
  for (const t of teams) {
    assert.match(TEAM_STYLES[t].primary, /^#[0-9A-F]{6}$/i)
    assert.match(TEAM_STYLES[t].secondary, /^#[0-9A-F]{6}$/i)
    assert.equal(teamLogoUrl(t), `https://cdn.nba.com/logos/nba/${TEAM_IDS[t]}/global/L/logo.svg`)
  }
})

test('image addresses: exact strings, and nothing odd gets into them', () => {
  assert.equal(teamLogoUrl('NYK'), 'https://cdn.nba.com/logos/nba/1610612752/global/L/logo.svg')
  assert.equal(teamLogoUrl('nyk'), 'https://cdn.nba.com/logos/nba/1610612752/global/L/logo.svg')
  assert.equal(teamLogoUrl('XXX'), null)
  assert.equal(teamLogoUrl(null), null)
  assert.equal(headshotUrl('1628973'), 'https://cdn.nba.com/headshots/nba/latest/1040x760/1628973.png')
  assert.equal(headshotUrl(1628973), 'https://cdn.nba.com/headshots/nba/latest/1040x760/1628973.png')
  for (const bad of ['', 'abc', '12a', '../x', '1628973/../../a', '1/../2', '12/34', '1.5', '../1', '-5', '1234567890123', null, undefined]) {
    assert.equal(headshotUrl(bad), null, `should reject ${JSON.stringify(bad)}`)
  }
})

test('luminance and contrast: the WCAG end points', () => {
  assert.equal(luminance('#ffffff'), 1)
  assert.equal(luminance('#000000'), 0)
  assert.equal(Math.round(contrast('#ffffff', '#000000')), 21)
  assert.equal(contrast('#123456', '#123456'), 1)
})

test('readableOn picks white on dark and near-black on light', () => {
  assert.equal(readableOn('#1D1D1D'), '#ffffff') // Nets
  assert.equal(readableOn('#0E2240'), '#ffffff') // Nuggets
  assert.equal(readableOn('#C4CED4'), '#0a0a0b') // Spurs silver
  assert.equal(readableOn('#FDB927'), '#0a0a0b') // Lakers gold
})

test('text is readable on every team colour (contrast of at least 4.5)', () => {
  for (const [team, s] of Object.entries(TEAM_STYLES)) {
    for (const fill of [s.primary, s.secondary]) {
      assert.ok(contrast(fill, readableOn(fill)) >= 4.5, `${team} ${fill}: ${contrast(fill, readableOn(fill)).toFixed(2)}`)
    }
  }
})

test('teamStyle falls back for an unknown team; initials', () => {
  assert.equal(teamStyle('NYK').primary, '#006BB6')
  assert.equal(teamStyle('zzz').primary, '#3f3f46')
  assert.equal(teamStyle(undefined).primary, '#3f3f46')
  assert.equal(initials('Jalen Brunson'), 'JB')
  assert.equal(initials('Nene'), 'NE')
  assert.equal(initials('  '), '?')
})
