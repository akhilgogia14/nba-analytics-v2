// Team colours, team ids and the public image addresses. Nothing is stored in the repo: the images are loaded
// from the NBA's public image server when the page opens, and the page falls back to initials or a letter badge
// if one does not load. Colours and the readable-text helper are carried over from v1.

export type TeamStyle = { primary: string; secondary: string }

export const TEAM_STYLES: Record<string, TeamStyle> = {
  ATL: { primary: '#E03A3E', secondary: '#C1D32F' }, BOS: { primary: '#007A33', secondary: '#BA9653' },
  BKN: { primary: '#1D1D1D', secondary: '#FFFFFF' }, CHA: { primary: '#1D1160', secondary: '#00788C' },
  CHI: { primary: '#CE1141', secondary: '#000000' }, CLE: { primary: '#860038', secondary: '#FDBB30' },
  DAL: { primary: '#00538C', secondary: '#B8C4CA' }, DEN: { primary: '#0E2240', secondary: '#FEC524' },
  DET: { primary: '#C8102E', secondary: '#1D42BA' }, GSW: { primary: '#1D428A', secondary: '#FFC72C' },
  HOU: { primary: '#CE1141', secondary: '#C4CED4' }, IND: { primary: '#002D62', secondary: '#FDBB30' },
  LAC: { primary: '#C8102E', secondary: '#1D428A' }, LAL: { primary: '#552583', secondary: '#FDB927' },
  MEM: { primary: '#5D76A9', secondary: '#12173F' }, MIA: { primary: '#98002E', secondary: '#F9A01B' },
  MIL: { primary: '#00471B', secondary: '#EEE1C6' }, MIN: { primary: '#0C2340', secondary: '#236192' },
  NOP: { primary: '#0C2340', secondary: '#C8102E' }, NYK: { primary: '#006BB6', secondary: '#F58426' },
  OKC: { primary: '#007AC1', secondary: '#EF3B24' }, ORL: { primary: '#0077C0', secondary: '#C4CED4' },
  PHI: { primary: '#006BB6', secondary: '#ED174C' }, PHX: { primary: '#1D1160', secondary: '#E56020' },
  POR: { primary: '#E03A3E', secondary: '#000000' }, SAC: { primary: '#5A2D81', secondary: '#63727A' },
  SAS: { primary: '#C4CED4', secondary: '#000000' }, TOR: { primary: '#CE1141', secondary: '#000000' },
  UTA: { primary: '#002B5C', secondary: '#F9A01B' }, WAS: { primary: '#002B5C', secondary: '#E31837' },
}

export const FALLBACK_STYLE: TeamStyle = { primary: '#3f3f46', secondary: '#a1a1aa' }

export function teamStyle(abbrev: string | null | undefined): TeamStyle {
  return (abbrev && TEAM_STYLES[abbrev.toUpperCase()]) || FALLBACK_STYLE
}

/** The NBA's team ids, the same as team_id in silver team_game (checked against the real table). */
export const TEAM_IDS: Record<string, number> = {
  ATL: 1610612737, BKN: 1610612751, BOS: 1610612738, CHA: 1610612766, CHI: 1610612741, CLE: 1610612739,
  DAL: 1610612742, DEN: 1610612743, DET: 1610612765, GSW: 1610612744, HOU: 1610612745, IND: 1610612754,
  LAC: 1610612746, LAL: 1610612747, MEM: 1610612763, MIA: 1610612748, MIL: 1610612749, MIN: 1610612750,
  NOP: 1610612740, NYK: 1610612752, OKC: 1610612760, ORL: 1610612753, PHI: 1610612755, PHX: 1610612756,
  POR: 1610612757, SAC: 1610612758, SAS: 1610612759, TOR: 1610612761, UTA: 1610612762, WAS: 1610612764,
}

export function teamLogoUrl(abbrev: string | null | undefined): string | null {
  const id = abbrev ? TEAM_IDS[abbrev.toUpperCase()] : undefined
  return id ? `https://cdn.nba.com/logos/nba/${id}/global/L/logo.svg` : null
}

/** playerId is the NBA person id (the same id the data uses); digits only, so nothing odd can enter the address. */
export function headshotUrl(playerId: string | number | null | undefined): string | null {
  const id = String(playerId ?? '')
  return /^[0-9]{1,12}$/.test(id) ? `https://cdn.nba.com/headshots/nba/latest/1040x760/${id}.png` : null
}

/** WCAG relative luminance of a #rrggbb colour: 0 is black, 1 is white. */
export function luminance(hex: string): number {
  const c = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}

/** WCAG contrast ratio between two colours, 1 to 21. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** White or near-black text, whichever is more readable on the fill. */
export function readableOn(hex: string): '#ffffff' | '#0a0a0b' {
  return contrast(hex, '#ffffff') >= contrast(hex, '#0a0a0b') ? '#ffffff' : '#0a0a0b'
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
