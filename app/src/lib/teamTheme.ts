import { contrast, teamStyle } from './teams.ts'
import type { ThemeKey } from './themes.ts'

/**
 * Sample colours of each theme, used only for the readability maths below. The page itself keeps using the theme's
 * CSS variables; a test checks that the text and muted colours here still match themes.ts.
 * bg and panel are solid stand-ins for the gradients and see-through panels some themes use.
 */
export const THEME_BASE: Record<ThemeKey, { bg: string; panel: string; text: string; muted: string }> = {
  paper: { bg: '#F6F5F1', panel: '#FFFFFF', text: '#1B1F24', muted: '#5B6470' },
  midnight: { bg: '#070A12', panel: '#10131B', text: '#EAF0FF', muted: '#9FB0CC' },
  graphite: { bg: '#111111', panel: '#1A1A19', text: '#F3EEE4', muted: '#A8A093' },
  aurora: { bg: '#EEF2FF', panel: '#F4F5FD', text: '#111827', muted: '#4B5563' },
}

/** The tint strength we would like (0 to 1). Dark themes need more to show at all. Teams that cannot take it are lowered. */
export const WASH_TARGET: Record<ThemeKey, number> = { paper: 0.22, aurora: 0.22, midnight: 0.32, graphite: 0.3 }
/** Normal and muted text must keep at least this contrast on the tinted page (4.5 is the usual rule). */
export const MIN_TEXT_CONTRAST = 4.5
/** The tint fades out over this many pixels. */
export const WASH_HEIGHT = 560
/** Smallest contrast an accent colour must have against both the page and the cards (normal text: 4.5). */
export const MIN_ACCENT_CONTRAST = 4.5

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))

/** The colour you see when `top` is laid over `under` at the given strength. */
export function blend(top: string, under: string, alpha: number): string {
  const a = rgb(top)
  const b = rgb(under)
  return '#' + a.map((v, i) => Math.round(v * alpha + b[i] * (1 - alpha)).toString(16).padStart(2, '0')).join('')
}

/** With a team look on, the grey "muted" text moves this share of the way toward the main text colour. */
export const MUTED_TOWARD_TEXT = 0.5

/** The muted text colour used under a team tint: darker on light themes, lighter on dark ones. A plain hex value. */
export function mutedFor(theme: ThemeKey): string {
  const base = THEME_BASE[theme]
  return blend(base.text, base.muted, MUTED_TOWARD_TEXT)
}

/** The strongest tint (up to the target) under which both text colours keep the minimum contrast; 0 if none does. */
export function maxReadableAlpha(primary: string, bg: string, texts: string[], target: number): number {
  for (let a = target; a > 0; a = Math.round((a - 0.01) * 100) / 100) {
    const under = blend(primary, bg, a)
    if (texts.every((c) => contrast(c, under) >= MIN_TEXT_CONTRAST)) return a
  }
  return 0
}

/** The tint strength used for this team on this theme. */
export function washAlphaFor(abbrev: string | null | undefined, theme: ThemeKey): number {
  const base = THEME_BASE[theme]
  return maxReadableAlpha(teamStyle(abbrev).primary, base.bg, [base.text, mutedFor(theme)], WASH_TARGET[theme])
}

/** The team colour to use as accent text/marks on this theme: primary, else secondary, else the theme's own accent. */
export function accentFor(abbrev: string | null | undefined, theme: ThemeKey, themeAccent: string): string {
  if (!abbrev || !(abbrev.toUpperCase() in LOOKUP)) return themeAccent
  const base = THEME_BASE[theme]
  const s = teamStyle(abbrev)
  for (const c of [s.primary, s.secondary]) {
    if (contrast(c, base.bg) >= MIN_ACCENT_CONTRAST && contrast(c, base.panel) >= MIN_ACCENT_CONTRAST) return c
  }
  return themeAccent
}

export type TeamLook = {
  /** A CSS background layer to put on top of the theme's own background. */
  wash: string
  /** CSS variables that replace the theme's accent colours. */
  vars: Record<string, string>
}

/** No team chosen yet (or an unknown one): nothing changes, the theme looks exactly as it did. */
export const NO_LOOK: TeamLook = { wash: 'none', vars: {} }

export function teamLook(abbrev: string | null | undefined, theme: ThemeKey, themeAccent: string): TeamLook {
  if (!abbrev || !(abbrev.toUpperCase() in LOOKUP)) return NO_LOOK
  const s = teamStyle(abbrev)
  const [r, g, b] = rgb(s.primary)
  const accent = accentFor(abbrev, theme, themeAccent)
  return {
    wash: `linear-gradient(180deg, rgba(${r}, ${g}, ${b}, ${washAlphaFor(abbrev, theme)}) 0px, rgba(${r}, ${g}, ${b}, 0) ${WASH_HEIGHT}px)`,
    vars: {
      '--muted': mutedFor(theme),
      '--accent': accent,
      '--median': accent,
      '--band': `color-mix(in srgb, ${accent} 38%, transparent)`,
      '--whisker': `color-mix(in srgb, ${accent} 65%, transparent)`,
    },
  }
}

// The known teams (so an unknown abbreviation gets no tint instead of the grey fallback).
const LOOKUP: Record<string, true> = Object.fromEntries(
  'ATL BKN BOS CHA CHI CLE DAL DEN DET GSW HOU IND LAC LAL MEM MIA MIL MIN NOP NYK OKC ORL PHI PHX POR SAC SAS TOR UTA WAS'
    .split(' ')
    .map((t) => [t, true as const]),
)
