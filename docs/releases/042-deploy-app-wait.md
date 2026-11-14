# Release 042: the auto-deploy waits for a restarted app

Date: 2026-11-14 (UTC)
Branch / PR: `fix/deploy-app-wait` (PR number added after opening)
Author: (Claude Code)

## What changed
- **A race is fixed.** When the app's compute had stopped, the workflow started it and deployed straight away. Starting an app makes Databricks begin a deployment of its own, so my deploy was refused ("pending deployment in progress for less than 20 minutes") and the run failed. This happened on the run for the #53 merge (run 43557659484, 2026-11-14 04:38 UTC); the run for #54 found the app already running and succeeded, so nothing was left broken.
- The "start" step now **waits until the app's compute is active and no deployment is pending** (it checks every 10 seconds, for up to 10 minutes) before the deploy step runs.
- The deploy step **retries** if Databricks still says a deployment is pending (up to 5 attempts, a minute apart). Any other error stops the run at once.
- The keep-alive schedule is now **every 6 hours** (03:41, 09:41, 15:41 and 21:41 UTC) instead of twice a day. Free Edition stopped the app after only about 8 hours (not a fixed 24), and GitHub can start a scheduled run an hour or more late (the 03:41 run had not started by 04:38).
- `CLAUDE.md`'s Deploy section says the same.

## Why
The owner asked for the fix after the failed run. The app should stay up without anyone restarting it by hand.

## How to verify
- Workflow file parsed as valid YAML (Ruby); the two scripts were pulled out of the file and run:
  - the wait step against the real app (running, nothing pending): printed `compute ACTIVE | app RUNNING | pending deployment: none`, then `settled`, exit 0, and started nothing;
  - the deploy step against a fake `databricks` that refuses with the pending error twice and then succeeds: 3 calls, exit 0, `deploy.json` written; against a fake that fails with another error: 1 call, exit 1; against a fake that always says pending: 5 calls, exit 1 with "Still a pending deployment after 5 attempts".
- **Not tested live:** the "app is stopped, so start it and wait" path. Testing it would mean stopping the real app. The first scheduled or manual run that finds the app stopped will exercise it; I will check that run.

## Files changed
- `.github/workflows/deploy-app.yml`, `CLAUDE.md`.

## Risks and things I am unsure about
- Four scheduled deploys a day is more activity on the owner's workspace (each is a real deployment of `main`). The app is not changed unless `main` changed; it is redeployed as it is.
- If Free Edition stops the app for a reason a deploy cannot fix, the run will fail loudly rather than quietly.
- `pending_deployment` is read from `databricks apps get -o json`; if Databricks renames that field the wait would treat everything as "none" and the retry step still protects the deploy.

## Review focus for Codex
(Only if the owner asks.) The wait loop's exit conditions and the retry step's exit codes.

## Owner walkthrough
- **What changed:** nothing you can see on the page. Behind the scenes, the robot that keeps your app online is now more patient. If the app has gone to sleep, it wakes it, waits until it is properly awake, and only then pushes the latest version. It also checks in every 6 hours now instead of every 12, because Databricks put the app to sleep faster than we expected.
- **What to check yourself:** nothing. If you ever see a red "deploy-app" run on GitHub, tell me. Merging this redeploys the app once; the page looks the same.
