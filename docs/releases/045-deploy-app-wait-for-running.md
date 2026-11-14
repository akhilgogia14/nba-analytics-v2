# Release 045: the auto-deploy waits for the app to be RUNNING, not just "no deployment pending"

Date: 2026-11-14 (UTC)
Branch / PR: `fix/deploy-app-wait-for-running` (PR number added after opening)
Author: (Claude Code)

## What changed
- **A gap in release 042 is closed.** The first real run that found the app stopped (scheduled run 43613549529, 16:04 UTC) showed the sequence Databricks goes through after a start: compute `ACTIVE` and a deployment **pending**, then the deployment moves to **in progress** while the app still reads `UNAVAILABLE`. My wait looked only at "nothing pending", so it declared the app settled the moment the deployment went from pending to in progress, and the deploy was refused ("Cannot deploy app ... as there is an active deployment in progress"). My retry only recognised the word "pending". The run failed; the app itself came back by the start's own deployment (16:06 UTC, succeeded, same code as `main`), so nothing was lost.
- **The wait now needs all of:** compute `ACTIVE`, no pending deployment, **the last deployment not `IN_PROGRESS`**, and the app `RUNNING`. If the last deployment `FAILED` or was `CANCELLED` the app cannot become `RUNNING` by itself, so that counts as settled (our deploy is then the repair).
- **The wait is best effort:** after 10 minutes it carries on to the deploy (printing a line saying so) instead of failing, because the deploy step has its own retries.
- **The retry** now recognises both refusals, "pending deployment" and "deployment in progress".

## Why
The point of release 042 is that the app stays up without anyone restarting it by hand; the stopped-app path it was written for had never run until today.

## How to verify
- Workflow file parses as valid YAML (Ruby). The two scripts were pulled out of the file and run against a fake `databricks` command:
  - **the real 16:04 sequence replayed** (stopped, then pending, then in progress twice, then running): one start, kept waiting through both "in progress" polls, settled at the fourth poll when the app read `RUNNING`;
  - app already running: settled at once, no start;
  - last deployment `FAILED` with the app `UNAVAILABLE`: settled at once (so a deploy can repair it);
  - never settling (3-poll version): printed "did not settle ... trying the deploy anyway", exit 0;
  - deploy refused twice with "active deployment in progress", then accepted: 3 calls, exit 0, `deploy.json` written.
- **Not tested against the real Databricks:** the exact value `IN_PROGRESS` for a running deployment is Databricks' documented state name, and the log of the failed run shows the refusal text, but I did not see the state itself. The first stopped-app run after this will confirm it, and I will read that run's log.

## Files changed
- `.github/workflows/deploy-app.yml`, `docs/NEXT.md`.

## Risks and things I am unsure about
- **Scheduled runs are unreliable.** Today only one of the expected scheduled deploys ran at all: the 03:41 and 09:41 UTC slots never started, and the 15:41 slot started at 16:04. GitHub does not guarantee scheduled runs. The app was found stopped at 16:04, so it was down for some hours (between 05:47 and 16:04; I cannot tell exactly when it stopped). This release does not change the schedule. A denser schedule (every 3 hours, say) would shorten any gap at the cost of more runs; an always-on host is the real fix (it is already on the plan).
- Each start makes Databricks run its own deployment of the last uploaded code, which is why a stopped app comes back even when our deploy step fails.

## Review focus for Codex
(Only if the owner asks.) The exit conditions of the wait loop, especially the `FAILED` and `CANCELLED` cases.

## Open questions for the owner
1. Should the schedule be denser (every 3 hours) until the always-on host exists?

## Owner walkthrough
- **What changed:** nothing you can see on the page. The robot that keeps your app online was too impatient this afternoon: the app had gone to sleep, the robot woke it, and then tried to push the new version while Databricks was still busy starting it, so it was told to wait. It now waits until the app is properly awake, and retries if it is still told to wait. The app came back by itself that time, so you may not have noticed anything.
- **What to check yourself:** nothing. If you ever open the app and it is not there, tell me the time; it means a sleep that was not caught, and the number of such gaps is what decides whether we need the denser schedule.
