import type { Meetings } from '../types.ts'

/** The words above the table, which must make it obvious when games are from last season. */
export function meetingsNote(m: Meetings, opp: string, gamesWord: string): string {
  const n = m.games.length
  const last = m.games.filter((g) => g.kind === 'last').length
  const thisSeason = n - last
  switch (m.scope) {
    case 'season':
      return `All ${n} ${gamesWord} against ${opp} in ${m.currentSeason}.`
    case 'filled':
      return `${thisSeason} ${thisSeason === 1 ? 'game' : 'games'} against ${opp} in ${m.currentSeason}, plus ${last} from last season to fill it out. The last-season games are marked.`
    case 'earlier':
      return `No ${gamesWord} against ${opp} in ${m.currentSeason} yet. These are ${last === 1 ? 'his 1 meeting' : `his ${last} meetings`} from last season, marked as such.`
    default:
      return m.currentSeason
        ? `No ${gamesWord} against ${opp} in ${m.currentSeason} or last season.`
        : `No ${gamesWord} against ${opp} on record for this player.`
  }
}

/** The tag in the Season column: the season for this season's games, "Last season · 2025-26" for the fill. */
export function seasonTag(kind: 'this' | 'last', seasonLabel: string): string {
  return kind === 'last' ? `Last season · ${seasonLabel}` : seasonLabel
}
