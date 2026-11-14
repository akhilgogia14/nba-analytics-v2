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

/** One game in a player's last-10 window (the line under each scorecard). `stats` can hold nulls if the table has a gap. */
export type RecentGame = {
  id: string
  date: string
  opp: string
  isHome: boolean
  seasonLabel: string
  minutes: number | null
  stats: Record<GridStat, number | null>
}
/** The last 10 games played of one game type, oldest first. */
export type Recent = { games: RecentGame[] }

/** One game against the chosen opponent. kind says which season it is from, relative to the current one. */
export type MeetingGame = {
  id: string
  date: string
  team: string
  opp: string
  isHome: boolean
  seasonLabel: string
  minutes: number | null
  stats: Record<'pts' | 'reb' | 'ast' | 'fg3m' | 'blk' | 'stl', number | null>
  kind: 'this' | 'last'
}
/** A player against one opponent, newest game first. scope: season (7+ this season), filled (topped up from last season), earlier (none this season, so last season's), none. */
export type Meetings = { scope: 'season' | 'filled' | 'earlier' | 'none'; currentSeason: string | null; games: MeetingGame[] }

/** The rest of a played game's box score (any of these can be null if the source had a gap). */
export type Box = {
  started: boolean | null
  fgm: number | null; fga: number | null; fg3a: number | null; ftm: number | null; fta: number | null
  oreb: number | null; dreb: number | null; tov: number | null; pf: number | null; plusMinus: number | null
}
/** A game in the box-score table: the same as a RecentGame plus the fuller box score. */
export type LogGame = RecentGame & { box: Box }

/** What a sparkline needs from a game: the stats are keyed by name so the same line works for players and teams. */
export type SparkGame = { id: string; date: string; opp: string; isHome: boolean; stats: Record<string, number | null> }

// ---- Teams page ----
/** The team's facts for its last-10 window (from team_form). */
export type TeamInfo = {
  name: string
  tricode: string
  lastGameDate: string
  lastSeasonLabel: string
  totalGames: number
  seasonLabel: string
  seasonGames: number
  l10Games: number
  l10FirstDate: string
  l10GamesBeforeCurrentSeason: number
  l10Wins: number
}
export type TeamForm = { team: TeamInfo; stats: Record<string, Omit<ApiStat, 'shares'>> }
export type TeamFormResult = TeamForm | NoGames

/** A team's box score for one game (any of these can be null if the source had a gap). */
export type TeamBox = {
  fgm: number | null; fga: number | null; fg3m: number | null; fg3a: number | null; ftm: number | null; fta: number | null
  oreb: number | null; dreb: number | null; reb: number | null; ast: number | null; stl: number | null; blk: number | null
  tov: number | null; pf: number | null
}
/** One team game. `stats` is keyed like team_form's stats (pts, fg_pct, fg3m, fg3_pct, ft_pct, ast, tov, ...). */
export type TeamGame = {
  id: string
  date: string
  opp: string
  isHome: boolean
  seasonLabel: string
  won: boolean
  pts: number | null
  oppPts: number | null
  margin: number | null
  overtimes: number | null
  stats: Record<string, number | null>
  box: TeamBox
}
export type TeamMeetingGame = TeamGame & { kind: 'this' | 'last' }
export type TeamMeetings = { scope: 'season' | 'filled' | 'earlier' | 'none'; currentSeason: string | null; games: TeamMeetingGame[] }
