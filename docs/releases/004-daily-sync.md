# Release 004: daily sync to R2 (GitHub Actions)

Date: 2026-11-09
Branch / PR: PR #8 (workflow), this PR (tweaks and note)
Author: (Claude Code)

## What changed
- `.github/workflows/daily-sync.yml` runs `scripts/backfill.py` for tiers 1 and 2 every day, on Python 3.12, and can also be started by hand.
- It reads four R2 values from encrypted repository secrets and posts nothing anywhere yet (Slack is skipped until a webhook secret exists).
- This PR moves the schedule to 16:17 UTC and makes the Slack step unable to fail a run.
- The first real "changed file" overwrites happened in this job and worked.

## Why
PLAN.md Phase 2: a daily job that copies new or changed source files into R2, writes a manifest and alerts on failure. Bronze will be triggered by this job finishing.

## How to verify
- Manual run 2026-11-07 14:37 UTC: tier 1 `CHANGED 3, UNCHANGED 21`; tier 2 `CHANGED 8, UNCHANGED 58`; both manifests `complete`; box scores went from 123 to 132 games (the 9 games of 2026-11-06).
- Scheduled runs on 11-07 and 11-08 also synced correctly (their red status came only from the Slack step, which had a bad secret; the secret is now deleted).
- `gh run list --workflow=daily-sync.yml`

## Measurements
- Source finishes group A (box scores, rosters, season stats and others) between 13:47 and 14:52 UTC; group B (schedule, play-by-play, possessions, lineups) at 15:15-15:16 UTC. Three days observed, so treat as a first estimate.
- GitHub started the scheduled runs at 20:26 and 20:42 UTC for a 16:30 cron, up to about 4 hours late. Scheduled runs are best effort. Anything that must follow the sync must wait for it to finish, not for a clock time.

## Files added or changed
- `.github/workflows/daily-sync.yml`: the daily job.
- `docs/releases/004-daily-sync.md`: this note.

## Risks and things I am unsure about
- Scheduled workflows are switched off after 60 days without repository activity; the daily job does not count as activity.
- A late GitHub start can slip past a source refresh by a day; the next run catches up because the script compares file labels.
- A source refresh during a run could leave a mix of old and new files for a day. Each file is verified on its own.
- Failure alert is GitHub's email only. Slack is untested; the webhook secret was removed after a bad paste.
- The single R2 read-write token is shared by the laptop and GitHub.

## Review focus for Codex
Secrets handling in the workflow, the `!cancelled()` conditions, and whether a failed tier 1 still lets tier 2 run and still fails the job.

## Open questions for the owner
1. Add Slack later (create the webhook, store `SLACK_WEBHOOK_URL`)?

## Owner walkthrough
- **What this does:** every day GitHub starts a small computer, runs the same copy program as before, and leaves a receipt in R2. You do nothing.
- **What you would see:** the Actions tab on GitHub lists each run, green when it worked, with a short summary of files checked and changed. A failure sends you an email.
- **Why it can run late:** GitHub schedules are best effort, so a run may start hours after its time. That is fine because the copy is safe to repeat.
- **What to check yourself:** open the latest run in the Actions tab and look for the "Daily sync" summary with two lines (tier 1 and tier 2).
