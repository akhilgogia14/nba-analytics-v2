# Release 047: hourly data check, silver only when something is new, app redeploys itself

Date: 2026-11-14
Branch / PR: feat/sync-polling
Author: (Claude Code)

## What changed
- The `daily-sync` workflow now checks for new source data **every hour** at :17 from 14:00 to 23:00 UTC (about 9 AM to 6 PM EST), instead of once at 16:17 UTC.
- After bronze loads, a new step ("Decide whether to build silver") reads the `Files: N | CHANGED: x, UNCHANGED: y` line from `bronze.log`. If nothing changed, the Databricks job (deploy + silver build, about 6 minutes) is skipped and the summary says so.
- The 22:17 UTC run always builds silver (a safety net, and the retry for a day when silver failed after bronze had loaded). A manual run has a new `force_silver` box (on by default); untick it to test the nothing-new path.
- When data changed and silver succeeded, the workflow starts `deploy-app` so the app shows the new numbers within minutes, not at its next 6-hourly slot. If that step fails the sync stays green.

## Why
The source publishes at a different time every day (seen 13:50 to 15:50 UTC), and a single fixed run either misses it or waits hours (PLAN.md: data should reach the app the same morning). Hourly polling is cheap when nothing is new.

## How to verify
- YAML parses (`ruby -ryaml`): schedule entries `17 14-21,23 * * *` and `17 22 * * *`, the `force_silver` input, 12 steps in order.
- The Decide script was run on its own against fake `bronze.log` files: changed (15 of 90) -> build; all unchanged -> skip; unchanged at the 22:17 slot -> build; manual with force on -> build; manual with force off and unchanged -> skip; 3 changed -> build.
- The test caught a bug in my first draft: `UNCHANGED: 90` also contains the text `CHANGED: 90`, so every run would have looked "changed". Fixed with a word boundary (`\bCHANGED`) and re-tested.
- After merge: one manual run with `force_silver` unticked (expect "skipped"), and the next real changed day (expect job + redeploy). Results to be added to this note.

## Files added or changed
- `.github/workflows/daily-sync.yml`: schedule, `force_silver` input, `actions: write` permission, Decide step, gated silver step, summary text, redeploy step.
- `docs/releases/047-sync-polling.md`, `docs/NEXT.md`: this note and the task list.

## Risks and things I am unsure about
- Gating on bronze: if bronze loads but the silver job then fails, the next hourly run sees "unchanged" and skips. Only the 22:17 UTC run (always builds) retries it. A failed silver is red in Actions, so it is visible.
- GitHub starts scheduled runs late (seen up to hours), so hourly is a target, not a promise.
- `permissions: actions: write` lets this workflow start other workflows; it is limited to this repo's token. The redeploy step is untested until a real changed run.
- The workflow still posts to Slack only if a webhook secret exists (none set).
- Cost: about 10 short runs a day (roughly 2 minutes each when nothing is new).

## Review focus for Codex
The Decide shell logic, the `if:` conditions (silver and redeploy), the `github.event.schedule` string match against the cron text, the permission change.

## Open questions for the owner
None; this is the plan you approved ("yes build 1 to 3 and 4").

## Owner walkthrough
Before: the pipeline ran once a day at 11:17 AM EST. If the source published later, you waited until the next day; if it published early, you waited for 11:17 anyway.

Now: every hour from 9 AM to 6 PM EST, a small robot checks whether the source has new files. Most hours the answer is "no", and it stops after about two minutes. When the answer is "yes", it loads the new data, rebuilds the tables, and tells the app to refresh, so the new games show up shortly after the source publishes. Once a day, at 5:17 PM EST, it rebuilds the tables regardless, as a safety net.

You will see this in GitHub, under Actions, as many more "daily-sync" runs. A run that found nothing says "silver: skipped (bronze loaded nothing new)" in its summary. Only one file changed: `.github/workflows/daily-sync.yml`. To test by hand: Actions > daily-sync > Run workflow, and untick "Build silver even if bronze loaded nothing new".
