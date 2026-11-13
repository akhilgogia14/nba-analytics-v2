// Talks to Databricks from the server only. The browser never sees a token.
//
// Who are we logged in as?
//  - On Databricks Apps the platform injects DATABRICKS_HOST, DATABRICKS_CLIENT_ID and
//    DATABRICKS_CLIENT_SECRET (the app's own identity), so we ask for a short-lived token.
//  - On a laptop we fall back to DATABRICKS_TOKEN, or to the Databricks CLI login.
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const run = promisify(execFile)

function hostUrl() {
  const raw = process.env.DATABRICKS_HOST
  if (!raw) throw new Error('DATABRICKS_HOST is not set')
  return raw.startsWith('http') ? raw.replace(/\/$/, '') : `https://${raw.replace(/\/$/, '')}`
}

let cached = { token: '', expiresAt: 0 }

async function getToken() {
  if (cached.token && Date.now() < cached.expiresAt) return cached.token

  const id = process.env.DATABRICKS_CLIENT_ID
  const secret = process.env.DATABRICKS_CLIENT_SECRET
  if (id && secret) {
    const res = await fetch(`${hostUrl()}/oidc/v1/token`, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials&scope=all-apis',
    })
    if (!res.ok) throw new Error(`Token request failed: HTTP ${res.status}`)
    const body = await res.json()
    cached = { token: body.access_token, expiresAt: Date.now() + (body.expires_in - 120) * 1000 }
    return cached.token
  }

  if (process.env.DATABRICKS_TOKEN) return process.env.DATABRICKS_TOKEN

  // Laptop only: borrow the token the Databricks CLI already has.
  const profile = process.env.DATABRICKS_CONFIG_PROFILE || 'DEFAULT'
  const { stdout } = await run('databricks', ['auth', 'token', '--profile', profile, '-o', 'json'])
  cached = { token: JSON.parse(stdout).access_token, expiresAt: Date.now() + 10 * 60 * 1000 }
  return cached.token
}

async function api(path, init = {}) {
  const res = await fetch(`${hostUrl()}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${await getToken()}`, 'Content-Type': 'application/json' },
  })
  if (!res.ok) throw new Error(`Databricks API ${path} failed: HTTP ${res.status}`)
  return res.json()
}

// Run one fixed SQL statement and return its rows as arrays of strings.
// Never build `statement` from user input.
export async function sql(statement) {
  const warehouse_id = process.env.DATABRICKS_WAREHOUSE_ID
  if (!warehouse_id) throw new Error('DATABRICKS_WAREHOUSE_ID is not set')

  let r = await api('/api/2.0/sql/statements', {
    method: 'POST',
    body: JSON.stringify({ warehouse_id, statement, wait_timeout: '30s', on_wait_timeout: 'CONTINUE', format: 'JSON_ARRAY' }),
  })
  // A stopped warehouse takes a while to start, so keep asking until it finishes (max ~3 min).
  for (let i = 0; i < 36 && (r.status.state === 'PENDING' || r.status.state === 'RUNNING'); i++) {
    await new Promise((ok) => setTimeout(ok, 5000))
    r = await api(`/api/2.0/sql/statements/${r.statement_id}`)
  }
  if (r.status.state !== 'SUCCEEDED') {
    throw new Error(`SQL ${r.status.state}: ${r.status.error?.message ?? 'no detail'}`)
  }
  return r.result?.data_array ?? []
}
