import type { MeetingGame, RecentGame, Season, SeasonGame } from '../types.ts'

/** The seven numbers the Predictions page describes: the six stat lines plus minutes. */
export type OutlookStat = 'pts' | 'reb' | 'ast' | 'fg3m' | 'blk' | 'stl' | 'minutes'

/** `digits` = decimals for a figure (3-pointers, blocks and steals are small counts, so they get two). */
export const OUTLOOK_STATS: { key: OutlookStat; label: string; digits: number }[] = [
  { key: 'pts', label: 'Points', digits: 1 },
  { key: 'reb', label: 'Rebounds', digits: 1 },
  { key: 'ast', label: 'Assists', digits: 1 },
  { key: 'fg3m', label: '3-pointers', digits: 2 },
  { key: 'blk', label: 'Blocks', digits: 2 },
  { key: 'stl', label: 'Steals', digits: 2 },
  { key: 'minutes', label: 'Minutes', digits: 1 },
]

/** One played game, whatever route it came from, with its seven numbers (a number is null if the source had a gap). */
export type OutlookGame = {
  id: string
  date: string
  opp: string
  isHome: boolean
  seasonLabel: string
  values: Record<OutlookStat, number | null>
}

/** The three ways the page looks at a player's past games. */
export type ViewKey = 'last10' | 'season' | 'opponent'
export const VIEWS: { key: ViewKey; label: string }[] = [
  { key: 'last10', label: 'Last 10 games' },
  { key: 'season', label: 'This season' },
  { key: 'opponent', label: 'Last 10 vs this opponent' },
]
export type Views = Record<ViewKey, OutlookGame[]>

export const fromRecent = (g: RecentGame): OutlookGame => ({
  id: g.id, date: g.date, opp: g.opp, isHome: g.isHome, seasonLabel: g.seasonLabel, values: { ...g.stats, minutes: g.minutes },
})
export const fromMeeting = (g: MeetingGame): OutlookGame => ({
  id: g.id, date: g.date, opp: g.opp, isHome: g.isHome, seasonLabel: g.seasonLabel, values: { ...g.stats, minutes: g.minutes },
})
const fromSeasonGame = (g: SeasonGame, seasonLabel: string): OutlookGame => ({
  id: g.id, date: g.date, opp: g.opp, isHome: g.isHome, seasonLabel, values: { ...g.stats, minutes: g.minutes },
})

/**
 * Every game he PLAYED this season of one game type, newest first, from all the team grids of that season (a traded player has
 * one grid per team). The season route already returns only his latest season of each game type.
 */
export function seasonGames(season: Season, gameType: 'regular-season' | 'playoffs'): OutlookGame[] {
  return season.grids
    .filter((gr) => gr.gameType === gameType)
    .flatMap((gr) => gr.games.filter((g) => g.played).map((g) => fromSeasonGame(g, gr.seasonLabel)))
    .sort((a, b) => (a.date === b.date ? (a.id < b.id ? 1 : -1) : a.date < b.date ? 1 : -1))
}

export type Summary = { n: number; min: number; avg: number; max: number }

/** Lowest, average and highest of one stat over the games that have a number for it; null when none do. */
export function summarize(games: OutlookGame[], stat: OutlookStat): Summary | null {
  const v = games.map((g) => g.values[stat]).filter((x): x is number => x !== null)
  if (v.length === 0) return null
  return { n: v.length, min: Math.min(...v), avg: v.reduce((a, b) => a + b, 0) / v.length, max: Math.max(...v) }
}

/**
 * The baseline figure: the plain blend of the last-10 average and the season average, half and half (the v1 blend of
 * docs/MODELING.md; its weights were not recorded, so 50/50 is a choice). With only one of the two, that one.
 */
export function baseline(last10: Summary | null, season: Summary | null): number | null {
  if (last10 && season) return (last10.avg + season.avg) / 2
  return last10?.avg ?? season?.avg ?? null
}

/** A figure to the stat's decimals, or a dash. */
export const fmtOutlook = (v: number | null, digits: number): string => (v === null ? '-' : v.toFixed(digits))
