# Release 060: a daily run at 3 PM Eastern

Date: 2026-11-16
Branch / PR: feat/daily-3pm-run
Author: (Claude Code)

## What changed
- `daily-sync` has a new schedule line, `5 20 * * *` (20:05 UTC = 3:05 PM US Eastern in winter, EST). That run always builds silver, like the 22:17 UTC run, so the day's data is built even if the hourly polls never fire. The hourly polls and the 22:17 UTC run are unchanged.
- Header comments say plainly that GitHub's scheduler is best-effort.

## Why
The owner asked for a run every day at 3 PM. It was also needed: on 2026-11-15 only 2 of about 10 hourly polls ran, and on 2026-11-16 none of the hourly polls (14:17 to 21:17 UTC) ran at all, nor had the 22:17 slot by 22:40 UTC, although the source had published (a read-only dry run showed 15 changed files waiting). The data stayed on Nov 14 until a manual run.

## How to verify
- The workflow file parses and lists the three schedules (hourly, 20:05, 22:17); the Decide step builds silver for the 20:05 schedule.
- The first real changed-data run happened by hand today (manual run 43973685841, force off, 2026-11-16 22:49 UTC): bronze loaded 15 changed files (`CHANGED: 15, UNCHANGED: 75`), the Decide step said to build, the Databricks job ended `TERMINATED SUCCESS`, and the redeploy step started `deploy-app` (run 43975803426). Silver, `game_slate` and `game_context` now reach 2026-11-15 (Nov 14: 5 of 5 games final; Nov 15: 9 of 9 final). `game_context`: 15,610 rows, 13,604 final.
- After merge, the first 3 PM run will show whether GitHub fires it. Nothing guarantees it will.

## Files added or changed
- `.github/workflows/daily-sync.yml`, `docs/releases/060-daily-3pm-run.md`.

## Risks and things I am unsure about
- GitHub can delay or drop this run too (the 22:17 run came 3.5 hours late on 2026-11-15 and had not run by 22:40 UTC on 2026-11-16). This is a backstop, not a guarantee. An outside scheduler would be more reliable but needs a GitHub token; the owner has not approved one.
- I took "3 PM" to mean US Eastern, the time zone the app uses. GitHub reads UTC only, so in summer time (EDT, from the second Sunday of March 2027) the run lands at 4:05 PM Eastern unless `20` is changed to `19`.
- Game 0022600231 (NOP vs DEN, Nov 14) is still held back: the source file still shows Denver at `168:00`. The warning is logged. It comes in by itself on the first build after the source is fixed.

## Review focus for Codex
Whether the exact string match on the cron expression in the Decide step can drift from the `on:` list.

## Open questions for the owner
- Is 3 PM Eastern the time you meant?
- Do you want an outside trigger (needs a GitHub token) as a more reliable backstop?

## Owner walkthrough
GitHub's built-in timer turned out to skip many of the hourly checks, so on the first real data day nothing ran until a manual start. This change adds one fixed daily run at 3:05 PM New York time, which always rebuilds the data and refreshes the app. The hourly checks stay, and so does the evening run. The timer can still skip a run, so this lowers the risk without removing it. Today's manual sync also worked end to end: it picked up 15 new files, rebuilt everything, and refreshed the app, and Today's games now has scores through Nov 15.
