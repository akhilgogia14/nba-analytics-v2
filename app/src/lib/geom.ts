import type { ApiStat } from '../types.ts'

/** A stat with every number present. */
export type Dist = { mean: number; median: number; p10: number; p90: number; min: number; max: number }

/** Returns the stat if every number is there, otherwise null. */
export function complete(s: ApiStat | undefined): Dist | null {
  if (!s) return null
  const { mean, median, p10, p90, min, max } = s
  if (mean === null || median === null || p10 === null || p90 === null || min === null || max === null) return null
  return { mean, median, p10, p90, min, max }
}

/** One decimal, never "-0.0". */
export function f1(v: number): string {
  const r = Math.round(v * 10) / 10
  return (r === 0 ? 0 : r).toFixed(1)
}

/**
 * Where things sit on a bar, as percentages of the bar width.
 * The bar always includes 0 and stretches 6% past the biggest number so the end marks are not clipped.
 */
export function geometry(s: Dist) {
  let hi = Math.max(s.max, s.p90, s.mean, 0) * 1.06
  const lo = Math.min(s.min, s.p10, s.mean, 0) * 1.06
  if (!(hi > lo)) hi = lo + 1
  const span = hi - lo
  const at = (v: number) => ((v - lo) / span) * 100
  const width = (a: number, b: number) => ((b - a) / span) * 100
  return {
    minLeft: at(s.min),
    minWidth: width(s.min, s.max),
    bandLeft: at(s.p10),
    bandWidth: width(s.p10, s.p90),
    medianLeft: at(s.median),
    meanLeft: at(s.mean),
  }
}

export type ShareSegment = { index: number; key: string; share: number; text: string; title: string }

/** The stacked "0 / 1 / 2 / 3+ games" bar. Zero-share pieces are left out. */
export function shareSegments(shares: number[] | null): ShareSegment[] {
  if (!shares) return []
  const keys = ['0', '1', '2', '3+']
  const out: ShareSegment[] = []
  shares.forEach((share, index) => {
    if (!(share > 0)) return
    const pct = Math.round(share * 100)
    out.push({
      index,
      key: keys[index],
      share,
      text: share >= 0.2 ? `${keys[index]} · ${pct}%` : share >= 0.1 ? `${pct}%` : '',
      title: `${keys[index]} made: ${pct}% of games`,
    })
  })
  return out
}
