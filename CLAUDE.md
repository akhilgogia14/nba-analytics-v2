# CLAUDE.md: how to work in this repo

Read `PLAN.md` first (goals, decisions, lessons from v1), then `docs/NEXT.md` (the current task).
This file is loaded automatically each session. Keep it short and current.

## Teaching mode (the owner is learning as we go)
- Before every step, show 1-4 **bold bullets** saying what will happen and why.
- If a step needs more than four bullets, split it into smaller steps.
- After each step, give one line on what it showed.
- Define any new term in plain words the first time you use it.
- The owner is strong on data and not a web developer. For front-end work, build it and explain it afterward in a plain-language walkthrough (see Release notes). Do not expect the owner to read JavaScript or TypeScript.

## Pace
- One step at a time. Stop and wait for the owner after each step. Never chain several steps.
- Build order, no skipping ahead:
  1. pull the data
  2. land it untouched in R2
  3. load it into Databricks (bronze)
  4. clean it into silver
  5. make simple gold tables
  6. simple visuals from gold
  7. only then more complex tables, visuals, and ML
- Keep the repo small. Add a table or page only when a screen needs it.
- Modeling work follows `docs/MODELING.md`.

## Build conventions (decided by the owner, 2026-11-12)
- Bronze and silver stay in SQL files (`sql/silver/`), run by `scripts/silver_build.py`.
- New gold tables are written in PySpark as "Python tables" (`scripts/gold_<name>.py` with `build(spark)`, an entry with `"python"` in `TABLES`). Their gates and warnings stay SQL and recompute the answer independently of the PySpark code. Existing SQL tables are not converted.
- Every table, SQL or PySpark, ships with gates, warnings, tests, and corrupted-copy checks that prove the gates fire.

## Git
- Work on a branch. Open a pull request. The owner merges. Never push directly to `main` (the first bootstrap commit is already done).
- Run `git fetch` before saying anything about branch or PR state.
- Verify before claiming done: run the tests or checks and quote the real output.

## Release notes and review (Codex on demand)
- At each major step, write `docs/releases/NNN-short-title.md` from `docs/releases/TEMPLATE.md` and commit it in the same pull request. Numbers go in order (001, 002, ...), not tied to PR numbers.
- Major steps include: the source spike, data landed in R2, bronze loaded, silver done, each batch of gold tables, each front-end push, Databricks cleanup.
- Codex reviews are run by the owner, when the owner decides. Do not run `codex review` or `codex exec`, and do not propose a review at each step.
- If the owner brings a review back (`docs/reviews/NNN-codex.md` from `docs/reviews/TEMPLATE.md`, or pull request comments), read it and reply to each finding: fixed, disagree (with a reason), or deferred.
- If the owner asks you to run a review, do it from a clean copy of the branch (for example a git worktree outside the repo folder) so `.env` is not in the folder Codex reads, and say that `codex review` has no setting that restricts what it can read.
- Every release note ends with an "Owner walkthrough" in plain language: what changed, what it looks like, what each new file does, no jargon.

## Safety
- No secrets in chat, commits, logs or screenshots. Use environment variables, a gitignored `.env`, Databricks secrets, or GitHub Actions secrets.
- Ask before anything destructive: deleting, dropping, overwriting, force-pushing, or removing anything in Databricks, R2 or GitHub. Show the exact list first and wait for a yes on each item. Read-only inventory does not need asking.
- Do not commit data files. Raw data lives in R2.

## Tools (check before assuming; report what is missing)
- `gh` is installed and logged in.
- Databricks CLI: installed (v1.24.0, from the `databricks/tap` Homebrew tap). Logged in as profile `DEFAULT` on the owner's workspace; the owner runs any login.
- R2: S3-compatible API through `boto3` (pinned in `requirements.txt`, installed in a gitignored `.venv`). Credentials are in the gitignored `.env` (names in `.env.example`); the token is scoped to `nba-bucket`. Run scripts as `.venv/bin/python scripts/<name>.py` from the repo root. Never print `.env` values.
- Codex: CLI installed (0.167.0) and logged in, but used only when the owner asks (see "Release notes and review").
- Python: `.venv` is Python 3.12 (made with `uv venv --python 3.12 .venv`, then `uv pip install -r requirements.txt -r requirements-dev.txt`). `pyspark` is installed for local tests only; local Spark tests need Java 21 and `PYSPARK_PYTHON` set (the test fixture does it). The Databricks side runs a newer Spark (4.x, ANSI mode on), so the job run is the final check. A PySpark table can only be dry-run on real data with Databricks Connect (a separate environment, not in the repo).

## Positioning and wording
- This is a data product plus an NBA research study. The design target is player performance forecasts for points, rebounds, assists, 3-pointers, blocks and steals (the stat lines prop markets are built on). It is fine to say so in internal docs.
- Public-facing copy (UI, README, portfolio write-ups) stays professional: "player performance forecasts", "distributions", "calibration", "track record". No tout language ("lock", "can't miss", "free pick") and no promises of profit. Show uncertainty and the real track record honestly.
- Line and odds data stays parked as an optional later source.
