import { f1 } from './geom.ts'
import { shortDate } from './format.ts'
import { blend } from './teamTheme.ts'
import type { GridStat, SeasonGame, SeasonGrid } from '../types.ts'

/** The stats the season chart can show, in picker order. */
export const GRID_STATS: GridStat[] = ['pts', 'reb', 'ast', 'fg3m', 'blk', 'stl']
export const STAT_NAMES: Record<GridStat, string> = {
  pts: 'Points', reb: 'Rebounds', ast: 'Assists', fg3m: '3-pointers', blk: 'Blocks', stl: 'Steals',
}
/** Short names for the tooltip: "11 REB". */
export const STAT_SHORT: Record<GridStat, string> = { pts: 'PTS', reb: 'REB', ast: 'AST', fg3m: '3PM', blk: 'BLK', stl: 'STL' }

/** A regular season is 82 games; games not played yet are drawn as empty outlines up to this many. */
export const REGULAR_SEASON_GAMES = 82
/** Hexagons per row (the rows interlock like a honeycomb: every other row is shifted half a hexagon). */
export const COLUMNS = 14
/** How many colour steps the played games are sorted into (the "Less ... More" key shows all of them). */
export const BINS = 5
/** Strength of the team colour for each step, over the dark card colour. The first is clearly tinted, never grey. */
export const BIN_STRENGTH = [0.28, 0.46, 0.64, 0.82, 1]
export const CARD_BASE = '#10131B'
/** A game he missed: a flat dark grey with a faint edge. */
export const MISSED = { fill: '#171B25', stroke: '#262D3A' }
/** A game not played yet: no fill, a dashed edge. */
export const UPCOMING = { stroke: '#2B3342' }
/** The border drawn around a game where he reached his season mean. */
export const HIT_STROKE = '#EAF0FF'

export type HexCell = { cx: number; cy: number }
export type HexLayout = { cells: HexCell[]; width: number; height: number; radius: number }

/** Pointy-top hexagons of the given radius in rows of `cols`; odd rows shift right by half a hexagon. */
export function hexLayout(count: number, cols = COLUMNS, radius = 20): HexLayout {
  const w = Math.sqrt(3) * radius
  const cells = Array.from({ length: count }, (_, i) => {
    const row = Math.floor(i / cols)
    const col = i % cols
    return { cx: w / 2 + col * w + (row % 2 ? w / 2 : 0), cy: radius + row * 1.5 * radius }
  })
  const rows = Math.ceil(count / cols)
  return { cells, width: cols * w + w / 2, height: rows > 0 ? (rows - 1) * 1.5 * radius + 2 * radius : 0, radius }
}

/** The six corners of a pointy-top hexagon, as an SVG points string. */
export function hexPoints(cx: number, cy: number, radius: number): string {
  return [0, 1, 2, 3, 4, 5]
    .map((k) => {
      const a = ((60 * k - 30) * Math.PI) / 180
      return `${(cx + radius * Math.cos(a)).toFixed(2)},${(cy + radius * Math.sin(a)).toFixed(2)}`
    })
    .join(' ')
}

/** The numbers of the games he played (a played game with no value for this stat is left out). */
export function playedValues(games: SeasonGame[], stat: GridStat): number[] {
  const out: number[] = []
  for (const g of games) {
    const v = g.stats[stat]
    if (g.played && v !== null) out.push(v)
  }
  return out
}

/** The season mean for a stat over the games he played, across the given grids (null if he played none). */
export function seasonMean(grids: SeasonGrid[], stat: GridStat): number | null {
  const v = grids.flatMap((g) => playedValues(g.games, stat))
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
}

/** Lowest and highest value over the given grids (colours are scaled to this range), or null if none played. */
export function valueRange(grids: SeasonGrid[], stat: GridStat): { min: number; max: number } | null {
  const v = grids.flatMap((g) => playedValues(g.games, stat))
  return v.length ? { min: Math.min(...v), max: Math.max(...v) } : null
}

/** Which colour step (0 to BINS-1) a value falls in. If every game is the same number, the middle step. */
export function binFor(value: number, min: number, max: number, bins = BINS): number {
  if (!(max > min)) return Math.floor(bins / 2)
  return Math.min(bins - 1, Math.max(0, Math.floor(((value - min) / (max - min)) * bins)))
}

/** The fill of a colour step, as a plain hex colour. */
export function binColor(accent: string, bin: number): string {
  return blend(accent, CARD_BASE, BIN_STRENGTH[Math.min(BINS - 1, Math.max(0, bin))])
}

/** Did he reach his season mean in this game? Only a played game with a value can. */
export function hitMean(value: number | null, mean: number | null): boolean {
  return value !== null && mean !== null && value >= mean - 1e-9
}

export type CellKind = 'played' | 'missed' | 'upcoming' | 'gap'
export type Cell = { kind: CellKind; game: SeasonGame | null; value: number | null; hit: boolean; bin: number }

/**
 * One cell per slot: his games in date order, then (regular season only) empty slots up to 82. A played game with no
 * value for this stat is a "gap" (cannot happen with today's data, but never shown as a zero).
 */
export function buildCells(grid: SeasonGrid, stat: GridStat, grids: SeasonGrid[]): Cell[] {
  const mean = seasonMean(grids, stat)
  const range = valueRange(grids, stat)
  const cells: Cell[] = grid.games.map((game) => {
    if (!game.played) return { kind: 'missed', game, value: null, hit: false, bin: 0 }
    const value = game.stats[stat]
    if (value === null || range === null) return { kind: 'gap', game, value: null, hit: false, bin: 0 }
    return { kind: 'played', game, value, hit: hitMean(value, mean), bin: binFor(value, range.min, range.max) }
  })
  if (grid.gameType === 'regular-season') {
    for (let i = cells.length; i < REGULAR_SEASON_GAMES; i++) cells.push({ kind: 'upcoming', game: null, value: null, hit: false, bin: 0 })
  }
  return cells
}

export type HexTip = { title: string; detail: string; label: string }

/** The bubble over a hexagon: value and opponent on top, date and the mean underneath. */
export function hexTip(cell: Cell, stat: GridStat, mean: number | null): HexTip | null {
  const g = cell.game
  if (!g) return null
  const versus = `${g.isHome ? 'vs' : '@'} ${g.opp}`
  const where = `${shortDate(g.date)} · ${g.isHome ? 'home' : 'away'}`
  if (cell.kind === 'missed') {
    const title = `Did not play · ${versus}`
    return { title, detail: where, label: `${title}. ${where}.` }
  }
  if (cell.kind === 'gap' || cell.value === null) {
    const title = `No ${STAT_SHORT[stat]} figure · ${versus}`
    return { title, detail: where, label: `${title}. ${where}.` }
  }
  const meanText = mean === null ? '' : ` · season mean ${f1(mean)}`
  const title = `${cell.value} ${STAT_SHORT[stat]}${cell.hit ? ' ✓' : ''} · ${versus}`
  const detail = `${where}${meanText}`
  const verdict = mean === null ? '' : cell.hit ? ' At or above his season mean.' : ' Below his season mean.'
  return { title, detail, label: `${cell.value} ${STAT_NAMES[stat].toLowerCase()}, ${versus}. ${detail}.${verdict}` }
}

/** "Played 64 of 82 team games so far" and similar, for the line under the picker. */
export function playedSummary(grid: SeasonGrid): { played: number; total: number } {
  return { played: grid.games.filter((g) => g.played).length, total: grid.teamGames }
}
