import type { Meetings, TeamMeetings } from '../types.ts'

/** How many meetings the table shows at most (the server's MEETINGS_COUNT). */
export const MEETINGS_COUNT = 10

/** "2024-25" or "2021-22 to 2024-25": the seasons the earlier games come from. */
function seasonSpan(labels: string[]): string {
  const sorted = [...new Set(labels)].sort()
  return sorted.length > 1 ? `${sorted[0]} to ${sorted[sorted.length - 1]}` : (sorted[0] ?? '')
}

/**
 * The words above the opponent table. It shows the last 10 meetings from any season, so it must make clear how many are from the
 * current season and where the rest come from. `who` is "his" (a player) or "the team's".
 */
export function meetingsNoteFor(m: Meetings | TeamMeetings, opp: string, gamesWord: string, who: 'his' | "the team's"): string {
  const n = m.games.length
  const earlierGames = m.games.filter((g) => g.kind === 'earlier')
  const thisSeason = n - earlierGames.length
  const head = n >= MEETINGS_COUNT ? `The last ${n}` : `All ${n}`
  const onRecord = n >= MEETINGS_COUNT ? '' : ' on record'
  switch (m.scope) {
    case 'season':
      return `${head} ${gamesWord} against ${opp}${onRecord}, all in ${m.currentSeason}.`
    case 'filled':
      return `${head} ${gamesWord} against ${opp}${onRecord}: ${thisSeason} in ${m.currentSeason}, plus ${earlierGames.length} from earlier seasons (${seasonSpan(earlierGames.map((g) => g.seasonLabel))}), which are marked.`
    case 'earlier':
      return `No ${gamesWord} against ${opp} in ${m.currentSeason} yet. These are ${n === 1 ? `${who} 1 meeting` : `${who} last ${n} meetings`}, from ${seasonSpan(earlierGames.map((g) => g.seasonLabel))}, marked as such.`
    default:
      return `No ${gamesWord} against ${opp} on record for ${who === 'his' ? 'this player' : 'this team'}.`
  }
}

export const meetingsNote = (m: Meetings, opp: string, gamesWord: string): string => meetingsNoteFor(m, opp, gamesWord, 'his')

/** The tag in the Season column: the season for the current season's games, "Earlier · 2024-25" for the rest. */
export function seasonTag(kind: 'this' | 'earlier', seasonLabel: string): string {
  return kind === 'earlier' ? `Earlier · ${seasonLabel}` : seasonLabel
}
