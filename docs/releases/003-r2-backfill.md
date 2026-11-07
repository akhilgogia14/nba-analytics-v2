# Release 003: R2 backfill (tiers 1 and 2) and the sync script

Date: 2026-11-07 (UTC; the runs happened on the evening of 2026-11-06 local time)
Branch / PR: `feat/backfill-script` (pull request link is on the PR itself)
Author: (Claude Code)

## What changed
- Added `scripts/backfill.py`: a sync script that copies source files into R2 untouched. It is a dry run by default; `--execute` writes. It never deletes.
- Added `config/sources.json`: seasons 2022 to 2027 and two tiers of releases (tier 1 core, tier 2 context).
- Landed 90 raw files in R2 (164.3 MB): tier 1 (24 files, 7.5 MB: player box scores, team box scores, schedules, injury report) and tier 2 (66 files, 156.7 MB: play-by-play, shots, possessions, lineups, game lineups, player season stats, team season stats, game rosters, standings, rosters, officials).
- Built change detection into the script: each R2 file carries labels (SHA-256 checksum, source `updated_at`, source URL, fetch time). A re-run compares labels, downloads only files that look changed, and replaces a file only when its content changed (checksums old and new go in the manifest).
- Added 10 unit tests (`tests/test_backfill.py`) and a dev requirements file.
- `PLAN.md` updated: status, measured sizes, injury report is published, spike items marked done, R2 layout as built, change-handling rule, parked items (tier 3, ESPN duplicates, Airflow and dbt).

## Why
`PLAN.md` phase 2 and `CLAUDE.md` build order step 2: land the data untouched in R2 before anything touches Databricks. The owner chose overwrite-with-change-log over keeping old copies (2026-11-06), so the script is also the first half of the daily job.

## How to verify
Real output, trimmed. All commands run from the repo root with `.venv/bin/python`.

```
$ python -m pytest -q
..........                                                         [100%]
10 passed

$ python scripts/backfill.py --tier tier1 --execute
Files: 24 | NEW: 23, UNCHANGED: 1 | to upload: 7.5 MB
Manifest written: _manifest/2026-11-07T042327Z-tier1.json (complete)

$ python scripts/backfill.py --tier tier2 --execute
Files: 66 | NEW: 66 | to upload: 156.7 MB
Manifest written: _manifest/2026-11-07T042802Z-tier2.json (complete)
```

Independent check afterwards (a separate script listing the bucket):
```
objects: 93 | raw: 90 | manifests: 3 | raw total MB: 164.3
files per table: [6] across 15 tables
tier2 manifest: complete failure: None summary: {'NEW': 66} items: 66
label==manifest sha: True | size ok: True | nba_play_by_play_2026.parquet
label==manifest sha: True | size ok: True | nba_play_by_play_2025.parquet
```
Re-running the dry run for both tiers: `tier1: Files: 24 | UNCHANGED: 24 | to upload: 0.0 MB` and `tier2: Files: 66 | UNCHANGED: 66 | to upload: 0.0 MB`.

Mutation check of the tests: I broke three functions on purpose. Two were caught immediately. One survived (a truncated-file check ignoring the closing parquet marker), so I added a test for it and re-ran: the broken version now fails, the restored one passes.

## Files added or changed
- `scripts/backfill.py`: the sync script (plan, upload, verify, manifest).
- `config/sources.json`: which releases and seasons belong to which tier.
- `tests/test_backfill.py`: unit tests for the pure decision logic.
- `requirements-dev.txt`: pins `pytest` (kept apart so the daily job does not need it).
- `PLAN.md`: edits listed above.
- `docs/releases/003-r2-backfill.md`: this note.

## Risks and things I am unsure about
- The CHANGED path (replacing a file whose content changed) has been exercised only by unit tests of the decision logic, never against real changed data. The 2027 files change daily, so the first real change will be its first live test; watch that run.
- Overwriting deletes the old bytes. The manifest records old and new checksums, so a change is provable but not reversible. This was the owner's choice.
- I have not opened any of the 66 tier 2 files. They are verified as exactly what the source published (size, parquet markers, read-back checksum), not as correct or clean. Keys, nulls and quirks are unknown until silver.
- No lock against two runs at once. The existence check before writing a manifest is not atomic; fine for one runner, to revisit if the daily job and a manual run can overlap.
- Failure paths (no network, wrong keys, a release with the wrong number of files) are tested only by the "exactly one file per season" unit tests, not end to end.
- Each file is held in memory while it is processed; the largest is about 20 MB, so this is fine now.
- The GitHub API is called without a token (60 requests an hour for anonymous callers); a run uses one call per release, so about 15. The script uses `GITHUB_TOKEN` if set, and only sends it to the GitHub API.
- Dependence on one maintainer's server and one source (`PLAN.md` fallback item is still open).
- Python 3.9 (macOS system) is end-of-life for `boto3`; the daily job on GitHub will use its own Python.
- Whether Databricks Free Edition can read R2 is still untested (`PLAN.md` item 5). If it cannot, the data will have to reach Databricks another way.

## Review focus for Codex
Reviews are run by the owner when they choose. If one is requested, look hardest at: `classify` and `resolve` (could a changed file be mistaken for unchanged?), the overwrite path in `upload_and_verify`, what the manifest records when a run stops halfway, and whether `PLAN.md` now agrees with the code. Run it from a clean copy of the branch so `.env` is not in the folder.

## Open questions for the owner
1. Keep the two original test objects (`_manifest/2026-11-06-test.json`) in R2? The test data file is the same path as the real one and now has labels, so only the test manifest is separate.
2. Python 3.12 locally: install now or later (before the daily job)?
3. Next step: the daily GitHub Actions job (needs you to add the R2 keys as repository secrets), or inspect the tier 2 tables and start the Databricks bronze load first?

## Owner walkthrough
- **What this does:** it fills your Cloudflare storage bucket with an exact copy of 90 data files from the public source, covering the 2021-22 season through today. The copies are byte-for-byte what the source published, and nothing was cleaned or changed.
- **What you would see:** open the bucket in Cloudflare and look in the `raw` folder. There are 15 folders (one per kind of data, such as `nba_stats_player_boxscores` or `nba_stats_pbp`), and each holds a folder per season with one file. The `_manifest` folder holds a "receipt" for each run listing every file, its size and its fingerprint (a checksum, which changes if even one byte changes).
- **Why re-running is safe:** the script first compares labels stored on each file with what the source says now. If nothing changed it does nothing, which I proved by running it again and getting "UNCHANGED" for all 90 files. If the source file changed, it replaces the one file and writes down the old and new fingerprints.
- **What each new file means:** `scripts/backfill.py` is the program that does the copying; `config/sources.json` is the shopping list (which datasets and seasons); `tests/test_backfill.py` checks that the decision rules work and I even broke them on purpose to confirm the checks notice; `requirements-dev.txt` names the testing tool.
- **What to check yourself:** open Cloudflare, go to R2, then `nba-bucket`, and confirm you see 15 folders under `raw` and three receipts under `_manifest`. Then answer the three questions above.
