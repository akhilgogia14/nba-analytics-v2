import type { PlayerBucket, PlayerStat } from '../types.ts'

/** The stats on the Players Advanced tab: the six that the forecasts are built on, plus minutes (what drives all of them). */
export const PLAYER_STAT_LIST: { key: PlayerStat; label: string }[] = [
  { key: 'pts', label: 'Points' },
  { key: 'reb', label: 'Rebounds' },
  { key: 'ast', label: 'Assists' },
  { key: 'fg3m', label: '3-pointers made' },
  { key: 'blk', label: 'Blocks' },
  { key: 'stl', label: 'Steals' },
  { key: 'minutes', label: 'Minutes' },
]

/** "played 5 of 7": how many of the team's games in this situation the player played in. */
export function availabilityText(b: PlayerBucket | undefined): string {
  if (!b || b.scheduled === 0) return 'no games'
  return `played ${b.n} of ${b.scheduled}`
}

/** The share of the team's games the player played in, 0 to 100, or null when there were none. */
export function playedShare(b: PlayerBucket | undefined): number | null {
  if (!b || b.scheduled === 0) return null
  return (100 * b.n) / b.scheduled
}

export const fmtShare = (v: number | null): string => (v === null ? '-' : `${Math.round(v)}%`)

/** A difference between two shares, in percentage points, with its sign ("+1.2 pts", never "-0.0 pts"). */
export function fmtShareDiff(a: number | null, b: number | null): string {
  if (a === null || b === null) return '-'
  const d = a - b
  const text = Math.abs(d) < 0.05 ? '0.0' : d.toFixed(1)
  return `${d > 0.05 ? '+' : ''}${text} pts`
}

/** A league figure (a difference from a player's own average) with its sign and two decimals: these effects are small, so one decimal would show "0.0". Never "-0.00". */
export function fmtLeague(v: number): string {
  const text = Math.abs(v) < 0.005 ? '0.00' : v.toFixed(2)
  return `${v > 0.005 ? '+' : ''}${text}`
}
