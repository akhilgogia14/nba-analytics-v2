import type { MeetingGame, RecentGame, Season, SeasonGame } from '../types.ts'

/** The seven numbers the Predictions page describes: the six stat lines plus minutes. */
export type OutlookStat = 'pts' | 'reb' | 'ast' | 'fg3m' | 'blk' | 'stl' | 'minutes'

/** `digits` = decimals for an average, baseline or typical miss: one for every stat. A single game's number is whole (fmtGame). */
export const OUTLOOK_STATS: { key: OutlookStat; label: string; digits: number }[] = [
  { key: 'pts', label: 'Points', digits: 1 },
  { key: 'reb', label: 'Rebounds', digits: 1 },
  { key: 'ast', label: 'Assists', digits: 1 },
  { key: 'fg3m', label: '3-pointers', digits: 1 },
  { key: 'blk', label: 'Blocks', digits: 1 },
  { key: 'stl', label: 'Steals', digits: 1 },
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

/**
 * MINUTES use a different baseline (back-test: scripts/analysis/backtest_minutes.py, docs/predictions-backtest.md Result 6). Once he has
 * played MINUTES_MIN_SEASON_GAMES games this season it is a weighted average of his games, newest counting most: each game further back
 * counts 25% less (MINUTES_DECAY). The games are the ones the page already shows: his last 10, or this season's if that is more.
 * Before that, and for every other stat, it is the plain half-and-half blend.
 */
export const MINUTES_DECAY = 0.25
export const MINUTES_MIN_SEASON_GAMES = 5

/** The weighted average of numbers given newest first: the newest has weight 1, the next 1 - decay, then (1 - decay) squared, and so on. */
export function weightedRecent(newestFirst: number[], decay = MINUTES_DECAY): number | null {
  if (newestFirst.length === 0) return null
  let sum = 0
  let weights = 0
  newestFirst.forEach((v, k) => {
    const w = (1 - decay) ** k
    sum += v * w
    weights += w
  })
  return sum / weights
}

/** The baseline for one stat from the three views: the minutes smoother for minutes once there are enough games this season, else the blend. */
export function baselineFor(views: Views, stat: OutlookStat): number | null {
  const last10 = summarize(views.last10, stat)
  const season = summarize(views.season, stat)
  if (stat === 'minutes' && season !== null && season.n >= MINUTES_MIN_SEASON_GAMES) {
    const games = views.season.length >= 10 ? views.season : views.last10
    const smoothed = weightedRecent(games.map((g) => g.values.minutes).filter((x): x is number => x !== null))
    if (smoothed !== null) return smoothed
  }
  return baseline(last10, season)
}

/** True when this stat's baseline is the minutes smoother for these games (so the page can say how it was made). */
export const usesSmoother = (views: Views, stat: OutlookStat): boolean => stat === 'minutes' && (summarize(views.season, stat)?.n ?? 0) >= MINUTES_MIN_SEASON_GAMES

/** An average, baseline or typical miss to the stat's decimals, or a dash. */
export const fmtOutlook = (v: number | null, digits: number): string => (v === null ? '-' : v.toFixed(digits))

/** A single game's number (a game's points, his lowest or highest): whole, or a dash. Minutes are rounded. */
export const fmtGame = (v: number | null): string => (v === null ? '-' : String(Math.round(v) === 0 ? 0 : Math.round(v)))

/**
 * How far the baseline was from what actually happened, on average (mean absolute error), in the back-test of 2026-11-18, rerun
 * 2026-11-19 with minutes bands (docs/predictions-backtest.md; the minutes row is from the smoother's back-test of 2026-11-20): every game of 2025-26 and 2026-27 so far, predicted only from earlier
 * games, weights not tuned on those seasons. A band is the player's average minutes over his previous 10 games; `all` is everyone.
 * Predictions are of the stat GIVEN that he plays. Each figure is an average over the players in the band, so a player who scores
 * very little misses by less than his band's figure.
 */
export type MissBand = 'under10' | 'from10' | 'from20' | 'from30' | 'all'
export const TYPICAL_MISS: Record<OutlookStat, Record<MissBand, number>> = {
  pts: { under10: 2.918, from10: 3.875, from20: 4.893, from30: 5.892, all: 4.665 },
  reb: { under10: 1.443, from10: 1.791, from20: 1.986, from30: 2.129, all: 1.917 },
  ast: { under10: 0.814, from10: 1.080, from20: 1.430, from30: 1.805, all: 1.364 },
  fg3m: { under10: 0.498, from10: 0.721, from20: 0.967, from30: 1.157, all: 0.901 },
  blk: { under10: 0.276, from10: 0.449, from20: 0.552, from30: 0.610, all: 0.512 },
  stl: { under10: 0.447, from10: 0.641, from20: 0.780, from30: 0.870, all: 0.733 },
  minutes: { under10: 5.404, from10: 5.555, from20: 4.823, from30: 4.118, all: 4.915 }, // the minutes smoother's own back-test (backtest_minutes.py), not the blend's
}

/** The bands, lowest minutes first: `from` is the lowest average minutes in the band (the upper end is the next band's `from`). */
export const MISS_BANDS: { key: Exclude<MissBand, 'all'>; from: number; text: string }[] = [
  { key: 'under10', from: 0, text: 'players averaging under 10 minutes' },
  { key: 'from10', from: 10, text: 'players averaging 10 to 20 minutes' },
  { key: 'from20', from: 20, text: 'players averaging 20 to 30 minutes' },
  { key: 'from30', from: 30, text: 'players averaging 30+ minutes' },
]

/** Which typical-miss band fits this player: by his average minutes over his last 10 games ('all' when we have none). */
export function missBand(views: Views): MissBand {
  const m = summarize(views.last10, 'minutes')
  if (m === null) return 'all'
  return [...MISS_BANDS].reverse().find((b) => m.avg >= b.from)?.key ?? 'under10'
}

/** The typical miss for one stat for this player's band. */
export const typicalMiss = (stat: OutlookStat, band: MissBand): number => TYPICAL_MISS[stat][band]

export const missBandText = (band: MissBand): string => MISS_BANDS.find((b) => b.key === band)?.text ?? 'all players'

/** One headline tile: the baseline, the typical miss, and his own lowest and highest over his last 10 games. Null figures when there are no games. */
export type Tile = { key: OutlookStat; label: string; digits: number; base: number | null; miss: number; lo: number | null; hi: number | null; games: number }

export function headlineTiles(views: Views): Tile[] {
  const band = missBand(views)
  return OUTLOOK_STATS.map((s) => {
    const last10 = summarize(views.last10, s.key)
    const base = baselineFor(views, s.key)
    return { key: s.key, label: s.label, digits: s.digits, base, miss: typicalMiss(s.key, band), lo: last10?.min ?? null, hi: last10?.max ?? null, games: last10?.n ?? 0 }
  })
}

/** One game behind a tile: its value for the stat and which of the two baseline windows it counts in. */
export type BehindRow = { game: OutlookGame; value: number | null; inLast10: boolean; inSeason: boolean }
/** Everything a click on a tile shows for one stat: the three averages, the baseline, and the games. */
export type Behind = {
  stat: OutlookStat
  label: string
  digits: number
  base: number | null
  last10: Summary | null
  season: Summary | null
  opponent: Summary | null
  /** The games in the last-10 window and/or the season, once each, newest first. */
  rows: BehindRow[]
  /** His last meetings with the chosen opponent (not part of the baseline), newest first. */
  opponentRows: BehindRow[]
  /** True when the baseline is the minutes smoother (weighted, newest games count most) rather than the half-and-half blend. */
  smoothed: boolean
}

const newestFirst = (a: OutlookGame, b: OutlookGame) => (a.date === b.date ? (a.id < b.id ? 1 : -1) : a.date < b.date ? 1 : -1)

/** The games behind one stat's tile. The baseline is the same figure the tile shows (headlineTiles), built from the same two summaries. */
export function behindTile(views: Views, stat: OutlookStat): Behind {
  const spec = OUTLOOK_STATS.find((s) => s.key === stat) ?? OUTLOOK_STATS[0]
  const last10 = summarize(views.last10, stat)
  const season = summarize(views.season, stat)
  const ids10 = new Set(views.last10.map((g) => g.id))
  const idsSeason = new Set(views.season.map((g) => g.id))
  const all = new Map<string, OutlookGame>()
  for (const g of [...views.last10, ...views.season]) all.set(g.id, g)
  const rows = [...all.values()].sort(newestFirst).map((game) => ({ game, value: game.values[stat], inLast10: ids10.has(game.id), inSeason: idsSeason.has(game.id) }))
  const opponentRows = [...views.opponent].sort(newestFirst).map((game) => ({ game, value: game.values[stat], inLast10: false, inSeason: false }))
  return { stat, label: spec.label, digits: spec.digits, base: baselineFor(views, stat), last10, season, opponent: summarize(views.opponent, stat), rows, opponentRows, smoothed: usesSmoother(views, stat) }
}
