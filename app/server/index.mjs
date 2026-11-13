import express from 'express'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { sql } from './databricks.mjs'
import {
  FORM_SQL, PLAYERS_SQL, SEASON_SQL, TEAMS_SQL, mapForm, mapPlayers, mapSeason, mapTeams, validPlayerId, validTeam,
} from './queries.mjs'

const app = express()
const dist = fileURLToPath(new URL('../dist', import.meta.url))

// Keep answers for a few minutes so a sleeping or busy warehouse is not asked the same thing again.
// The gold tables only change once a day, so this is safe.
const cache = new Map()
async function cached(key, ttlMs, load) {
  const hit = cache.get(key)
  if (hit && Date.now() < hit.until) return hit.value
  const value = await load()
  cache.set(key, { value, until: Date.now() + ttlMs })
  return value
}
const FIVE_MINUTES = 5 * 60 * 1000

function fail(res, label, err) {
  console.error(`${label} failed:`, err.message)
  res.status(500).json({ ok: false, error: 'Could not read the data. Try again in a minute.' })
}

// One fixed query, no user input: proves the app can read the gold table.
app.get('/api/health', async (_req, res) => {
  try {
    const [row] = await sql(
      'SELECT count(*) AS rows, max(last_game_date) AS last_game_date FROM workspace.nba_v2_gold.player_form',
    )
    res.json({ ok: true, table: 'player_form', rows: Number(row[0]), lastGameDate: row[1] })
  } catch (err) {
    console.error('health check failed:', err.message)
    res.status(500).json({ ok: false, error: err.message })
  }
})

// Teams that have a player in the current season.
app.get('/api/teams', async (_req, res) => {
  try {
    res.json(await cached('teams', FIVE_MINUTES, async () => mapTeams(await sql(TEAMS_SQL))))
  } catch (err) {
    fail(res, 'teams', err)
  }
})

// Current-season players on one team, most minutes first.
app.get('/api/teams/:team/players', async (req, res) => {
  const { team } = req.params
  if (!validTeam(team)) return res.status(400).json({ ok: false, error: 'Team must be three capital letters.' })
  try {
    res.json(
      await cached(`players:${team}`, FIVE_MINUTES, async () =>
        mapPlayers(await sql(PLAYERS_SQL, [{ name: 'team', value: team, type: 'STRING' }])),
      ),
    )
  } catch (err) {
    fail(res, 'players', err)
  }
})

// One player's last-10 form for every stat.
app.get('/api/players/:id/form', async (req, res) => {
  const { id } = req.params
  if (!validPlayerId(id)) return res.status(400).json({ ok: false, error: 'Player id must be digits.' })
  try {
    const form = await cached(`form:${id}`, FIVE_MINUTES, async () =>
      mapForm(await sql(FORM_SQL, [{ name: 'id', value: id, type: 'BIGINT' }])),
    )
    if (form === null) return res.status(404).json({ ok: false, error: 'No such player.' })
    res.json(form)
  } catch (err) {
    fail(res, 'form', err)
  }
})

// One player's season grid (every game of his team or teams, played or not) for the latest season. No grids = empty list.
app.get('/api/players/:id/season', async (req, res) => {
  const { id } = req.params
  if (!validPlayerId(id)) return res.status(400).json({ ok: false, error: 'Player id must be digits.' })
  try {
    res.json(
      await cached(`season:${id}`, FIVE_MINUTES, async () =>
        mapSeason(await sql(SEASON_SQL, [{ name: 'id', value: id, type: 'BIGINT' }])),
      ),
    )
  } catch (err) {
    fail(res, 'season', err)
  }
})

// The built React page.
if (existsSync(dist)) {
  app.use(express.static(dist))
  app.get('/{*splat}', (_req, res) => res.sendFile(`${dist}/index.html`))
}

const port = Number(process.env.DATABRICKS_APP_PORT || process.env.PORT || 8000)
app.listen(port, () => console.log(`listening on ${port}`))
