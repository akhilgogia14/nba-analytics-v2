import { daysSince, shortDate } from './format.ts'
import type { GameType, PlayerInfo } from '../types.ts'

/** The page's one toggle. The page shows one of these at a time; the two are never blended. */
export const GAME_TYPE_OPTIONS: { key: GameType; label: string }[] = [
  { key: 'regular-season', label: 'Regular season' },
  { key: 'playoffs', label: 'Playoffs' },
]

/** "games" for the regular season, "playoff games" for the playoffs (used in sentences like "Last 10 playoff games"). */
export function gamesWord(gameType: GameType): string {
  return gameType === 'playoffs' ? 'playoff games' : 'games'
}

/** The amber notes under a player's name. They depend on the game type: a playoff window is old by nature. */
export function formNotices(p: PlayerInfo, gameType: GameType, now: Date = new Date()): string[] {
  const out: string[] = []
  const g = gamesWord(gameType)
  if (p.l10Games < 10) {
    out.push(`Only ${p.l10Games} ${g} on record so far. These ranges are rough and will move a lot with each new game.`)
  }
  if (gameType === 'playoffs') {
    out.push(
      `Playoff games only. ${p.name}'s latest playoff game on record was on ${shortDate(p.lastGameDate)} (${p.lastSeasonLabel} playoffs), so these games can reach back across earlier playoff runs.`,
    )
    return out
  }
  if (p.l10GamesBeforeCurrentSeason > 0) {
    out.push(`${p.l10GamesBeforeCurrentSeason} of these ${p.l10Games} games are from before this season, because the new season is young.`)
  }
  const idle = daysSince(p.lastGameDate, now)
  if (idle > 7) out.push(`${p.name} last played on ${shortDate(p.lastGameDate)}, ${idle} days ago.`)
  return out
}
