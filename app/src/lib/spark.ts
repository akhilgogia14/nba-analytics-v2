import { f1 } from './geom.ts'
import { shortDate } from './format.ts'
import { STAT_NAMES, STAT_SHORT } from './hex.ts'
import type { GridStat, SparkGame } from '../types.ts'

/** The sparkline is drawn in a box this wide and tall (it scales to the card's width); the line stays this far from the edges. */
export const SPARK_W = 300
export const SPARK_H = 56
export const SPARK_PAD = 8

export type SparkPoint = { x: number; y: number; value: number; game: SparkGame }
export type SparkLayout = {
  points: SparkPoint[]
  /** Height of the dashed line for the season average, or null if there is none. */
  baseline: number | null
  /** Height of the dotted line for the league average, or null if there is none. */
  leagueBaseline: number | null
  /** The line, as an SVG path; and the same line closed down to the bottom, for the soft fill under it. */
  line: string
  area: string
}

const r2 = (n: number) => Math.round(n * 100) / 100

/**
 * Where each game's point sits. Games run left to right in the order given (oldest first), evenly spaced. Higher is
 * higher on screen. The scale always includes the season average and the league average (when given) so their lines are always inside the box;
 * if every value is the same the line runs flat through the middle. A game with no figure for the stat is left out.
 */
export function sparkLayout(games: SparkGame[], stat: string, seasonAvg: number | null, leagueAvg: number | null = null): SparkLayout {
  const known = games.flatMap((g) => (g.stats[stat] === null ? [] : [{ game: g, value: g.stats[stat] as number }]))
  const all = [...known.map((k) => k.value), ...(seasonAvg === null ? [] : [seasonAvg]), ...(leagueAvg === null ? [] : [leagueAvg])]
  let lo = Math.min(...all)
  let hi = Math.max(...all)
  if (all.length === 0) lo = hi = 0
  const flat = !(hi > lo)
  const y = (v: number) => (flat ? SPARK_H / 2 : SPARK_PAD + ((hi - v) / (hi - lo)) * (SPARK_H - 2 * SPARK_PAD))
  const n = known.length
  const x = (i: number) => (n === 1 ? SPARK_W / 2 : SPARK_PAD + (i * (SPARK_W - 2 * SPARK_PAD)) / (n - 1))
  const points = known.map((k, i) => ({ x: r2(x(i)), y: r2(y(k.value)), value: k.value, game: k.game }))
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  const area = points.length ? `${line} L${points[points.length - 1].x},${SPARK_H} L${points[0].x},${SPARK_H} Z` : ''
  return { points, baseline: seasonAvg === null ? null : r2(y(seasonAvg)), leagueBaseline: leagueAvg === null ? null : r2(y(leagueAvg)), line, area }
}

export type Change = { dir: 'up' | 'down' | 'flat'; text: string }

/** "↑ 0.5 vs season avg": how far the last-10 average is from the season average (null if either is missing). */
export function changeVsSeason(mean: number | null, seasonAvg: number | null): Change | null {
  if (mean === null || seasonAvg === null) return null
  const diff = Math.round((mean - seasonAvg) * 10) / 10
  if (diff === 0) return { dir: 'flat', text: 'level with season avg' }
  return { dir: diff > 0 ? 'up' : 'down', text: `${diff > 0 ? '↑' : '↓'} ${f1(Math.abs(diff))} vs season avg` }
}

export type SparkTip = { title: string; detail: string; label: string }

/** The bubble over one point: the number and the opponent on top, the date and home or away underneath. */
export type SparkNames = { short: string; name: string }
export function sparkTip(game: SparkGame, stat: string, value: number, names?: SparkNames, fmt: (n: number) => string = String): SparkTip {
  const short = names?.short ?? STAT_SHORT[stat as GridStat]
  const long = names?.name ?? STAT_NAMES[stat as GridStat]
  const shown = fmt(value)
  const versus = `${game.isHome ? 'vs' : '@'} ${game.opp}`
  const detail = `${shortDate(game.date)} · ${game.isHome ? 'home' : 'away'}`
  return { title: `${shown} ${short} · ${versus}`, detail, label: `${shown} ${long.toLowerCase()}, ${versus}. ${detail}.` }
}
