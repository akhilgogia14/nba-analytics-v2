import type { ContextStat, NextGame } from '../types.ts'

/**
 * A team's own split needs at least this many games on each side before we show a difference. Owner's choice (2026-11-16): 1,
 * so a team's figures show from its first game in a situation; the page prints the game count above every table and in each team
 * column heading, so a figure from one game reads as one game. (It was 8 at first: a small sample is mostly noise.)
 */
export const MIN_TEAM_GAMES = 5

export const CONTEXT_STAT_LIST: { key: ContextStat; label: string; lowerIsBetter: boolean }[] = [
  { key: 'pts', label: 'Points scored', lowerIsBetter: false },
  { key: 'allowed', label: 'Points allowed', lowerIsBetter: true },
  { key: 'margin', label: 'Scoring margin', lowerIsBetter: false },
  { key: 'fg_pct', label: 'FG%', lowerIsBetter: false },
  { key: 'fg3m', label: '3-pointers made', lowerIsBetter: false },
  { key: 'tov', label: 'Turnovers', lowerIsBetter: true },
]

/** The four comparisons. Each names two groups of games (buckets) and which one is "A" (the first-named situation). */
export const COMPARISONS = [
  { key: 'home', title: 'Home vs away', a: 'home', b: 'away', aLabel: 'Home', bLabel: 'Away' },
  { key: 'b2b', title: 'Back-to-back vs rested', a: 'b2b', b: 'rested', aLabel: 'Back-to-back', bLabel: '1+ day rest' },
  { key: 'rest', title: '2+ days of rest vs 1 day', a: 'rest2plus', b: 'rest1', aLabel: '2+ days rest', bLabel: '1 day rest' },
  { key: 'edge', title: 'More rested vs less rested than the opponent', a: 'edge_plus', b: 'edge_minus', aLabel: 'More rested', bLabel: 'Less rested' },
] as const
export type ComparisonKey = (typeof COMPARISONS)[number]['key']

export type Difference = { a: number; b: number; diff: number; nA: number; nB: number }

/** A against B for one stat. Null if either group is missing, has no number, or has fewer than `minGames` games. */
export function difference<S extends string>(
  split: { buckets: Record<string, { n: number; stats: Record<S, number | null> }> },
  a: string,
  b: string,
  stat: S,
  minGames: number,
): Difference | null {
  const ba = split.buckets[a]
  const bb = split.buckets[b]
  if (!ba || !bb || ba.n < minGames || bb.n < minGames) return null
  const va = ba.stats[stat]
  const vb = bb.stats[stat]
  if (va === null || vb === null) return null
  return { a: va, b: vb, diff: va - vb, nA: ba.n, nB: bb.n }
}

export function fmtValue(stat: ContextStat, v: number): string {
  return stat === 'fg_pct' ? `${v.toFixed(1)}%` : v.toFixed(1)
}
/** A difference with its sign; a result that rounds to zero carries no sign ("0.0", never "-0.0"). */
export function fmtDiff(stat: ContextStat, v: number): string {
  const text = Math.abs(v).toFixed(1)
  const unit = stat === 'fg_pct' ? ' pts' : ''
  if (Number(text) === 0) return `0.0${unit}`
  return `${v > 0 ? '+' : '-'}${text}${unit}`
}

/** Days of rest in plain words. The schedule can hide games (placeholders), so a long gap is flagged, not trusted. */
export function restWords(days: number | null): string {
  if (days === null) return 'first game of the season'
  if (days === 0) return 'second night of a back-to-back'
  if (days === 1) return '1 day of rest'
  if (days >= 8) return `${days} days of rest (a long break, or games missing from the schedule)`
  return `${days} days of rest`
}

/** 1st, 2nd, 3rd, 4th ... (the teens are all "th"). */
export function ordinal(n: number): string {
  const rest = n % 100
  if (rest >= 11 && rest <= 13) return `${n}th`
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`
}

/** The facts about a team's next game, each a short phrase in plain words. */
export function nextGameFacts(g: NextGame): string[] {
  const out: string[] = []
  out.push(g.isHome ? `At home vs ${g.opp}` : `Away at ${g.opp}`)
  const nth = g.stintGame
  if (nth > 1) out.push(g.isHome ? `game ${nth} of a homestand` : `${ordinal(nth)} straight road game`)
  out.push(restWords(g.daysRest))
  if (g.is4In6) out.push(`${ordinal(g.gamesIn6)} game in 6 nights`)
  else if (g.is3In4) out.push(`${ordinal(g.gamesIn4)} game in 4 nights`)
  if (g.oppDaysRest !== null) {
    out.push(`${g.opp} has ${g.oppDaysRest === 0 ? 'played the night before' : `${g.oppDaysRest} day${g.oppDaysRest === 1 ? '' : 's'} of rest`}`)
  }
  if (g.restEdge !== null && g.restEdge !== 0) {
    const n = Math.abs(g.restEdge)
    out.push(`${g.restEdge > 0 ? 'more' : 'less'} rested than ${g.opp} by ${n} day${n === 1 ? '' : 's'}`)
  }
  return out
}

/** Which comparisons describe the next game's situation (they are highlighted on the page). Home vs away always applies. */
export function applicableComparisons(g: NextGame | null): Set<ComparisonKey> {
  const s = new Set<ComparisonKey>()
  if (!g) return s
  s.add('home')
  if (g.daysRest === 0) s.add('b2b')
  else if (g.daysRest === 1 || (g.daysRest !== null && g.daysRest >= 2 && g.daysRest <= 7)) s.add('rest')
  if (g.restEdge !== null && g.restEdge !== 0) s.add('edge')
  return s
}

/** The panels with the one that applies to the next game first (the rest keep their order). */
export function orderComparisons(highlighted: Set<ComparisonKey>): (typeof COMPARISONS)[number][] {
  return [...COMPARISONS].sort((x, y) => Number(highlighted.has(y.key)) - Number(highlighted.has(x.key)))
}

/** Can the team's (or player's) own two groups be compared? Each needs at least MIN_TEAM_GAMES games. */
export const enoughGames = (nA: number, nB: number): boolean => nA >= MIN_TEAM_GAMES && nB >= MIN_TEAM_GAMES

/** What replaces a comparison that has too few games on one side. */
export const tooFewText = (aLabel: string, nA: number, bLabel: string, nB: number): string =>
  `Too few games to compare: ${aLabel} ${nA}, ${bLabel} ${nB}. It needs at least ${MIN_TEAM_GAMES} on each side.`
