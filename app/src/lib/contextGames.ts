import { fmtDiff, fmtValue, restWords, type Difference } from './context.ts'
import { fmtLeague, fmtShare } from './playerContext.ts'
import type { ContextGameBase, ContextStat, TeamContextGame } from '../types.ts'

/** The games on each side of a comparison. A game can be on both sides of different comparisons (it is in "home" and "rested"), never twice on one. */
export function splitGames<T extends ContextGameBase>(games: T[], a: string, b: string): { a: T[]; b: T[] } {
  return { a: games.filter((g) => g.buckets.includes(a)), b: games.filter((g) => g.buckets.includes(b)) }
}

/** "7 games" / "1 game". */
export const gameCount = (n: number): string => `${n} ${n === 1 ? 'game' : 'games'}`

/** "Mar 3 · vs BOS" with a plain-words rest note under it, as two short strings. */
export function gameLine(g: ContextGameBase): { title: string; note: string } {
  return { title: `${g.isHome ? 'vs' : '@'} ${g.opp}`, note: g.daysRest === null ? 'first game of the season' : restWords(g.daysRest).replace('second night of a back-to-back', 'back-to-back') }
}

/** "W 118-110" for a team game; '' when a score is missing. */
export function teamScore(g: TeamContextGame): string {
  const { pts, allowed } = g.stats
  return pts === null || allowed === null ? '' : `${pts > allowed ? 'W' : 'L'} ${pts}-${allowed}`
}

/** What a league tile on the Teams tab is made of: the two league averages, their game counts, and the gap. */
export function explainTeamTile(label: string, aLabel: string, bLabel: string, stat: ContextStat, d: Difference | null): string {
  if (!d) return `${label}: no league figure for these two situations.`
  // The figures are shown to one decimal; when subtracting the shown ones would not give the shown gap, say the gap is from unrounded figures.
  const r = (v: number) => Math.round(v * 10) / 10
  const rounded = Math.abs(r(r(d.a) - r(d.b)) - r(d.diff)) > 1e-9 ? ' (worked out from unrounded figures)' : ''
  return `${label}: ${aLabel} ${fmtValue(stat, d.a)} (average over ${d.nA.toLocaleString('en-US')} games) minus ${bLabel} ${fmtValue(stat, d.b)} (${d.nB.toLocaleString('en-US')} games) = ${fmtDiff(stat, d.diff)}${rounded}.`
}

/** What a league tile on the Players tab is made of: each side's average against the player's own season average, then the gap. */
export function explainPlayerTile(label: string, aLabel: string, bLabel: string, d: Difference | null): string {
  if (!d) return `${label}: no league figure for these two situations.`
  const r = (v: number) => Math.round(v * 100) / 100
  const rounded = Math.abs(r(r(d.a) - r(d.b)) - r(d.diff)) > 1e-9 ? ' (worked out from unrounded figures)' : ''
  return `${label}: in ${aLabel} games a player is ${fmtLeague(d.a)} against his own season average (over ${d.nA.toLocaleString('en-US')} player games); in ${bLabel} games ${fmtLeague(d.b)} (${d.nB.toLocaleString('en-US')}). Difference ${fmtLeague(d.diff)}${rounded}.`
}

/** The "share of games played" tile: how often players played in each situation, and the gap in points. */
export function explainShareTile(aLabel: string, bLabel: string, a: number | null, b: number | null, diffText: string): string {
  return `Share of games played: players appeared in ${fmtShare(a)} of team games in ${aLabel} situations and ${fmtShare(b)} in ${bLabel} ones, a difference of ${diffText}.`
}
