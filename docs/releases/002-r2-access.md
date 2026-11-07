# Release 002: R2 access and test upload

Date: 2026-11-06
Branch / PR: `chore/r2-setup` (pull request link is on the PR itself)
Author: (Claude Code)

## What changed
- Added `.gitignore` (blocks `.env` files, keys, data files, `.venv`) and `.env.example` (variable names only).
- The owner created a Cloudflare R2 token scoped to `nba-bucket` (Object Read & Write) and saved it in a local, gitignored `.env`.
- Added `requirements.txt` (`boto3==1.42.97`) and two small scripts: `scripts/r2_list.py` (read-only bucket listing) and `scripts/r2_test_upload.py` (one test upload plus a manifest, then a checksum check).
- Landed one test file in R2: the 2025 schedule, untouched, plus a manifest entry. No other data, no full backfill yet.
- Also this session (no repo files): installed Codex CLI 0.167.0 and Databricks CLI 1.24.0; the owner logged in to both; Command Line Tools updated to 27.2; two stopped v1 Databricks apps deleted with the owner's approval (see `docs/v1-inventory.md`, PR #3).

## Why
`NEXT.md` step 6: prove R2 access with a harmless read, then one small write plus a manifest, and get a review before the full 2022+ backfill (`PLAN.md` phase 2).

## How to verify
Real output (run from the repo root):

```
$ .venv/bin/python scripts/r2_list.py
Connected to bucket 'nba-bucket'. Objects shown (max 20): 0

$ .venv/bin/python -W ignore scripts/r2_test_upload.py
Downloaded 23421 bytes, sha256 959fdff85cf5892f...
Uploaded 2 objects.
  _manifest/2026-11-06-test.json  (490 bytes)
  raw/hoopr_stats/nba_stats_schedules/2025/nba_schedule_2025.parquet  (23421 bytes)
Stored file matches original: True
Manifest sha256 matches stored file: True
```

- The 23,421 bytes equal the size GitHub lists for that release asset, and the checksum prefix equals the copy downloaded during the spike.
- `.env` check: `git check-ignore -v .env` reports `.gitignore:2:.env`; `git status` never lists it.
- `.env` field check (values not printed): all four variables set; key lengths 32 and 64; endpoint is `https://` and ends in `.r2.cloudflarestorage.com`.

## Files added or changed
- `.gitignore`: stops secrets, data files and `.venv` from being committed.
- `.env.example`: template listing the four R2 setting names with no values.
- `requirements.txt`: pins `boto3`.
- `scripts/r2_list.py`: read-only listing of the bucket.
- `scripts/r2_test_upload.py`: one-time test upload and verification; refuses to overwrite existing objects.
- `docs/releases/002-r2-access.md`: this note.

## Risks and things I am unsure about
- Two test objects are now in R2 (`raw/hoopr_stats/nba_stats_schedules/2025/...` and `_manifest/2026-11-06-test.json`). The data file is a real raw file and is the same path a backfill would use; the manifest is marked `"kind": "test"`. Deleting either needs the owner's yes.
- The upload script has a hard-coded file and manifest name, so it is a one-off, not the backfill tool. The backfill script is not written.
- The manifest format is a first draft (source URL, tag, key, size, sha256, fetch time). It has no per-run grouping and no release `updated_at` yet; both are probably needed for the daily job.
- R2 folder layout differs slightly from `PLAN.md` wording: the dataset folder is the release tag (`nba_stats_schedules`), so layout always matches the source.
- Python is 3.9.6 (macOS system Python). `boto3` warns that it will stop supporting 3.9; it works today. Plan: move to Python 3.12 before the daily job.
- The token is scoped to one bucket, but the secret sits in a plain-text local `.env`. GitHub Actions secrets will be needed for the daily job.
- `scripts/r2_test_upload.py` reads the file into memory. Fine for 23 KB; it must not be reused as-is for the large files.
- Nothing was tested on a failure path (wrong keys, no network, bucket missing).

## Review focus for Codex
- Secrets: anything that could print, log or commit credentials. Check `.gitignore` coverage.
- Overwrite and delete safety in `r2_test_upload.py` (existence check is a separate call from the write, so not atomic).
- Manifest design: is the content enough for a daily job and for reproducing a run?
- Path layout under `raw/hoopr_stats/`.
- Docs agree with code (variable names in `.env.example` vs the scripts).

## Open questions for the owner
1. Keep the two test objects in R2 (the schedule file is real raw data and can be reused), or delete them before the backfill?
2. Install Python 3.12 now or later (before the daily job)?
3. Core tables first for the backfill, as planned: player boxscores, team boxscores, schedules, injury report?

## Owner walkthrough
- **What this does:** it connects your computer to Cloudflare R2, the online storage bucket where raw data will sit untouched. I made a key that only works on that one bucket, and you saved it in a private file on your machine that git is told never to upload.
- **What you would see:** the bucket now holds two small things: a copy of the 2025 NBA schedule file, and a short "receipt" (the manifest) saying where it came from, how big it is and its fingerprint (a checksum, which changes if even one byte changes). I downloaded the file back and the fingerprints matched, so nothing was damaged on the way.
- **What each new file means:** `.gitignore` is a do-not-upload list that protects your key; `.env.example` shows which settings exist without any real values; `requirements.txt` names the one add-on library the scripts need; the two scripts in `scripts/` are one that only looks at the bucket and one that did the single test upload.
- **What to check yourself:** open your Cloudflare dashboard, go to R2 → `nba-bucket`, and confirm you see the `raw` and `_manifest` folders. Then answer the three questions above.
