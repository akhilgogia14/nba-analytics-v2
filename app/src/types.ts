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

/** The page's toggle: it shows one game type at a time, never a mix. */
export type GameType = 'regular-season' | 'playoffs'
/** A player with no games of the chosen type (only seen for the playoffs). */
export type NoGames = { none: true; gameType: GameType }
export type FormResult = Form | NoGames

/** The six stats the season chart can show. */
export type GridStat = 'pts' | 'reb' | 'ast' | 'fg3m' | 'blk' | 'stl'

/** One team game in a player's season grid. `played` is false for a game he missed (its stats are then null). */
export type SeasonGame = {
  id: string
  /** The game's place among the team's games of this type that season (1 = first). */
  n: number
  date: string
  opp: string
  isHome: boolean
  played: boolean
  minutes: number | null
  stats: Record<GridStat, number | null>
}

/** All of one team's games of one game type in one season. A traded player has one grid per team. */
export type SeasonGrid = {
  gameType: 'regular-season' | 'playoffs'
  seasonLabel: string
  teamId: string
  team: string
  /** Tricodes of the player's other teams that season and game type, e.g. "WAS" or "AAA,BBB"; null if he had one. */
  otherTeams: string | null
  teamGames: number
  games: SeasonGame[]
}

export type Season = { grids: SeasonGrid[] }
