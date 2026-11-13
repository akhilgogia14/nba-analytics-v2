import { contrast, teamStyle } from './teams.ts'
import { THEME } from './themes.ts'

/**
 * Sample colours of the dark theme, used only for the readability maths below. The page itself keeps using the
 * theme's CSS variables; a test checks that the text and muted colours here still match themes.ts.
 * bg and panel are solid stand-ins (the real panel is see-through).
 */
export const THEME_BASE = { bg: '#070A12', panel: '#10131B', text: '#EAF0FF', muted: '#9FB0CC' }

/** How bright the main cone of light is at its centre (0 to 1). Teams that cannot take it are lowered. */
export const WASH_TARGET = 0.32
/** The glow where the light starts and the thin core of the beam, as a share of the cone's brightness. */
export const GLOW_SHARE = 0.8
export const CORE_SHARE = 0.5
/** The see-through cards lighten whatever is behind them by about this much (white at this strength). */
export const CARD_LIFT = 0.06
/** Normal and muted text must keep at least this contrast on the tinted page (4.5 is the usual rule). */
export const MIN_TEXT_CONTRAST = 4.5
/** Smallest contrast an accent colour must have against both the page and the cards (normal text: 4.5). */
export const MIN_ACCENT_CONTRAST = 4.5
/** With a team look on, the grey "muted" text moves this share of the way toward the main text colour. */
export const MUTED_TOWARD_TEXT = 0.5

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))

/** The colour you see when `top` is laid over `under` at the given strength. */
export function blend(top: string, under: string, alpha: number): string {
  const a = rgb(top)
  const b = rgb(under)
  return '#' + a.map((v, i) => Math.round(v * alpha + b[i] * (1 - alpha)).toString(16).padStart(2, '0')).join('')
}

/** The muted text colour used under the spotlight, lighter than the plain one. A plain hex value. */
export function mutedUnderTint(): string {
  return blend(THEME_BASE.text, THEME_BASE.muted, MUTED_TOWARD_TEXT)
}

/** Lays a colour over another at a strength, rounded the way the CSS writes it. */
const alphaOf = (a: number) => Math.round(a * 100) / 100

/**
 * The colour at the brightest point of the beam (top, middle): the cone, the glow and the core all stack there.
 * It is a worst case: everywhere else the light is dimmer. `lift` adds the card's own lightening on top.
 */
export function beamPeak(primary: string, secondary: string, scale: number, lift = true): string {
  let c = blend(primary, THEME_BASE.bg, alphaOf(scale))
  c = blend(primary, c, alphaOf(scale * GLOW_SHARE))
  c = blend(secondary, c, alphaOf(scale * CORE_SHARE))
  return lift ? blend('#ffffff', c, CARD_LIFT) : c
}

/** The strongest scale (up to the target) under which both text colours stay readable at the peak; 0 if none does. */
export function maxReadableScale(peakAt: (scale: number) => string, texts: string[], target: number): number {
  for (let a = target; a > 0; a = Math.round((a - 0.01) * 100) / 100) {
    const under = peakAt(a)
    if (texts.every((c) => contrast(c, under) >= MIN_TEXT_CONTRAST)) return a
  }
  return 0
}

/** The cone brightness used for this team. */
export function washAlphaFor(abbrev: string | null | undefined): number {
  const s = teamStyle(abbrev)
  return maxReadableScale((a) => beamPeak(s.primary, s.secondary, a), [THEME_BASE.text, mutedUnderTint()], WASH_TARGET)
}

const KNOWN = new Set(
  'ATL BKN BOS CHA CHI CLE DAL DEN DET GSW HOU IND LAC LAL MEM MIA MIL MIN NOP NYK OKC ORL PHI PHX POR SAC SAS TOR UTA WAS'.split(' '),
)
const isKnown = (abbrev: string | null | undefined): abbrev is string => !!abbrev && KNOWN.has(abbrev.toUpperCase())

/** The team colour to use as accent text/marks: primary, else secondary, else the theme's own accent. */
export function accentFor(abbrev: string | null | undefined): string {
  if (!isKnown(abbrev)) return THEME['--accent']
  const s = teamStyle(abbrev)
  for (const c of [s.primary, s.secondary]) {
    if (contrast(c, THEME_BASE.bg) >= MIN_ACCENT_CONTRAST && contrast(c, THEME_BASE.panel) >= MIN_ACCENT_CONTRAST) return c
  }
  return THEME['--accent']
}

export type TeamLook = {
  /** The CSS background of the spotlight layer, drawn behind the page content. */
  wash: string
  /** CSS variables that replace the theme's accent colours. */
  vars: Record<string, string>
}

/** No team chosen yet (or an unknown one): nothing changes, the theme looks exactly as it did. */
export const NO_LOOK: TeamLook = { wash: 'none', vars: {} }

export function teamLook(abbrev: string | null | undefined): TeamLook {
  if (!isKnown(abbrev)) return NO_LOOK
  const s = teamStyle(abbrev)
  const [pr, pg, pb] = rgb(s.primary)
  const [sr, sg, sb] = rgb(s.secondary)
  const a = washAlphaFor(abbrev)
  const accent = accentFor(abbrev)
  const P = (alpha: number) => `rgba(${pr}, ${pg}, ${pb}, ${alphaOf(alpha)})`
  const S = (alpha: number) => `rgba(${sr}, ${sg}, ${sb}, ${alphaOf(alpha)})`
  return {
    // Light from a point just above the top-middle, pointing straight down (180deg). Each cone fades out at its edges.
    wash: [
      `conic-gradient(from 170deg at 50% -4%, transparent 0deg, ${S(0)} 2deg, ${S(a * CORE_SHARE)} 10deg, ${S(0)} 18deg, transparent 20deg)`,
      `radial-gradient(ellipse 38% 280px at 50% 0%, ${P(a * GLOW_SHARE)}, ${P(0)})`,
      `conic-gradient(from 154deg at 50% -4%, transparent 0deg, ${P(0)} 4deg, ${P(a)} 26deg, ${P(0)} 48deg, transparent 52deg)`,
    ].join(', '),
    vars: {
      '--muted': mutedUnderTint(),
      '--accent': accent,
      '--median': accent,
      '--band': `color-mix(in srgb, ${accent} 38%, transparent)`,
      '--whisker': `color-mix(in srgb, ${accent} 65%, transparent)`,
    },
  }
}
