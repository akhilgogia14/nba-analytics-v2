import { shortDate } from './format.ts'
import { VIEWS, baseline, summarize, type OutlookGame, type OutlookStat, type ViewKey, type Views } from './outlook.ts'

/** Positions are percentages of the chart's width (so dots stay round at any width): x runs from PAD to 100 - PAD percent, so dots at the extremes are not cut off. */
export const CHART_PAD = 3
export const ROW_HEIGHT = 30

export type Dot = { x: number; value: number; title: string }
export type ChartRow = {
  key: ViewKey
  games: number
  /** Positions (percent of the width) of the lowest, average and highest; null when the row has no numbers. */
  minX: number | null
  avgX: number | null
  maxX: number | null
  dots: Dot[]
}
export type ChartLayout = { lo: number; hi: number; baselineX: number | null; rows: ChartRow[] }

/** "Oct 23 at BOS: 31" for a dot's hover text. */
const dotTitle = (g: OutlookGame, value: number, digits: number): string => `${shortDate(g.date)} ${g.isHome ? 'vs' : 'at'} ${g.opp}: ${value.toFixed(digits)}`

/**
 * Where everything goes for one stat. All three rows share ONE scale (so a dot means the same number in every row): from the
 * lowest to the highest value in any view, widened a little, and always including the baseline. If every value is the same the
 * scale is widened by one unit each way so nothing divides by zero.
 */
export function chartLayout(views: Views, stat: OutlookStat, digits: number, pad = CHART_PAD): ChartLayout {
  const sums = Object.fromEntries(VIEWS.map((v) => [v.key, summarize(views[v.key], stat)])) as Record<ViewKey, ReturnType<typeof summarize>>
  const base = baseline(sums.last10, sums.season)
  const all = VIEWS.flatMap((v) => views[v.key].map((g) => g.values[stat]).filter((x): x is number => x !== null))
  if (base !== null) all.push(base)
  if (all.length === 0) return { lo: 0, hi: 0, baselineX: null, rows: VIEWS.map((v) => ({ key: v.key, games: views[v.key].length, minX: null, avgX: null, maxX: null, dots: [] })) }
  let lo = Math.min(...all)
  let hi = Math.max(...all)
  if (lo === hi) {
    lo -= 1
    hi += 1
  }
  const x = (v: number) => pad + ((v - lo) / (hi - lo)) * (100 - 2 * pad)
  const rows = VIEWS.map((v): ChartRow => {
    const s = sums[v.key]
    const dots = views[v.key].flatMap((g) => {
      const value = g.values[stat]
      return value === null ? [] : [{ x: x(value), value, title: dotTitle(g, value, digits) }]
    })
    return { key: v.key, games: views[v.key].length, minX: s ? x(s.min) : null, avgX: s ? x(s.avg) : null, maxX: s ? x(s.max) : null, dots }
  })
  return { lo, hi, baselineX: base === null ? null : x(base), rows }
}
