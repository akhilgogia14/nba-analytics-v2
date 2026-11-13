import express from 'express'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { sql } from './databricks.mjs'

const app = express()
const dist = fileURLToPath(new URL('../dist', import.meta.url))

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

// The built React page.
if (existsSync(dist)) {
  app.use(express.static(dist))
  app.get('/{*splat}', (_req, res) => res.sendFile(`${dist}/index.html`))
}

const port = Number(process.env.DATABRICKS_APP_PORT || process.env.PORT || 8000)
app.listen(port, () => console.log(`listening on ${port}`))
