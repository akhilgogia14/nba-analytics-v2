import { shortDate } from './format.ts'
import { VIEWS, baselineFor, summarize, type OutlookGame, type OutlookStat, type ViewKey, type Views } from './outlook.ts'

/** Positions are percentages of the chart's width (so dots stay round at any width): x runs from PAD to 100 - PAD percent, so dots at the extremes are not cut off. */
export const CHART_PAD = 3
export const ROW_HEIGHT = 30

/** One game's dot: where it sits, its number, and which game it was ("Oct 23 at BOS"). */
export type Dot = { x: number; value: number; label: string }
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

/** "Oct 23 at BOS" (at = away, vs = home). */
const gameLabel = (g: OutlookGame): string => `${shortDate(g.date)} ${g.isHome ? 'vs' : 'at'} ${g.opp}`

/**
 * Where everything goes for one stat. All three rows share ONE scale (so a dot means the same number in every row): from the
 * lowest to the highest value in any view, widened a little, and always including the baseline. If every value is the same the
 * scale is widened by one unit each way so nothing divides by zero.
 */
export function chartLayout(views: Views, stat: OutlookStat, pad = CHART_PAD): ChartLayout {
  const sums = Object.fromEntries(VIEWS.map((v) => [v.key, summarize(views[v.key], stat)])) as Record<ViewKey, ReturnType<typeof summarize>>
  const base = baselineFor(views, stat)
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
      return value === null ? [] : [{ x: x(value), value, label: gameLabel(g) }]
    })
    return { key: v.key, games: views[v.key].length, minX: s ? x(s.min) : null, avgX: s ? x(s.avg) : null, maxX: s ? x(s.max) : null, dots }
  })
  return { lo, hi, baselineX: base === null ? null : x(base), rows }
}

/** All the games of one row that share one value: they sit on the same spot, so one tooltip lists them. */
export type DotGroup = { x: number; value: number; games: string[] }

/** Groups a row's dots by value, left to right, keeping the order the games came in (newest first). */
export function dotGroups(dots: Dot[]): DotGroup[] {
  const by = new Map<number, DotGroup>()
  for (const d of dots) {
    const g = by.get(d.value)
    if (g) g.games.push(d.label)
    else by.set(d.value, { x: d.x, value: d.value, games: [d.label] })
  }
  return [...by.values()].sort((a, b) => a.x - b.x)
}

/** How many games a tooltip lists before it says "and N more". */
export const TIP_MAX_GAMES = 5

/** The lines of a tooltip's detail: up to TIP_MAX_GAMES games, then how many more. */
export function tipGames(games: string[]): string[] {
  return games.length <= TIP_MAX_GAMES ? games : [...games.slice(0, TIP_MAX_GAMES), `and ${games.length - TIP_MAX_GAMES} more`]
}
