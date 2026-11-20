import type { ApiStat, MeetingGame, Meetings, SparkGame } from '../types.ts'

/** The stats whose card also shows the 0 / 1 / 2 / 3+ share strip (same three as the stored last-10 summary). */
export const SHARE_STATS = ['fg3m', 'blk', 'stl']

/** A percentile of an ascending list by linear interpolation between the two nearest games (the same rule as the warehouse's percentile()). */
export function percentile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)
}

/**
 * The card's summary (average, median, middle 80%, lowest, highest, and the 0/1/2/3+ shares for the stats that have them) of one
 * stat over some games, built the same way as the stored last-10 summary. Games with no value are left out. Null with no games.
 */
export function statFromGames(values: (number | null)[], statKey: string, seasonMean: number | null): ApiStat | null {
  const v = values.filter((x): x is number => x !== null && x !== undefined)
  if (v.length === 0) return null
  const sorted = [...v].sort((a, b) => a - b)
  const share = (test: (x: number) => boolean) => v.filter(test).length / v.length
  return {
    mean: v.reduce((a, b) => a + b, 0) / v.length,
    median: percentile(sorted, 0.5),
    p10: percentile(sorted, 0.1),
    p90: percentile(sorted, 0.9),
    min: sorted[0],
    max: sorted[sorted.length - 1],
    seasonMean,
    shares: SHARE_STATS.includes(statKey) ? [share((x) => x === 0), share((x) => x === 1), share((x) => x === 2), share((x) => x >= 3)] : null,
  }
}

/** The meetings the cards are made from, oldest first (the route gives newest first), or none. */
export const meetingGames = (m: Meetings | null): MeetingGame[] => (m ? [...m.games].reverse() : [])

/** What the sparkline needs from a meeting. */
export const sparkFromMeeting = (g: MeetingGame): SparkGame => ({ id: g.id, date: g.date, opp: g.opp, isHome: g.isHome, stats: g.stats })

/** "avg of last 8 meetings vs ATL" ("the last meeting" for one). */
export function meetingsWindowLabel(n: number, opp: string): string {
  return n === 1 ? `avg of his only meeting vs ${opp}` : `avg of last ${n} meetings vs ${opp}`
}
