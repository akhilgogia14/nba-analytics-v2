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

/** One game against the chosen opponent. kind says whether it is from the current season or an earlier one. */
export type MeetingGame = {
  id: string
  date: string
  team: string
  opp: string
  isHome: boolean
  seasonLabel: string
  minutes: number | null
  stats: Record<'pts' | 'reb' | 'ast' | 'fg3m' | 'blk' | 'stl', number | null>
  kind: 'this' | 'earlier'
}
/** A player against one opponent: the last 10 meetings, newest first, from any season. scope: season (all from the current season), filled (some current, the rest earlier), earlier (none from the current season), none. */
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
export type TeamMeetingGame = TeamGame & { kind: 'this' | 'earlier' }
export type TeamMeetings = { scope: 'season' | 'filled' | 'earlier' | 'none'; currentSeason: string | null; games: TeamMeetingGame[] }

/** The league average of each team stat, per team game, for one game type in the latest season that has games of it. */
export type LeagueAverages = { seasonLabel: string | null; games: number; stats: Record<string, number | null> }

/** One team's rest facts going into a game (null when the data has no row for it). Days of rest and rest edge are null for a season opener. */
export type SideContext = {
  daysRest: number | null
  isB2b: boolean
  is3In4: boolean
  is4In6: boolean
  stintGame: number | null
  restEdge: number | null
  /** This team's games in the 4 / 6 days ending on this game's date, this game included. */
  gamesIn4: number | null
  gamesIn6: number | null
}

/** One game on the Today's games page. Scores and the winner are null until the game is final. */
export type SlateGame = {
  id: string
  date: string
  home: string
  away: string
  homeName: string
  awayName: string
  homePts: number | null
  awayPts: number | null
  isFinal: boolean
  homeWon: boolean | null
  homeContext: SideContext | null
  awayContext: SideContext | null
}
/** A team's average points scored and allowed per game this season so far, however few games that is. */
export type SlateAverage = { games: number; pts: number | null; allowed: number | null; seasonLabel: string | null }
export type Slate = { games: SlateGame[]; averages: Record<string, SlateAverage> }

/** Advanced stats (Teams): how games split by situation. A bucket is a group of games (all, home, away, back-to-back, ...). */
export type ContextStat = 'pts' | 'allowed' | 'margin' | 'fg_pct' | 'fg3m' | 'tov'
export type ContextBucket = { n: number; stats: Record<ContextStat, number | null> }
export type ContextSplit = { buckets: Record<string, ContextBucket>; firstSeason: string | null; lastSeason: string | null }
export type NextGame = {
  id: string; date: string; opp: string; isHome: boolean; daysRest: number | null; isB2b: boolean | null
  gamesIn4: number; gamesIn6: number; is3In4: boolean; is4In6: boolean; stintGame: number; oppDaysRest: number | null
  restEdge: number | null; seasonLabel: string
}
export type TeamContext = { next: NextGame | null; team: ContextSplit; league: ContextSplit }

/** Advanced stats (Players). A bucket is a group of the team's games (all, home, away, back-to-back, ...). `n` is the games the
 *  player PLAYED (what the averages are made from); `scheduled` is every team game in that situation, so n / scheduled is availability. */
export type PlayerStat = 'pts' | 'reb' | 'ast' | 'fg3m' | 'blk' | 'stl' | 'minutes'
export type PlayerBucket = { n: number; scheduled: number; stats: Record<PlayerStat, number | null> }
export type PlayerSplit = { buckets: Record<string, PlayerBucket>; firstSeason: string | null; lastSeason: string | null }
/** `player` holds his own averages; `league` holds each stat as the average difference from a player's own season average. */
export type PlayerContext = { team: string | null; next: NextGame | null; player: PlayerSplit; league: PlayerSplit }

/** Defense by position (Teams > Advanced stats): what the OPPONENT's players put up against one team, grouped by role (started the game or
 *  not) and the roster's listed position. `games` = the team's defended games counted; `playerGames` = opposing player-games in the group. */
export type DefenseStat = 'pts' | 'reb' | 'ast' | 'fg3m' | 'blk' | 'stl'
export type DefenseCell = { perGame: number | null; low: number | null; high: number | null; per36: number | null }
export type DefenseGroup = {
  role: 'starter' | 'bench'
  label: string
  games: number
  playerGames: number
  minutes: number | null
  stats: Record<DefenseStat, DefenseCell>
}
export type DefenseSplit = { groups: DefenseGroup[]; firstSeason: string | null; lastSeason: string | null }
/** `team` is the team's newest season of the game type; `league` is every team over every season on record. */
export type TeamDefense = { team: DefenseSplit; league: DefenseSplit }
