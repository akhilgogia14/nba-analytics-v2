# Release 013: app scaffold (React + TypeScript + Vite + Tailwind, Node server)

Date: 2026-11-12
Branch / PR: `feat/app-scaffold`, PR #20
Author: (Claude Code)

## What changed
- New `app/` folder: a Vite + React 19 + TypeScript project with Tailwind v4 wired in. The starter demo page is replaced by a one-screen placeholder.
- A small Node server (`app/server/`, Express) that serves the built page and one endpoint, `/api/health`. The endpoint runs one fixed SQL statement (row count and latest game date of `workspace.nba_v2_gold.player_form`) through the SQL warehouse. The placeholder page shows the result.
- `app/app.yaml`, the start file Databricks Apps reads: `npm run start`, with the SQL warehouse mapped to `DATABRICKS_WAREHOUSE_ID`.
- `.gitignore` now covers `node_modules/` and `app/dist/`.
- Not part of the repo: three clickable design mock-ups (Scorecards, dark analyst table, one stat at a time) with real numbers for four teams and 12 players, in a private design canvas. The owner chose the Scorecards idea (team, then player, then opponent selectors, switchable colour themes) as the starting point.

## Why
PLAN.md step 6 (first visuals from gold) and the owner's decision of 2026-11-12: React + TypeScript + Vite + Tailwind, a first pass as a Databricks App, an always-on host (Cloudflare D1 plus Pages and Workers) later. The page only calls our own `/api/...` endpoints, so moving hosts later means rewriting the small server, not the page.

## How to verify
- `cd app && npm run build`: `tsc -b && vite build` finished in 55 ms, 220 kB JavaScript (69 kB gzipped).
- Local run with the Databricks CLI login, `DATABRICKS_WAREHOUSE_ID=22203161b15e3ce0`, port 8123: `GET /api/health` returned `{"ok":true,"table":"player_form","rows":11935,"lastGameDate":"2026-11-11"}` with HTTP 200; `GET /` returned HTTP 200 (453 bytes); the server log showed only `listening on 8123`.
- The 11,935 rows match `_build_log`: the 22:22 UTC run on 2026-11-12 inserted 11 rows (one new player x 11 stats) and updated 2,442, taking the table from 11,924.
- Not checked: the page in a real browser. Only the API call it depends on was tested.

## Files added or changed
- `app/package.json`, `app/package-lock.json`: dependencies (React, Express, Tailwind, Vite, TypeScript) and scripts (`build`, `start`).
- `app/vite.config.ts`, `app/tsconfig*.json`, `app/.oxlintrc.json`, `app/index.html`, `app/public/favicon.svg`, `app/src/main.tsx`, `app/src/index.css`: project setup.
- `app/src/App.tsx`: the placeholder page that calls `/api/health`.
- `app/server/databricks.mjs`: logs in to Databricks and runs one SQL statement.
- `app/server/index.mjs`: the web server.
- `app/app.yaml`: the Databricks Apps start file.
- `app/README.md`: how to build and run it.
- `.gitignore`: ignore `node_modules/` and `app/dist/`.
- `docs/NEXT.md`: step 13 added.

## Risks and things I am unsure about
- Not deployed yet. I do not know how Databricks runs `npm install` and `npm run build` for this app, which Node version it uses, or whether the app's own identity can be given read access to the gold schema and the warehouse. The first deploy answers these.
- Very new tool versions: Node 26.13.1 locally, TypeScript 7, Vite 8. If the Databricks runtime is older, the build could fail there.
- Login: on Databricks the server asks for a short-lived token with the app's client id and secret (injected by the platform); locally it borrows the CLI token. The Databricks path is untested. No token is printed or stored.
- The endpoint uses a fixed SQL string. Any later endpoint that takes a team, player or opponent must use parameters or an allow-list, never string-building.
- A sleeping warehouse can take a minute or more to start; the server waits up to about 3 minutes, and the page shows a waiting message.
- The mock-ups use values computed in Python from `player_game_log` and `team_game` (four teams, 12 players). Only Brunson's last-10 points were cross-checked against `player_form`. Opponent splits cover every game since Oct 2021, including a player's games with previous teams.

## Review focus for Codex
- `app/server/databricks.mjs`: token handling, that nothing secret is logged, and that the SQL string is never built from user input.
- `app/.gitignore` and the root `.gitignore`: nothing generated or secret is committed.

## Open questions for the owner
1. Which colour theme should be the default: Paper, Midnight, Graphite or Aurora?
2. The team and opponent views need new gold tables (team form, player vs opponent). Add them once the first real page is up?

## Owner walkthrough
- **What changed:** there is now a small website project in the `app/` folder. It does one thing so far: it shows one line of text, "player_form: 11,935 rows, latest game 2026-11-11". The number comes live from your gold table, so it proves the website can read your data.
- **What it looks like:** a plain page with the title "Player form" and that one line. It looks empty on purpose. The design you liked comes next, on top of this.
- **What the files are:** the page you see is `app/src/App.tsx`. The small program behind it is `app/server/index.mjs`. It fetches the number from Databricks, and `app/server/databricks.mjs` does the logging in. `app/app.yaml` is a note that tells Databricks how to start the website when we put it there. `package.json` lists the building blocks the site uses, and `package-lock.json` pins their exact versions.
- **What is not here yet:** the website is not on Databricks yet. That is the next step. The design mock-ups live in a separate private design page, not in the repo.
- **What to check yourself:** nothing needs checking before merging. The PR only adds files. After the next step you will be able to open the app's link in your browser.
