import { contrast, teamStyle } from './teams.ts'
import { THEME } from './themes.ts'

/**
 * Sample colours of the dark theme, used only for the readability maths below. The page itself keeps using the
 * theme's CSS variables; a test checks that the text and muted colours here still match themes.ts.
 * bg and panel are solid stand-ins (the real panel is see-through).
 */
export const THEME_BASE = { bg: '#070A12', panel: '#10131B', text: '#EAF0FF', muted: '#9FB0CC' }

/** How strongly the team colour tints the top of the page (0 to 1). Teams that cannot take it are lowered. */
export const WASH_TARGET = 0.32
/** The tint fades out over this many pixels. */
export const WASH_HEIGHT = 560
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

/** The muted text colour used under a team tint, lighter than the plain one. A plain hex value. */
export function mutedUnderTint(): string {
  return blend(THEME_BASE.text, THEME_BASE.muted, MUTED_TOWARD_TEXT)
}

/** The strongest tint (up to the target) under which both text colours keep the minimum contrast; 0 if none does. */
export function maxReadableAlpha(primary: string, bg: string, texts: string[], target: number): number {
  for (let a = target; a > 0; a = Math.round((a - 0.01) * 100) / 100) {
    const under = blend(primary, bg, a)
    if (texts.every((c) => contrast(c, under) >= MIN_TEXT_CONTRAST)) return a
  }
  return 0
}

/** The tint strength used for this team. */
export function washAlphaFor(abbrev: string | null | undefined): number {
  return maxReadableAlpha(teamStyle(abbrev).primary, THEME_BASE.bg, [THEME_BASE.text, mutedUnderTint()], WASH_TARGET)
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
  /** A CSS background layer to put on top of the theme's own background. */
  wash: string
  /** CSS variables that replace the theme's accent colours. */
  vars: Record<string, string>
}

/** No team chosen yet (or an unknown one): nothing changes, the theme looks exactly as it did. */
export const NO_LOOK: TeamLook = { wash: 'none', vars: {} }

export function teamLook(abbrev: string | null | undefined): TeamLook {
  if (!isKnown(abbrev)) return NO_LOOK
  const [r, g, b] = rgb(teamStyle(abbrev).primary)
  const accent = accentFor(abbrev)
  return {
    wash: `linear-gradient(180deg, rgba(${r}, ${g}, ${b}, ${washAlphaFor(abbrev)}) 0px, rgba(${r}, ${g}, ${b}, 0) ${WASH_HEIGHT}px)`,
    vars: {
      '--muted': mutedUnderTint(),
      '--accent': accent,
      '--median': accent,
      '--band': `color-mix(in srgb, ${accent} 38%, transparent)`,
      '--whisker': `color-mix(in srgb, ${accent} 65%, transparent)`,
    },
  }
}
