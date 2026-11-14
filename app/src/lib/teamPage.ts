import { daysSince, shortDate } from './format.ts'
import { f1 } from './geom.ts'
import { gamesWord } from './gameType.ts'
import type { GameType, LeagueAverages, TeamGame, TeamInfo, TeamMeetings } from '../types.ts'

/** The Teams page's six scorecards, offense first (defense comes later). `pct` stats are written with a % sign. */
export type TeamCard = { key: string; label: string; short: string; pct: boolean; lowerIsBetter: boolean }
export const TEAM_CARDS: TeamCard[] = [
  { key: 'pts', label: 'Points', short: 'PTS', pct: false, lowerIsBetter: false },
  { key: 'fg_pct', label: 'Field goal %', short: 'FG%', pct: true, lowerIsBetter: false },
  { key: 'fg3m', label: '3-pointers made', short: '3PM', pct: false, lowerIsBetter: false },
  { key: 'fg3_pct', label: '3-point %', short: '3P%', pct: true, lowerIsBetter: false },
  { key: 'ast', label: 'Assists', short: 'AST', pct: false, lowerIsBetter: false },
  { key: 'tov', label: 'Turnovers', short: 'TOV', pct: false, lowerIsBetter: true },
]

/** How a card's number is written: one decimal, with a % sign for the percentage cards. */
export const cardFormat = (c: TeamCard) => (c.pct ? (n: number) => `${f1(n)}%` : f1)

/** How ONE game's value is written in the line's bubble: whole numbers stay whole (111 points), percentages get a decimal and a % sign. */
export const pointFormat = (c: TeamCard): ((n: number) => string) | undefined => (c.pct ? (n: number) => `${f1(n)}%` : undefined)

/** The amber notes under the team's name. A playoff window is old by nature. */
export function teamNotices(t: TeamInfo, gameType: GameType, now: Date = new Date()): string[] {
  const out: string[] = []
  const g = gamesWord(gameType)
  if (t.l10Games < 10) out.push(`Only ${t.l10Games} ${g} on record so far. These ranges are rough and will move a lot with each new game.`)
  if (gameType === 'playoffs') {
    out.push(
      `Playoff games only. ${t.name}'s latest playoff game on record was on ${shortDate(t.lastGameDate)} (${t.lastSeasonLabel} playoffs), so these games can reach back across earlier playoff runs.`,
    )
    return out
  }
  if (t.l10GamesBeforeCurrentSeason > 0) {
    out.push(`${t.l10GamesBeforeCurrentSeason} of these ${t.l10Games} games are from before this season, because the new season is young.`)
  }
  const idle = daysSince(t.lastGameDate, now)
  if (idle > 7) out.push(`${t.name} last played on ${shortDate(t.lastGameDate)}, ${idle} days ago.`)
  return out
}

/** "W 107-115" style result: W or L, then the team's points first. */
export function resultText(g: Pick<TeamGame, 'won' | 'pts' | 'oppPts'>): string {
  const score = g.pts === null || g.oppPts === null ? '' : ` ${g.pts}-${g.oppPts}`
  return `${g.won ? 'W' : 'L'}${score}`
}

const mean = (values: (number | null)[]): number | null => {
  const have = values.filter((v): v is number => v !== null)
  return have.length === 0 ? null : Math.round((have.reduce((a, b) => a + b, 0) / have.length) * 10) / 10
}
const sum = (values: (number | null)[]): number | null => {
  const have = values.filter((v): v is number => v !== null)
  return have.length === 0 ? null : have.reduce((a, b) => a + b, 0)
}
const madeAtt = (made: number | null, att: number | null) => (made === null || att === null ? '–' : `${made}-${att}`)
/** A shooting percentage from totals (made / attempts), one decimal, with a % sign; a dash with no attempts. */
export function pctText(made: number | null, att: number | null): string {
  return made === null || att === null || att === 0 ? '–' : `${f1((made / att) * 100)}%`
}

/** The "average of these games" row of the box-score table. Makes and attempts are averaged separately ("40.2-84.1") and a
 * percentage is total made over total attempts (the same pooling as the scorecards). */
export function teamAverageRow(games: TeamGame[]) {
  const col = (f: (g: TeamGame) => number | null) => mean(games.map(f))
  const tot = (f: (g: TeamGame) => number | null) => sum(games.map(f))
  return {
    wins: games.filter((g) => g.won).length,
    pts: col((g) => g.pts), oppPts: col((g) => g.oppPts),
    fg: madeAtt(col((g) => g.box.fgm), col((g) => g.box.fga)), fgPct: pctText(tot((g) => g.box.fgm), tot((g) => g.box.fga)),
    fg3: madeAtt(col((g) => g.box.fg3m), col((g) => g.box.fg3a)), fg3Pct: pctText(tot((g) => g.box.fg3m), tot((g) => g.box.fg3a)),
    ft: madeAtt(col((g) => g.box.ftm), col((g) => g.box.fta)),
    oreb: col((g) => g.box.oreb), reb: col((g) => g.box.reb), ast: col((g) => g.box.ast), tov: col((g) => g.box.tov),
    stl: col((g) => g.box.stl), blk: col((g) => g.box.blk), pf: col((g) => g.box.pf),
  }
}

/** The line above the box-score table: how many games and from which seasons, in words. */
export function teamLogNote(games: TeamGame[], gamesWordText: string): string {
  if (games.length === 0) return `No ${gamesWordText} on record for this team.`
  const wins = games.filter((g) => g.won).length
  const seasons = [...new Set(games.map((g) => g.seasonLabel))]
  const span = seasons.length > 1 ? `, from ${seasons[seasons.length - 1]} to ${seasons[0]}` : ''
  return `The team's last ${games.length} ${gamesWordText}, newest first, against any opponent${span}. ${wins} won, ${games.length - wins} lost.`
}

/** The words above the opponent table, which must make it obvious when games are from last season. */
export function teamMeetingsNote(m: TeamMeetings, opp: string, gamesWordText: string): string {
  const n = m.games.length
  const last = m.games.filter((g) => g.kind === 'last').length
  const thisSeason = n - last
  switch (m.scope) {
    case 'season':
      return `All ${n} ${gamesWordText} against ${opp} in ${m.currentSeason}.`
    case 'filled':
      return `${thisSeason} ${thisSeason === 1 ? 'game' : 'games'} against ${opp} in ${m.currentSeason}, plus ${last} from last season to fill it out. The last-season games are marked.`
    case 'earlier':
      return `No ${gamesWordText} against ${opp} in ${m.currentSeason} yet. These are ${last === 1 ? 'the 1 meeting' : `the ${last} meetings`} from last season, marked as such.`
    default:
      return m.currentSeason ? `No ${gamesWordText} against ${opp} in ${m.currentSeason} or last season.` : `No ${gamesWordText} against ${opp} on record for this team.`
  }
}

/** The sentence that explains the dotted line (null when there is no league figure to explain). */
export function leagueNote(league: LeagueAverages | null, gameType: GameType): string | null {
  if (!league || league.games === 0 || !league.seasonLabel) return null
  const type = gameType === 'playoffs' ? 'playoff' : 'regular-season'
  return `Dashed line: the team's season average. Dotted line: the league average per team game (${league.seasonLabel} ${type}, ${league.games} team games); percentages are total made over total attempted.`
}
