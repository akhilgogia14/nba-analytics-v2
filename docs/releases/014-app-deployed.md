# Release 014: the app is deployed on Databricks Apps

Date: 2026-11-13 (UTC; the deploy ran at 00:21 UTC; all times below are UTC)
Branch / PR: `docs/release-014-app-deploy`, PR #21 (docs only)
Author: (Claude Code)

## What changed
- A Databricks App named `nba-player-form` now exists in the workspace and is running. Link: https://nba-player-form-7474644725065164.aws.databricksapps.com (sign-in to Databricks required).
- Its page and `/api/health` endpoint (release 013) read `workspace.nba_v2_gold.player_form` live through the SQL warehouse.
- The app has its own machine identity (service principal `app-2v2ku9 nba-player-form`, client id `8f06dddb-8775-4b0d-b35d-06c5a7a01a26`). The owner approved four grants, one by one, and only these were given:
  1. SQL warehouse `22203161b15e3ce0` attached as the app's `sql-warehouse` resource (`CAN_USE`: run queries, nothing else).
  2. `USE CATALOG` on `workspace`.
  3. `USE SCHEMA` on `workspace.nba_v2_gold`.
  4. `SELECT` on `workspace.nba_v2_gold.player_form`.
- The source on Databricks is a copy of the repo's `app/` folder (from `main` at `4d44547`, without `node_modules`, with the locally built `dist/`) uploaded to `/Workspace/Users/dbx.nba@gmail.com/apps/nba-player-form`.
- No code changed in this release. It adds this note and updates `docs/NEXT.md`.

## Why
PLAN.md step 6 and the owner's decision of 2026-11-12: a first pass as a Databricks App, an always-on host (Cloudflare D1 with Pages and Workers) later. This step proves the whole path from the gold table to a live URL, including how the app's own identity gets access.

## How to verify
Commands run from the repo root; outputs are real.
- Create: `databricks apps create nba-player-form --no-compute`. The command reported `failed to reach ACTIVE, got STOPPED`, which is expected with `--no-compute`; the app existed anyway (`databricks apps list` showed it, `STOPPED`).
- Resource: `databricks apps update nba-player-form --json '{"resources":[{"name":"sql-warehouse","sql_warehouse":{"id":"22203161b15e3ce0","permission":"CAN_USE"}}]}'` returned the resource as sent.
- Grants (SQL through the warehouse), all `SUCCEEDED`, then checked with `SHOW GRANTS`: `USE CATALOG` on the catalog, `USE SCHEMA` on the schema, `SELECT` on the table, each listed for the app's client id.
- Upload: `databricks workspace import-dir` of a staged copy of `app/` (21 files), then `databricks apps start` and `databricks apps deploy ... --source-code-path /Workspace/Users/dbx.nba@gmail.com/apps/nba-player-form`. Deploy status `SUCCEEDED`, message `App started successfully`.
- Build log (`databricks apps logs nba-player-form`): Databricks ran `npm install` itself (109 packages, 0 vulnerabilities), then `tsc -b && vite build` (built in 221 ms), then `npm run start`; the server logged `listening on 8000`. Deployment ended in 10.2 s. Security scan completed with no findings.
- State: `RUNNING`, compute `ACTIVE`, "App is running".
- Live check with the owner's CLI token (not printed): `GET /api/health` returned `{"ok":true,"table":"player_form","rows":11935,"lastGameDate":"2026-11-11"}` with HTTP 200; `GET /` returned HTTP 200, 453 bytes, `text/html`.
- Without a token, `GET /api/health` returned HTTP 401, so the app is not public.

## Files added or changed
- `docs/releases/014-app-deployed.md`: this note.
- `docs/NEXT.md`: 13b marked done, next steps listed.

## Risks and things I am unsure about
- **The app stops after about 24 hours** (Databricks Free Edition rule). It was started at 2026-11-13 00:21 UTC, so it will stop around 2026-11-14 00:21 UTC. Restart with `databricks apps start nba-player-form`; a redeploy also resets the clock. It is a demo stage, not always on.
- **Not public.** Anyone opening the link needs access to the Databricks workspace. Sharing it with other people would need extra access settings that I have not tried.
- **The deployed code does not update itself.** It is a manual upload of a copy. A later change needs another upload and `apps deploy`. The CLI can also deploy straight from GitHub with auto-deploy (`--git-url`, `--git-auto-deploy`); I have not tried it.
- **The page was not opened in a browser.** Only the API call and the HTML response were checked.
- Databricks used npm 10.9.9 and built our TypeScript 7 and Vite 8 project without trouble, but I do not know which Node version it runs.
- The SQL warehouse is shared with the daily jobs and the v1 dashboard. If it is asleep, the first request waits for it to start (the server waits up to about 3 minutes).
- The app identity can read `player_form` only. Each new page that needs another table needs another `SELECT` grant, each approved by the owner.
- The workspace app limit on Free Edition is 3; this uses 1.

## Review focus for Codex
- The grant list above: nothing broader than needed.
- That no token, client secret or other secret appears in any log or committed file. (The client id is an identifier, not a secret.)

## Open questions for the owner
1. Which colour theme should be the default: Paper, Midnight, Graphite or Aurora?
2. Should the team and opponent views get their own gold tables (team form, player vs opponent) before or after the first real Player form page?
3. Do you want to try deploying from GitHub with auto-deploy, so the app updates itself after you merge?

## Owner walkthrough
- **What changed:** your website is live. Open the link above, sign in to Databricks if asked, and you will see a plain page that says "Player form" and one line: "player_form: 11,935 rows, latest game 2026-11-11". That line comes live from your table, so it proves the whole chain works: the data, the website's own login, and the page.
- **What the website's login is:** Databricks created a separate account just for the website, named `app-2v2ku9 nba-player-form`. It can only read the one table `player_form` and run queries on the SQL warehouse. It cannot change or delete anything, and it cannot see your other tables. You approved each of those four permissions.
- **What it is not yet:** it is not the designed page yet. That comes next, based on the Scorecards mock-up. It also is not public: only people signed in to your Databricks workspace can open it.
- **The 24-hour limit:** Databricks's free plan turns the app off about a day after it starts. If the link stops working, that is the reason. Restart it with `databricks apps start nba-player-form` (I can do it for you), and it is back in a minute.
- **Where the code lives:** the website's code is in the `app/` folder of this repository. Databricks has its own copy, which I uploaded by hand. If we change the code, the copy needs updating. That is why question 3 asks about automatic updates.
- **What to check yourself:** open the link and confirm you see the row count line. If you see an error message in red instead, tell me what it says.
