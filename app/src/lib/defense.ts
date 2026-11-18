import type { DefenseGroup, DefenseStat, TeamDefense } from '../types.ts'

/** The six stats, in the order of the switch. `digits` is how many decimals a per-game figure needs (blocks and steals are small). */
export const DEFENSE_STAT_LIST: { key: DefenseStat; label: string; digits: number }[] = [
  { key: 'pts', label: 'Points', digits: 1 },
  { key: 'reb', label: 'Rebounds', digits: 1 },
  { key: 'ast', label: 'Assists', digits: 1 },
  { key: 'fg3m', label: '3-pointers', digits: 2 },
  { key: 'blk', label: 'Blocks', digits: 2 },
  { key: 'stl', label: 'Steals', digits: 2 },
]

/** A group with fewer opposing player-games than this is shown muted and marked "few": the figure rests on a handful of games. (My choice, not tested.) */
export const THIN_PLAYER_GAMES = 10

export const roleLabel = (role: 'starter' | 'bench') => (role === 'starter' ? 'Starters' : 'Bench')

export type DefenseRow = {
  key: string
  role: 'starter' | 'bench'
  label: string
  games: number
  playerGames: number
  thin: boolean
  perGame: number | null
  low: number | null
  high: number | null
  per36: number | null
  leaguePerGame: number | null
  leaguePer36: number | null
  /** team minus league, per game and per 36; null when either side has no figure */
  diffPerGame: number | null
  diffPer36: number | null
}

const minus = (a: number | null, b: number | null) => (a === null || b === null ? null : a - b)

/** One row per group (starter and bench by listed position) for one stat, the team's figures beside the league's. */
export function defenseRows(d: TeamDefense, stat: DefenseStat): DefenseRow[] {
  const league = new Map<string, DefenseGroup>(d.league.groups.map((g) => [`${g.role}:${g.label}`, g]))
  return d.team.groups.map((g) => {
    const key = `${g.role}:${g.label}`
    const t = g.stats[stat]
    const l = league.get(key)?.stats[stat] ?? null
    return {
      key,
      role: g.role,
      label: g.label,
      games: g.games,
      playerGames: g.playerGames,
      thin: g.playerGames < THIN_PLAYER_GAMES,
      perGame: t.perGame,
      low: t.low,
      high: t.high,
      per36: t.per36,
      leaguePerGame: l?.perGame ?? null,
      leaguePer36: l?.per36 ?? null,
      diffPerGame: minus(t.perGame, l?.perGame ?? null),
      diffPer36: minus(t.per36, l?.per36 ?? null),
    }
  })
}

/** A figure to the given decimals, or a dash when there is none. */
export const fmtFigure = (v: number | null, digits: number): string => (v === null ? '-' : v.toFixed(digits))

/** A difference with its sign; one that rounds to zero carries no sign ("0.0", never "-0.0"). */
export function fmtDelta(v: number | null, digits: number): string {
  if (v === null) return '-'
  const text = Math.abs(v).toFixed(digits)
  if (Number(text) === 0) return (0).toFixed(digits)
  return `${v > 0 ? '+' : '-'}${text}`
}

/** "10th to 90th" range of the per-game total, or a dash. */
export const fmtRange = (low: number | null, high: number | null, digits: number): string =>
  low === null || high === null ? '-' : `${low.toFixed(digits)} to ${high.toFixed(digits)}`

/** "2025-26" or "2021-22 to 2026-27". */
export const seasonSpan = (first: string | null, last: string | null): string =>
  first && last ? (first === last ? first : `${first} to ${last}`) : ''

/** How many of this team's defended games the rows count (the same for every group). */
export const defendedGames = (d: TeamDefense): number => d.team.groups[0]?.games ?? 0
