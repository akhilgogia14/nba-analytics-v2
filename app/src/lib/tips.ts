import { f1, type Dist, type ShareSegment } from './geom.ts'

export type Tip = { key: string; left: number; title: string; text: string }

/** Bubbles are kept this far (in % of the bar width) from either end so they never run off the card. */
export const ANCHOR_MIN = 16
export const ANCHOR_MAX = 84

export function clampAnchor(left: number): number {
  return Math.min(ANCHOR_MAX, Math.max(ANCHOR_MIN, left))
}

/** Where each mark sits on the bar, in % (the output of geometry()). */
export type Marks = {
  minLeft: number
  minWidth: number
  bandLeft: number
  bandWidth: number
  medianLeft: number
  meanLeft: number
}

/** The four tooltips of one bar: the average, the median, the middle 80% and the lowest-to-highest line. */
export function markTips(d: Dist, g: Marks, games: number | null, fmt: (n: number) => string = f1): Tip[] {
  const window = games ? `the last ${games} games` : 'the recent games'
  return [
    {
      key: 'mean',
      left: clampAnchor(g.meanLeft),
      title: `Average ${fmt(d.mean)}`,
      text: `All of ${window} added up and divided by the number of games.`,
    },
    {
      key: 'median',
      left: clampAnchor(g.medianLeft),
      title: `Median ${fmt(d.median)}`,
      text: `The middle game of ${window}: half were above this, half below.`,
    },
    {
      key: 'band',
      left: clampAnchor(g.bandLeft + g.bandWidth / 2),
      title: `Middle 80%: ${fmt(d.p10)} to ${fmt(d.p90)}`,
      text: `About 8 of every 10 of ${window} landed in this range.`,
    },
    {
      key: 'range',
      left: clampAnchor(g.minLeft + g.minWidth / 2),
      title: `Lowest ${fmt(d.min)}, highest ${fmt(d.max)}`,
      text: `The worst and the best single game of ${window}.`,
    },
  ]
}

/** One bubble per piece of the 0 / 1 / 2 / 3+ strip, anchored over the middle of its piece. */
export function shareTips(segments: ShareSegment[]): Tip[] {
  let start = 0
  return segments.map((s) => {
    const left = clampAnchor((start + s.share / 2) * 100)
    start += s.share
    return { key: `share-${s.key}`, left, title: s.title, text: 'Share of the games in the window with this count.' }
  })
}
