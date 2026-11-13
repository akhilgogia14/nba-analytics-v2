// The three questions the page asks, as fixed SQL plus small pure helpers (easy to test).
// Everything reads workspace.nba_v2_gold.player_form, the only table the app identity may read.

const TABLE = 'workspace.nba_v2_gold.player_form'
// "Current season" = the newest season label in the table. Only players who played in it are listed.
const CURRENT = `(SELECT max(last_season_label) FROM ${TABLE})`

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
  WHERE stat = 'pts' AND last_season_label = ${CURRENT}
  GROUP BY team_tricode ORDER BY team_tricode`

export const PLAYERS_SQL = `
  SELECT p.person_id, p.player_name, p.l10_games, m.l10_mean AS minutes
  FROM ${TABLE} p JOIN ${TABLE} m ON m.person_id = p.person_id AND m.stat = 'minutes'
  WHERE p.stat = 'pts' AND p.team_tricode = :team AND p.last_season_label = ${CURRENT}
  ORDER BY m.l10_mean DESC, p.player_name`

export const FORM_SQL = `
  SELECT stat, player_name, team_tricode, last_game_date, last_season_label, total_games, season_label,
         season_games, l10_games, l10_first_date, l10_games_before_current_season, l10_games_not_regular,
         l10_mean, l10_median, l10_p10, l10_p90, l10_min, l10_max,
         l10_share_0, l10_share_1, l10_share_2, l10_share_3plus, season_mean
  FROM ${TABLE} WHERE person_id = :id`

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
    const shares = r[18] === null ? null : [num(r[18]), num(r[19]), num(r[20]), num(r[21])]
    stats[r[0]] = {
      mean: num(r[12]), median: num(r[13]), p10: num(r[14]), p90: num(r[15]), min: num(r[16]), max: num(r[17]),
      seasonMean: num(r[22]), shares,
    }
  }
  return {
    player: {
      name: first[1], team: first[2], lastGameDate: first[3], lastSeasonLabel: first[4], totalGames: num(first[5]),
      seasonLabel: first[6], seasonGames: num(first[7]), l10Games: num(first[8]), l10FirstDate: first[9],
      l10GamesBeforeCurrentSeason: num(first[10]), l10GamesNotRegular: num(first[11]),
    },
    stats,
  }
}
