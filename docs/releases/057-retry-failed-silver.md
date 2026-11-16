# Release 057: hourly polls retry a failed silver build

Date: 2026-11-16
Branch / PR: fix/retry-failed-silver
Author: (Claude Code)

## What changed
- In `daily-sync`, the "Decide whether to build silver" step now also builds silver when the most recent finished `daily-sync` run failed.
- A retry that succeeds also redeploys the app (its gold tables are new), even though bronze loaded nothing new in that run.
- Header comments in the workflow describe the new rule.

## Why
Seen on 2026-11-15/16: a silver build failed after bronze had already loaded the new files. The next hourly poll (run 43777681631) found bronze "unchanged" and skipped the build, so the failure would have waited for the 22:17 UTC run or a manual run.

## How to verify
- The decision step's real shell block, run locally with a stand-in `gh`, in 7 cases: last run failed (poll, nothing new) -> build, retry; last run succeeded -> skip; lookup error -> skip; bronze changed -> build, no retry; 22:17 slot -> build; manual force off -> skip; manual force on -> build. All as expected.
- The real lookup command returns the last finished run's result (`success` at the time of writing).
- After merge: a manual run with force_silver off should say "bronze loaded nothing new" and skip (last run is a success). The retry path itself can only be seen the next time a run fails; it has not been exercised on a real failure.

## Files added or changed
- `.github/workflows/daily-sync.yml`, `docs/releases/057-retry-failed-silver.md`.

## Risks and things I am unsure about
- If a failure keeps happening (for example a bad source file), every hourly poll retries: up to about 10 job runs a day (each 8 to 10 minutes of serverless compute) until the cause is fixed. The gates stop each one before anything is written. I judged that acceptable; a cap on retries is possible.
- Any failed run triggers the retry, including a failed file sync, not only a failed silver build. A build with nothing new is harmless.
- If GitHub cannot be asked for the last run, no retry happens and the 22:17 UTC run remains the backstop.

## Review focus for Codex
Whether the "last finished run" lookup can pick up the wrong run under the concurrency rule.

## Open questions for the owner
- Cap retries (for example only once per failed run), or leave it as is?

## Owner walkthrough
Before, if the data landed fine but the step after it failed, the next hourly check saw "no new files" and did nothing, so the problem sat until the evening run. Now each hourly check first asks GitHub whether the last run failed. If it did, it tries the build again, and if that works it refreshes the app. One workflow file changed; nothing in the data or the app changed.
