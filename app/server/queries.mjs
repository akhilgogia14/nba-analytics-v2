// The three questions the page asks, as fixed SQL plus small pure helpers (easy to test).
// The form figures read workspace.nba_v2_gold.player_form: one row per player, game type and stat. The page shows ONE game
// type at a time (its toggle: regular season or playoffs), so a regular-season figure is never blended with playoff games.
// The season chart reads workspace.nba_v2_gold.player_season_games (see SEASON_SQL). The app identity has SELECT on
// those two gold tables and nothing else.

const TABLE = 'workspace.nba_v2_gold.player_form'
const GAME_TYPE = 'regular-season'
// "Current season" = the newest season label in the table. Only players who played in it are listed.
const CURRENT = `(SELECT max(last_season_label) FROM ${TABLE} WHERE game_type = '${GAME_TYPE}')`

// The two game types the page can show (the page's toggle). Anything else is refused before it reaches SQL.
export const GAME_TYPES = ['regular-season', 'playoffs']
export function validGameType(v) {
  return typeof v === 'string' && GAME_TYPES.includes(v)
}

export const STATS = ['pts', 'reb', 'ast', 'fg3m', 'blk', 'stl', 'pra', 'pr', 'pa', 'ra', 'minutes']

// ---- input checks (the only user input is a team code and a player id) ----
export function validTeam(v) {
  return typeof v === 'string' && /^[A-Z]{3}$/.test(v)
}
export function validPlayerId(v) {
  return typeof v === 'string' && /^[0-9]{1,12}$/.test(v)
}

// ---- queries ----
export const TEAMS_SQL = `
  SELECT team_tricode, count(*) AS players
  FROM ${TABLE}
  WHERE stat = 'pts' AND game_type = '${GAME_TYPE}' AND last_season_label = ${CURRENT}
  GROUP BY team_tricode ORDER BY team_tricode`

export const PLAYERS_SQL = `
  SELECT p.person_id, p.player_name, p.l10_games, m.l10_mean AS minutes
  FROM ${TABLE} p JOIN ${TABLE} m ON m.person_id = p.person_id AND m.game_type = p.game_type AND m.stat = 'minutes'
  WHERE p.stat = 'pts' AND p.game_type = '${GAME_TYPE}' AND p.team_tricode = :team AND p.last_season_label = ${CURRENT}
  ORDER BY m.l10_mean DESC, p.player_name`

export const FORM_SQL = `
  SELECT stat, player_name, team_tricode, last_game_date, last_season_label, total_games, season_label,
         season_games, l10_games, l10_first_date, l10_games_before_current_season,
         l10_mean, l10_median, l10_p10, l10_p90, l10_min, l10_max,
         l10_share_0, l10_share_1, l10_share_2, l10_share_3plus, season_mean
  FROM ${TABLE} WHERE person_id = :id AND game_type = :gt`

// One player's season grid: every game of each team he played for, in the latest season he has games in, for each of
// regular season and playoffs. Rows carry their game type, and the page draws one grid per (game type, team), so a
// regular-season game and a playoff game are never in the same grid or the same average.
const SEASON_TABLE = 'workspace.nba_v2_gold.player_season_games'
export const SEASON_GAME_TYPES = ['regular-season', 'playoffs']
export const SEASON_SQL = `
  SELECT t.game_type, t.season_label, t.team_id, t.team_tricode, t.other_teams, t.team_games, t.game_number,
         t.game_id, t.game_date, t.opponent_tricode, t.is_home, t.played, t.minutes,
         t.pts, t.reb, t.ast, t.fg3m, t.blk, t.stl
  FROM ${SEASON_TABLE} t
  WHERE t.person_id = :id AND t.game_type IN ('regular-season', 'playoffs')
    AND t.season = (SELECT max(x.season) FROM ${SEASON_TABLE} x WHERE x.person_id = t.person_id AND x.game_type = t.game_type)
  ORDER BY t.game_type, t.team_id, t.game_number`

// The pickers in PLAYOFFS mode: only teams and players that were in the latest playoffs (the newest season that has any
// playoff game). They read player_season_games, whose grid has the team the player actually played the playoffs for
// (player_form only knows his current team). A grid exists only if he played at least one playoff game for that team.
const PLAYOFFS_SEASON = `(SELECT max(season) FROM ${SEASON_TABLE} WHERE game_type = 'playoffs')`
export const PLAYOFF_TEAMS_SQL = `
  SELECT team_tricode, count(DISTINCT person_id) AS players
  FROM ${SEASON_TABLE}
  WHERE game_type = 'playoffs' AND season = ${PLAYOFFS_SEASON}
  GROUP BY team_tricode ORDER BY team_tricode`
// Same four columns as PLAYERS_SQL: id, name, games (his playoff games that season, not the last-10 count), minutes.
export const PLAYOFF_PLAYERS_SQL = `
  SELECT person_id, max(player_name) AS player_name, count_if(played) AS games,
         avg(CASE WHEN played THEN minutes END) AS minutes
  FROM ${SEASON_TABLE}
  WHERE game_type = 'playoffs' AND team_tricode = :team AND season = ${PLAYOFFS_SEASON}
  GROUP BY person_id ORDER BY minutes DESC NULLS LAST, player_name`

/** The team-list and player-list SQL for the page's game type (regular season = this season's roster). */
export const teamsSqlFor = (gameType) => (gameType === 'playoffs' ? PLAYOFF_TEAMS_SQL : TEAMS_SQL)
export const playersSqlFor = (gameType) => (gameType === 'playoffs' ? PLAYOFF_PLAYERS_SQL : PLAYERS_SQL)

// The player's last 10 games PLAYED of one game type, across seasons if needed (the same window the scorecards describe).
// Read from player_season_games (every row there is one game of one team; `played` is the owner's rule: any minutes, any stat
// above 0, or a non-zero plus/minus). Newest first here; mapGames turns it around so the line runs oldest to newest.
export const GAMES_WINDOW = 10
export const GAMES_SQL = `
  SELECT game_id, game_date, opponent_tricode, is_home, season_label, minutes, pts, reb, ast, fg3m, blk, stl
  FROM ${SEASON_TABLE}
  WHERE person_id = :id AND game_type = :gt AND played
  ORDER BY game_date DESC, game_id DESC
  LIMIT ${GAMES_WINDOW}`

// A player's games against ONE opponent, of one game type. The page shows every meeting from the current season (the newest
// season that has any game of this type). If there are fewer than MEETINGS_MIN, it is filled up to MEETINGS_MIN with his most
// recent earlier meetings (last season first), each marked as last season or older so the page can say so. With no meeting
// this season it is simply the last MEETINGS_MIN meetings. The SQL returns his meetings newest first (up to MEETINGS_LIMIT,
// far more than any matchup has had) with is_current marking this season's; mapMeetings makes the choice. The opponent is
// named by tricode and looked up to its team id, so a team that changed tricode in the past is still matched by id.
export const MEETINGS_MIN = 7
export const MEETINGS_LIMIT = 100
export const MEETINGS_SQL = `
  SELECT game_id, game_date, team_tricode, opponent_tricode, is_home, season_label, minutes, pts, reb, ast, fg3m, blk, stl,
         season = (SELECT max(season) FROM ${SEASON_TABLE} WHERE game_type = :gt) AS is_current,
         (SELECT max_by(season_label, season) FROM ${SEASON_TABLE} WHERE game_type = :gt) AS current_season
  FROM ${SEASON_TABLE}
  WHERE person_id = :id AND game_type = :gt AND played
    AND opponent_team_id = (SELECT max_by(team_id, game_date) FROM ${SEASON_TABLE} WHERE team_tricode = :opp)
  ORDER BY game_date DESC, game_id DESC
  LIMIT ${MEETINGS_LIMIT}`

// ---- row mapping (the warehouse returns every value as a string or null) ----
const num = (v) => (v === null || v === undefined ? null : Number(v))

export function mapTeams(rows) {
  return rows.map(([team, players]) => ({ team, players: num(players) }))
}

export function mapPlayers(rows) {
  return rows.map(([id, name, l10Games, minutes]) => ({ id, name, l10Games: num(l10Games), minutes: num(minutes) }))
}

// Returns null when the player id is not in the table.
export function mapForm(rows) {
  if (rows.length === 0) return null
  const first = rows[0]
  const stats = {}
  for (const r of rows) {
    const shares = r[17] === null ? null : [num(r[17]), num(r[18]), num(r[19]), num(r[20])]
    stats[r[0]] = {
      mean: num(r[11]), median: num(r[12]), p10: num(r[13]), p90: num(r[14]), min: num(r[15]), max: num(r[16]),
      seasonMean: num(r[21]), shares,
    }
  }
  return {
    player: {
      name: first[1], team: first[2], lastGameDate: first[3], lastSeasonLabel: first[4], totalGames: num(first[5]),
      seasonLabel: first[6], seasonGames: num(first[7]), l10Games: num(first[8]), l10FirstDate: first[9],
      l10GamesBeforeCurrentSeason: num(first[10]),
    },
    stats,
  }
}

const bool = (v) => v === true || v === 'true'

// Rows come in SEASON_SQL's column order. Returns { grids: [...] }: one grid per game type and team, regular season
// first, and within a game type the team he played for most recently first. A player with no games gets no grids.
export function mapSeason(rows) {
  const grids = new Map()
  for (const r of rows) {
    const key = `${r[0]}|${r[2]}`
    if (!grids.has(key)) {
      grids.set(key, {
        gameType: r[0], seasonLabel: r[1], teamId: r[2], team: r[3], otherTeams: r[4] ?? null, teamGames: num(r[5]), games: [],
      })
    }
    grids.get(key).games.push({
      id: r[7], n: num(r[6]), date: r[8], opp: r[9], isHome: bool(r[10]), played: bool(r[11]), minutes: num(r[12]),
      stats: { pts: num(r[13]), reb: num(r[14]), ast: num(r[15]), fg3m: num(r[16]), blk: num(r[17]), stl: num(r[18]) },
    })
  }
  const lastPlayed = (g) => g.games.reduce((d, x) => (x.played && x.date > d ? x.date : d), '')
  const out = [...grids.values()]
  out.sort(
    (a, b) =>
      SEASON_GAME_TYPES.indexOf(a.gameType) - SEASON_GAME_TYPES.indexOf(b.gameType) ||
      (lastPlayed(b) > lastPlayed(a) ? 1 : lastPlayed(b) < lastPlayed(a) ? -1 : 0) ||
      Number(a.teamId) - Number(b.teamId),
  )
  for (const g of out) g.games.sort((a, b) => a.n - b.n)
  return { grids: out }
}

// Rows come in GAMES_SQL's column order, newest first. Returns { games: [...] } oldest first; no games gives an empty list.
export function mapGames(rows) {
  const games = rows.map((r) => ({
    id: r[0], date: r[1], opp: r[2], isHome: bool(r[3]), seasonLabel: r[4], minutes: num(r[5]),
    stats: { pts: num(r[6]), reb: num(r[7]), ast: num(r[8]), fg3m: num(r[9]), blk: num(r[10]), stl: num(r[11]) },
  }))
  return { games: games.reverse() }
}

// '2026-27' -> '2025-26'
export function previousSeasonLabel(label) {
  const m = /^(\d{4})-\d{2}$/.exec(label ?? '')
  if (!m) return null
  const start = Number(m[1]) - 1
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`
}

// Rows come in MEETINGS_SQL's column order, newest first. Returns { scope, currentSeason, games } with games newest first,
// each game's kind being 'this' (this season), 'last' (the season before) or 'older':
//   scope 'season'  = MEETINGS_MIN or more meetings this season: all of them, nothing from earlier;
//   scope 'filled'  = some meetings this season, topped up to MEETINGS_MIN from earlier seasons;
//   scope 'earlier' = none this season: the last MEETINGS_MIN meetings, from earlier seasons;
//   scope 'none'    = he has never played them (in this game type).
export function mapMeetings(rows) {
  const currentSeason = rows.length > 0 ? rows[0][14] : null
  const lastSeason = previousSeasonLabel(currentSeason)
  const games = rows.map((r) => ({
    id: r[0], date: r[1], team: r[2], opp: r[3], isHome: bool(r[4]), seasonLabel: r[5], minutes: num(r[6]),
    stats: { pts: num(r[7]), reb: num(r[8]), ast: num(r[9]), fg3m: num(r[10]), blk: num(r[11]), stl: num(r[12]) },
    kind: bool(r[13]) ? 'this' : r[5] === lastSeason ? 'last' : 'older',
  }))
  const thisSeason = games.filter((g) => g.kind === 'this')
  const earlier = games.filter((g) => g.kind !== 'this')
  if (thisSeason.length >= MEETINGS_MIN) return { scope: 'season', currentSeason, games: thisSeason }
  if (thisSeason.length > 0) return { scope: 'filled', currentSeason, games: [...thisSeason, ...earlier.slice(0, MEETINGS_MIN - thisSeason.length)] }
  if (earlier.length > 0) return { scope: 'earlier', currentSeason, games: earlier.slice(0, MEETINGS_MIN) }
  return { scope: 'none', currentSeason: null, games: [] }
}
