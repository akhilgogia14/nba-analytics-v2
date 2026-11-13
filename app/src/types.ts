// What the server sends. Numbers can be null if the table has a gap.
export type Team = { team: string; players: number }
export type PlayerOption = { id: string; name: string; l10Games: number; minutes: number | null }

export type ApiStat = {
  mean: number | null
  median: number | null
  p10: number | null
  p90: number | null
  min: number | null
  max: number | null
  seasonMean: number | null
  /** Share of games with 0, 1, 2 and 3+ (only for 3-pointers, blocks and steals). */
  shares: number[] | null
}

export type PlayerInfo = {
  name: string
  team: string
  lastGameDate: string
  lastSeasonLabel: string
  totalGames: number
  seasonLabel: string
  seasonGames: number
  l10Games: number
  l10FirstDate: string
  l10GamesBeforeCurrentSeason: number
}

export type Form = { player: PlayerInfo; stats: Record<string, ApiStat> }
