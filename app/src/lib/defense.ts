import type { DefenseGroup, DefenseLine, DefenseStat, TeamDefense } from '../types.ts'

/** The six stats, in the order of the switch. `digits` is how many decimals a per-game figure needs (blocks and steals are small). */
export const DEFENSE_STAT_LIST: { key: DefenseStat; label: string; digits: number }[] = [
  { key: 'pts', label: 'Points', digits: 1 },
  { key: 'reb', label: 'Rebounds', digits: 1 },
  { key: 'ast', label: 'Assists', digits: 1 },
  { key: 'fg3m', label: '3-pointers', digits: 2 },
  { key: 'blk', label: 'Blocks', digits: 2 },
  { key: 'stl', label: 'Steals', digits: 2 },
]

/** A group with fewer opposing player-games than this is a "small group": its figure rests on a handful of games, so the list tucks it away. (A plain choice, not tested.) */
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

export type DefenseTotals = { team: number | null; league: number | null; diff: number | null }

/**
 * What opposing players put up against the team in a whole game (all groups added together) beside the same total for the league.
 * Each group's per-game figure is its combined total in a game, so the groups add up to the whole. Null when no group has a figure.
 */
export function defenseTotals(d: TeamDefense, stat: DefenseStat): DefenseTotals {
  const sum = (groups: DefenseGroup[]): number | null => {
    const v = groups.map((g) => g.stats[stat].perGame).filter((x): x is number => x !== null)
    return v.length === 0 ? null : v.reduce((a, b) => a + b, 0)
  }
  const team = sum(d.team.groups)
  const league = sum(d.league.groups)
  return { team, league, diff: minus(team, league) }
}

/**
 * The list under the headline: groups with enough opposing player-games, biggest "gives up more than the league" first, biggest
 * "holds below the league" last. Everything else (small or empty groups, or no difference to show) goes to `small`, in the
 * original order, so an empty group never shows a difference.
 */
export function listRows(rows: DefenseRow[]): { main: DefenseRow[]; small: DefenseRow[]; scale: number } {
  const main = rows.filter((r) => !r.thin && r.diffPerGame !== null).sort((a, b) => (b.diffPerGame as number) - (a.diffPerGame as number))
  const small = rows.filter((r) => r.thin || r.diffPerGame === null)
  const scale = main.reduce((m, r) => Math.max(m, Math.abs(r.diffPerGame as number)), 0)
  return { main, small, scale }
}

/** How far a bar reaches from the centre line, as a share (0 to 50) of the list's width; the biggest difference reaches the end. */
export const barShare = (diff: number | null, scale: number): number => (diff === null || !(scale > 0) ? 0 : Math.min(50, (Math.abs(diff) / scale) * 50))

/** The opposing player-games behind one grid row (key "starter:G"), biggest in the chosen stat first, then newest. Nothing is dropped. */
export function linesForGroup(lines: DefenseLine[], key: string, stat: DefenseStat): DefenseLine[] {
  return lines
    .filter((l) => `${l.role}:${l.label}` === key)
    .sort((a, b) => (b.stats[stat] ?? -1) - (a.stats[stat] ?? -1) || b.date.localeCompare(a.date))
}

/** How many player-games and different players a group's lines hold, and the chosen stat added up over all of them. */
export function groupSummary(lines: DefenseLine[], stat: DefenseStat): { playerGames: number; players: number; total: number } {
  return {
    playerGames: lines.length,
    players: new Set(lines.map((l) => l.id)).size,
    total: lines.reduce((sum, l) => sum + (l.stats[stat] ?? 0), 0),
  }
}
