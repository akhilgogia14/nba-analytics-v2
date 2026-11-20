import { ordinal } from './context.ts'
import { defenseRows, listRows, type DefenseRow } from './defense.ts'
import type { RankedTeam, TeamDefense } from '../types.ts'

export type RankStat = { key: string; label: string; lowerIsBetter: boolean; pct: boolean }
/** The stats a team is ranked on. Points scored, allowed and margin lead; the rest are where it can be strong or weak. */
export const RANK_STATS: RankStat[] = [
  { key: 'pts', label: 'Points scored', lowerIsBetter: false, pct: false },
  { key: 'allowed', label: 'Points allowed', lowerIsBetter: true, pct: false },
  { key: 'margin', label: 'Scoring margin', lowerIsBetter: false, pct: false },
  { key: 'fg_pct', label: 'Field goal %', lowerIsBetter: false, pct: true },
  { key: 'fg3m', label: '3-pointers made', lowerIsBetter: false, pct: false },
  { key: 'ast', label: 'Assists', lowerIsBetter: false, pct: false },
  { key: 'reb', label: 'Rebounds', lowerIsBetter: false, pct: false },
  { key: 'tov', label: 'Turnovers', lowerIsBetter: true, pct: false },
  { key: 'stl', label: 'Steals', lowerIsBetter: false, pct: false },
  { key: 'blk', label: 'Blocks', lowerIsBetter: false, pct: false },
]
export const statByKey = (key: string): RankStat => RANK_STATS.find((s) => s.key === key) ?? RANK_STATS[0]
/** The stats a strength or weakness is picked from (scoring and defense are shown on their own). */
export const STRENGTH_KEYS = ['fg_pct', 'fg3m', 'ast', 'reb', 'tov', 'stl', 'blk']

export type Standing = { team: string; value: number; rank: number }

/** Every team's figure for a stat, best first. Teams that tie share a rank (1, 2, 2, 4); a team with no figure is left out. */
export function standings(teams: RankedTeam[], stat: RankStat): Standing[] {
  const have = teams.flatMap((t) => (t.stats[stat.key] === null || t.stats[stat.key] === undefined ? [] : [{ team: t.team, value: t.stats[stat.key] as number }]))
  const better = (a: number, b: number) => (stat.lowerIsBetter ? a < b : a > b) // a is strictly better than b
  const sorted = [...have].sort((x, y) => (x.value === y.value ? x.team.localeCompare(y.team) : better(x.value, y.value) ? -1 : 1))
  return sorted.map((s) => ({ ...s, rank: 1 + have.filter((o) => better(o.value, s.value)).length }))
}

export type TeamRank = { stat: RankStat; value: number; rank: number; of: number }
/** Where one team stands on a stat, or null if it has no figure. */
export function rankOf(teams: RankedTeam[], code: string, stat: RankStat): TeamRank | null {
  const all = standings(teams, stat)
  const me = all.find((s) => s.team === code)
  return me ? { stat, value: me.value, rank: me.rank, of: all.length } : null
}

export type Tier = 'strong' | 'average' | 'weak'
/** Top third of the teams is strong, bottom third weak, the rest in the middle. With fewer than six teams ranked, no verdict is given (all middle). */
export function tierOf(rank: number, of: number): Tier {
  if (of < 6) return 'average'
  const third = Math.round(of / 3)
  return rank <= third ? 'strong' : rank > of - third ? 'weak' : 'average'
}

const TIER_WORD: Record<Tier, string> = { strong: 'strong', average: 'in the middle', weak: 'weak' }
/** "Offense: strong (3rd of 30 in points scored). Defense: in the middle (14th of 30 in points allowed)." */
export function verdictLine(off: TeamRank | null, def: TeamRank | null): string {
  const part = (name: string, r: TeamRank | null, what: string) => (r ? `${name}: ${TIER_WORD[tierOf(r.rank, r.of)]} (${ordinal(r.rank)} of ${r.of} in ${what}).` : '')
  return [part('Offense', off, 'points scored'), part('Defense', def, 'points allowed')].filter(Boolean).join(' ')
}

/** Up to `limit` stats the team is in the top third of (best first) and up to `limit` in the bottom third (worst first). */
export function strengthsAndWeaknesses(teams: RankedTeam[], code: string, limit = 2): { best: TeamRank[]; worst: TeamRank[] } {
  const ranks = STRENGTH_KEYS.map((k) => rankOf(teams, code, statByKey(k))).filter((r): r is TeamRank => r !== null)
  const best = ranks.filter((r) => tierOf(r.rank, r.of) === 'strong').sort((a, b) => a.rank - b.rank).slice(0, limit)
  const worst = ranks.filter((r) => tierOf(r.rank, r.of) === 'weak').sort((a, b) => b.rank - a.rank).slice(0, limit)
  return { best, worst }
}

/** A team figure as written: one decimal, with a % sign for percentages and a sign for the margin. */
export function fmtRank(stat: RankStat, v: number): string {
  const text = v.toFixed(1)
  if (stat.pct) return `${text}%`
  if (stat.key === 'margin') return Number(text) === 0 ? '0.0' : `${v > 0 ? '+' : ''}${text}`
  return text
}

/** "9-5" from wins and games played. */
export const recordText = (t: Pick<RankedTeam, 'wins' | 'games'>): string => `${t.wins}-${t.games - t.wins}`

/** The groups that give up the most points to (positive gap) and hold below the league (negative gap), from the ranked list's own rule (10+ opposing player-games). */
export function defenseSummary(defense: TeamDefense, limit = 2): { gives: DefenseRow[]; holds: DefenseRow[] } {
  const main = listRows(defenseRows(defense, 'pts')).main // sorted most given up first
  return {
    gives: main.filter((r) => (r.diffPerGame ?? 0) > 0).slice(0, limit),
    holds: [...main].reverse().filter((r) => (r.diffPerGame ?? 0) < 0).slice(0, limit),
  }
}
