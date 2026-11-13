import type { LogGame } from '../types.ts'

export type LogView = 'log' | 'cards'
/** The page's two views, in the order of the pills. The first one is what the page opens on (Averages, the six cards). */
export const LOG_VIEWS: { key: LogView; label: string }[] = [
  { key: 'cards', label: 'Averages' },
  { key: 'log', label: 'Box scores' },
]
export const DEFAULT_VIEW: LogView = LOG_VIEWS[0].key

/** The simple stat columns shown after the shooting splits (stat key on a game and its heading). */
export const LOG_COLUMNS = [
  ['reb', 'REB'], ['ast', 'AST'], ['stl', 'STL'], ['blk', 'BLK'],
] as const

/** Shooting splits: made over attempted, shown like "7-15". */
export const SPLITS = [
  ['fgm', 'fga', 'FG'], ['fg3m', 'fg3a', '3P'], ['ftm', 'fta', 'FT'],
] as const

/** Average of one number over the games that have it (a gap is skipped, not counted as 0), to one decimal; null if none. */
export function mean(values: (number | null)[]): number | null {
  const have = values.filter((v): v is number => v !== null)
  return have.length === 0 ? null : Math.round((have.reduce((a, b) => a + b, 0) / have.length) * 10) / 10
}

/** The value of a made or attempted column on a game: the shooting numbers live in `box`, except threes made (in `stats`). */
export function splitValue(g: LogGame, key: string): number | null {
  if (key === 'fg3m') return g.stats.fg3m
  return (g.box as unknown as Record<string, number | null>)[key] ?? null
}

/** "7-15" for made and attempted; a dash if either is missing. */
export function madeAtt(made: number | null, att: number | null): string {
  return made === null || att === null ? '–' : `${made}-${att}`
}

/** Plus/minus with its sign: +5, -20, 0. */
export function signed(v: number | null): string {
  return v === null ? '–' : v > 0 ? `+${v}` : String(v)
}

/** The "average of these games" row under the table: every column. Makes and attempts are averaged separately ("7.2-15.1"). */
export function averageRow(games: LogGame[]) {
  const col = (f: (g: LogGame) => number | null) => mean(games.map(f))
  return {
    minutes: col((g) => g.minutes),
    pts: col((g) => g.stats.pts),
    stats: Object.fromEntries(LOG_COLUMNS.map(([k]) => [k, col((g) => g.stats[k])])) as Record<(typeof LOG_COLUMNS)[number][0], number | null>,
    splits: SPLITS.map(([made, att]) => madeAtt(col((g) => splitValue(g, made)), col((g) => splitValue(g, att)))),
    tov: col((g) => g.box.tov), pf: col((g) => g.box.pf),
    plusMinus: col((g) => g.box.plusMinus),
    started: games.filter((g) => g.box.started === true).length,
  }
}

/** The line above the table: how many games and which dates, in words. */
export function logNote(games: LogGame[], gamesWord: string): string {
  if (games.length === 0) return `No ${gamesWord} on record for this player.`
  const seasons = [...new Set(games.map((g) => g.seasonLabel))]
  const span = seasons.length > 1 ? `, from ${seasons[seasons.length - 1]} to ${seasons[0]}` : ''
  return `His last ${games.length} ${gamesWord} played, newest first, against any opponent${span}.`
}
