import type { RosterPlayer } from '../types.ts'

/** The roster table's stat columns, in order, with the short heading and the full name (the hover text). */
export const ROSTER_COLUMNS = [
  { key: 'minutes', short: 'MIN', title: 'Minutes' },
  { key: 'pts', short: 'PTS', title: 'Points' },
  { key: 'reb', short: 'REB', title: 'Rebounds' },
  { key: 'ast', short: 'AST', title: 'Assists' },
  { key: 'fg3m', short: '3PM', title: '3-pointers made' },
  { key: 'blk', short: 'BLK', title: 'Blocks' },
  { key: 'stl', short: 'STL', title: 'Steals' },
] as const

/** One average to one decimal, or a dash. Every stat in the roster uses the same format so the columns line up. */
export const statText = (v: number | null | undefined): string => (v === null || v === undefined ? '-' : v.toFixed(1))

/** "8/10": games started of the games in his last-10 window (a dash with no games). Short so it fits a phone. */
export function startsText(p: Pick<RosterPlayer, 'starts' | 'games'>): string {
  return p.games ? `${p.starts}/${p.games}` : '-'
}

/** The line under the roster's title. */
export function rosterNote(players: RosterPlayer[] | null): string {
  if (!players) return 'Each player\'s average over his last 10 games played, starters first.'
  return `${players.length} players. Each one's average over his last 10 games played (fewer if he has played fewer), starters first; "Starts" is the games he started out of those.`
}
