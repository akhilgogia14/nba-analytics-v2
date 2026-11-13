# Release 031: the app deploys itself from GitHub

Date: 2026-11-13 (UTC)
Branch / PR: `ci/auto-deploy-app` (PR number added after opening)
Author: (Claude Code)

## What changed
- New GitHub Actions workflow `.github/workflows/deploy-app.yml` (name: `deploy-app`) that deploys the "Player form" app from `main`.
- **When it runs:** (1) whenever a change under `app/` (or the workflow file itself) lands on `main`, i.e. right after you merge a pull request; (2) twice a day (about 03:41 and 15:41 UTC; GitHub may start these hours late), because Databricks Free Edition stops an app about 24 hours after its last deploy and a fresh deploy keeps it running; (3) from the "Run workflow" button.
- **What it does, in order:** installs the app's packages, runs the type check, the linter, all the tests and the build (any failure stops everything and nothing is deployed); sends the app source to the Databricks workspace; starts the app if it is stopped; deploys; checks the deployment succeeded and the app is running; writes a short summary on the run page.
- **Safety:** it only deploys `main` (a button run from any other branch is skipped); two deploys never overlap; it uses the same two secrets the daily sync already has (`DATABRICKS_HOST`, `DATABRICKS_TOKEN`), so **no new secret was needed**, and it prints neither.
- It does not touch data, tables, grants, R2 or the daily sync.

## Why
The owner asked for a GitHub action to deploy, which also ends the manual restart every 24 hours. This replaces "say deploy" with "merge the pull request": merging to `main` is now what approves a deploy.

## How to verify
- The workflow file parses (checked with Ruby's YAML reader); the commands in it were run by hand against the real app earlier in this project, and its check on the deploy result was tried on a good and a bad sample (exit 0 and 1).
- **Not tested on GitHub yet:** a workflow can only run from `main`, so its first real run is the one triggered by merging this pull request. That first run will also deploy the current `main`, which includes pull request #38 (meetings fill from last season only). If it fails, the live app stays as it is; open the run page and tell me.

## First run (2026-11-13): failed safely, then fixed
- The run triggered by merging the pull request failed at the "Check the app" step: `npm test` passed the folder `tests/` to `node --test`, which GitHub's Node 24 reads as a file name (MODULE_NOT_FOUND). Nothing was deployed and the live app was unchanged, which is what the check is for. Fix: the test command is now `node --test tests/*.test.mjs` (same 97 tests, 97 pass locally). The next merge to `main` that touches `app/` reruns it; the result is recorded below once seen.

## Files added or changed
- `.github/workflows/deploy-app.yml` (new), `CLAUDE.md` (one line), `docs/NEXT.md`.

## Risks and things I am unsure about
- **The token.** The deploy uses `DATABRICKS_TOKEN`, a personal access token. If it expires, both this workflow and the daily sync fail; replace the secret.
- **Free Edition limits.** If Databricks changes how long a free app stays up, the twice-a-day deploy may need adjusting. If the app does stop, the workflow starts it again at its next run.
- **A failing check blocks the twice-a-day deploy too**, so a broken `main` could let the app lapse; it will show as a red run.
- Whether the Databricks CLI starts a stopped app cleanly inside the workflow has not been seen end to end.

## Review focus for Codex
- Secrets handling and the `if: github.ref == 'refs/heads/main'` guard; what an expired token does.

## Owner walkthrough
- **What changes for you:** you no longer type "deploy". When you merge a pull request that changes the app, GitHub rebuilds and deploys it within a few minutes. Twice a day it also re-deploys by itself so the free app keeps running.
- **Where to look:** on GitHub, open the Actions tab and click `deploy-app`. A green tick means the app is live with the latest `main`; a red cross means it was not deployed and the app is unchanged. The run page shows the deployment id.
- **To deploy by hand:** Actions, `deploy-app`, "Run workflow", pick `main`.
- **First time:** merging this pull request starts the first run, which deploys the latest `main`.
- **What each new file does:** `deploy-app.yml` is the list of steps GitHub follows: check, upload, start if needed, deploy, confirm.
