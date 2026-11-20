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

// A team's roster for the matchup view: each player on this season's roster with his last-10 average of each stat (player_form
// holds one row per player and stat) and how many of his last 10 games played he STARTED (player_season_games). Regular season
// only. Most starts first, then most minutes.
export const ROSTER_STATS = ['minutes', 'pts', 'reb', 'ast', 'fg3m', 'blk', 'stl']
export const ROSTER_SQL = `
  WITH r AS (
    SELECT person_id, player_name, stat, l10_games, l10_mean
    FROM ${TABLE}
    WHERE game_type = '${GAME_TYPE}' AND team_tricode = :team AND last_season_label = ${CURRENT}
      AND stat IN (${ROSTER_STATS.map((x) => `'${x}'`).join(', ')})),
  last10 AS (
    SELECT person_id, started FROM (
      SELECT person_id, started, row_number() OVER (PARTITION BY person_id ORDER BY game_date DESC, game_id DESC) AS rn
      FROM ${SEASON_TABLE}
      WHERE game_type = '${GAME_TYPE}' AND played AND person_id IN (SELECT person_id FROM r)) x
    WHERE rn <= 10),
  starts AS (SELECT person_id, count_if(started) AS starts FROM last10 GROUP BY person_id),
  wide AS (
    SELECT r.person_id, max(r.player_name) AS player_name, max(r.l10_games) AS l10_games, coalesce(max(s.starts), 0) AS starts,
           ${ROSTER_STATS.map((x) => `max(IF(r.stat = '${x}', r.l10_mean, NULL)) AS ${x}`).join(', ')}
    FROM r LEFT JOIN starts s ON s.person_id = r.person_id
    GROUP BY r.person_id)
  SELECT person_id, player_name, l10_games, starts, ${ROSTER_STATS.join(', ')}
  FROM wide
  ORDER BY starts DESC, minutes DESC NULLS LAST, player_name`

/** Rows -> [{ id, name, games, starts, stats: { minutes, pts, ... } }] in the query's order (starters first). */
export function mapRoster(rows) {
  return rows.map((r) => ({
    id: r[0],
    name: r[1],
    games: num(r[2]),
    starts: num(r[3]) ?? 0,
    stats: Object.fromEntries(ROSTER_STATS.map((s, i) => [s, num(r[4 + i])])),
  }))
}

/** The team-list and player-list SQL for the page's game type (regular season = this season's roster). */
export const teamsSqlFor = (gameType) => (gameType === 'playoffs' ? PLAYOFF_TEAMS_SQL : TEAMS_SQL)
export const playersSqlFor = (gameType) => (gameType === 'playoffs' ? PLAYOFF_PLAYERS_SQL : PLAYERS_SQL)

// The player's last 10 games PLAYED of one game type, across seasons if needed (the same window the scorecards describe).
// Read from player_season_games (every row there is one game of one team; `played` is the owner's rule: any minutes, any stat
// above 0, or a non-zero plus/minus). Newest first here; mapGames turns it around so the line runs oldest to newest.
export const GAMES_WINDOW = 10
const lastGamesSql = (n) => `
  SELECT game_id, game_date, opponent_tricode, is_home, season_label, minutes, pts, reb, ast, fg3m, blk, stl
  FROM ${SEASON_TABLE}
  WHERE person_id = :id AND game_type = :gt AND played
  ORDER BY game_date DESC, game_id DESC
  LIMIT ${n}`
export const GAMES_SQL = lastGamesSql(GAMES_WINDOW)
// The box-score table: his last 15 games played of one game type, any opponent, with the fuller box score (the 11 extra columns
// gold player_season_games carries for played games). The first 12 columns are exactly GAMES_SQL's, so the first 10 games are the
// ones the scorecards describe.
export const GAMELOG_WINDOW = 15
export const GAMELOG_SQL = `
  SELECT game_id, game_date, opponent_tricode, is_home, season_label, minutes, pts, reb, ast, fg3m, blk, stl,
         started, fgm, fga, fg3a, ftm, fta, oreb, dreb, tov, pf, plus_minus
  FROM ${SEASON_TABLE}
  WHERE person_id = :id AND game_type = :gt AND played
  ORDER BY game_date DESC, game_id DESC
  LIMIT ${GAMELOG_WINDOW}`

// A player's games against ONE opponent, of one game type: his LAST 10 meetings, however far back they are (owner's choice,
// 2026-11-17; before that it was this season's, topped up from last season only). The SQL returns them newest first, capped
// at MEETINGS_COUNT, with is_current marking the current season's (the newest season that has any game of this type); a game
// from any earlier season is marked 'earlier' so the page can say so. The data starts in 2021-22, so a matchup can have fewer
// than 10. The opponent is named by tricode and looked up to its team id, so a team that changed tricode in the past is still
// matched by id. Regular season and playoffs are never mixed (one game type per request).
export const MEETINGS_COUNT = 10
export const MEETINGS_SQL = `
  SELECT game_id, game_date, team_tricode, opponent_tricode, is_home, season_label, minutes, pts, reb, ast, fg3m, blk, stl,
         season = (SELECT max(season) FROM ${SEASON_TABLE} WHERE game_type = :gt) AS is_current,
         (SELECT max_by(season_label, season) FROM ${SEASON_TABLE} WHERE game_type = :gt) AS current_season
  FROM ${SEASON_TABLE}
  WHERE person_id = :id AND game_type = :gt AND played
    AND opponent_team_id = (SELECT max_by(team_id, game_date) FROM ${SEASON_TABLE} WHERE team_tricode = :opp)
  ORDER BY game_date DESC, game_id DESC
  LIMIT ${MEETINGS_COUNT}`

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

// Choose what to show of a player's (or team's) meetings. `games` are newest first, each with isCurrent (from the current
// season). Returns { scope, currentSeason, games }: the first MEETINGS_COUNT games, newest first, each with kind 'this' (the
// current season) or 'earlier' (any earlier season). scope: 'season' = all from the current season; 'filled' = some from the
// current season and the rest from earlier ones; 'earlier' = none from the current season; 'none' = no meetings at all.
export function pickMeetings(games, currentSeason) {
  const kept = games.slice(0, MEETINGS_COUNT).map((g) => ({ ...g, kind: g.isCurrent ? 'this' : 'earlier' }))
  const current = kept.filter((g) => g.kind === 'this').length
  const scope = kept.length === 0 ? 'none' : current === kept.length ? 'season' : current > 0 ? 'filled' : 'earlier'
  return { scope, currentSeason, games: kept }
}

// Rows come in MEETINGS_SQL's column order, newest first. Returns { scope, currentSeason, games } (see pickMeetings), games newest first.
export function mapMeetings(rows) {
  const currentSeason = rows.length > 0 ? rows[0][14] : null
  const games = rows.map((r) => ({
    id: r[0], date: r[1], team: r[2], opp: r[3], isHome: bool(r[4]), seasonLabel: r[5], minutes: num(r[6]),
    stats: { pts: num(r[7]), reb: num(r[8]), ast: num(r[9]), fg3m: num(r[10]), blk: num(r[11]), stl: num(r[12]) },
    isCurrent: bool(r[13]),
  }))
  const out = pickMeetings(games, currentSeason)
  return { ...out, games: out.games.map(({ isCurrent: _isCurrent, ...g }) => g) }
}

// Rows come in GAMELOG_SQL's column order, newest first. Returns { games: [...] } newest first, the order of a box-score table; each
// game is a mapGames game plus `box` (the fuller box score). No games gives an empty list.
export function mapGameLog(rows) {
  const base = mapGames(rows.map((r) => r.slice(0, 12))).games.reverse()
  return {
    games: base.map((g, i) => {
      const r = rows[i]
      return {
        ...g,
        box: {
          started: r[12] === null || r[12] === undefined ? null : bool(r[12]),
          fgm: num(r[13]), fga: num(r[14]), fg3a: num(r[15]), ftm: num(r[16]), fta: num(r[17]),
          oreb: num(r[18]), dreb: num(r[19]), tov: num(r[20]), pf: num(r[21]), plusMinus: num(r[22]),
        },
      }
    }),
  }
}
