import type { RecentGame } from '../types.ts'

export type LogView = 'log' | 'cards'
export const LOG_VIEWS: { key: LogView; label: string }[] = [
  { key: 'log', label: 'Box scores' },
  { key: 'cards', label: 'Averages' },
]

/** Table columns: the stat key on a game and its heading. */
export const LOG_COLUMNS = [
  ['pts', 'PTS'], ['reb', 'REB'], ['ast', 'AST'], ['fg3m', '3PM'], ['blk', 'BLK'], ['stl', 'STL'],
] as const

/** Average of one number over the games that have it (a gap is skipped, not counted as 0), to one decimal; null if none. */
function mean(values: (number | null)[]): number | null {
  const have = values.filter((v): v is number => v !== null)
  return have.length === 0 ? null : Math.round((have.reduce((a, b) => a + b, 0) / have.length) * 10) / 10
}

/** The "average of these games" row under the table: minutes and each of the six stats. */
export function averageRow(games: RecentGame[]) {
  return {
    minutes: mean(games.map((g) => g.minutes)),
    stats: Object.fromEntries(LOG_COLUMNS.map(([k]) => [k, mean(games.map((g) => g.stats[k]))])) as Record<(typeof LOG_COLUMNS)[number][0], number | null>,
  }
}

/** The line above the table: how many games and which dates, in words. */
export function logNote(games: RecentGame[], gamesWord: string): string {
  if (games.length === 0) return `No ${gamesWord} on record for this player.`
  const seasons = [...new Set(games.map((g) => g.seasonLabel))]
  const span = seasons.length > 1 ? `, from ${seasons[seasons.length - 1]} to ${seasons[0]}` : ''
  return `His last ${games.length} ${gamesWord} played, newest first, against any opponent${span}.`
}
