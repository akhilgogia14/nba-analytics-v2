import type { Meetings } from '../types.ts'

/** The words above the table, which must make it obvious when games are from an earlier season. */
export function meetingsNote(m: Meetings, opp: string, gamesWord: string): string {
  const n = m.games.length
  const last = m.games.filter((g) => g.kind === 'last').length
  const older = m.games.filter((g) => g.kind === 'older').length
  const thisSeason = n - last - older
  const earlierWords = [last > 0 ? `${last} from last season` : '', older > 0 ? `${older} from older seasons` : ''].filter(Boolean).join(' and ')
  switch (m.scope) {
    case 'season':
      return `All ${n} ${gamesWord} against ${opp} in ${m.currentSeason}.`
    case 'filled':
      return `${thisSeason} ${thisSeason === 1 ? 'game' : 'games'} against ${opp} in ${m.currentSeason}, plus ${earlierWords} to fill it out. The earlier games are marked.`
    case 'earlier':
      return `No ${gamesWord} against ${opp} in ${m.currentSeason} yet. These are the last ${n} meetings, ${earlierWords}. The earlier games are marked.`
    default:
      return `No ${gamesWord} against ${opp} on record for this player.`
  }
}

/** The tag in the Season column: nothing for this season's games, "Last season" or the season for earlier ones. */
export function seasonTag(kind: 'this' | 'last' | 'older', seasonLabel: string): string {
  return kind === 'this' ? seasonLabel : kind === 'last' ? `Last season · ${seasonLabel}` : seasonLabel
}
