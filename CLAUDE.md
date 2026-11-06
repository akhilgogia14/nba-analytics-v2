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

## Git
- Work on a branch. Open a pull request. The owner merges. Never push directly to `main` (the first bootstrap commit is already done).
- Run `git fetch` before saying anything about branch or PR state.
- Verify before claiming done: run the tests or checks and quote the real output.

## Release notes and review (for Codex)
- At each major step, write `docs/releases/NNN-short-title.md` from `docs/releases/TEMPLATE.md` and commit it in the same pull request.
- Major steps include: the source spike, data landed in R2, bronze loaded, silver done, each batch of gold tables, each front-end push, Databricks cleanup.
- Codex reviews the release note plus the diff and writes `docs/reviews/NNN-codex.md` from `docs/reviews/TEMPLATE.md` (or leaves pull request comments).
- Read the review before starting the next step. Reply to each finding: fixed, disagree (with a reason), or deferred.
- Every release note ends with an "Owner walkthrough" in plain language: what changed, what it looks like, what each new file does, no jargon.

## Safety
- No secrets in chat, commits, logs or screenshots. Use environment variables, a gitignored `.env`, Databricks secrets, or GitHub Actions secrets.
- Ask before anything destructive: deleting, dropping, overwriting, force-pushing, or removing anything in Databricks, R2 or GitHub. Show the exact list first and wait for a yes on each item. Read-only inventory does not need asking.
- Do not commit data files. Raw data lives in R2.

## Tools (check before assuming; report what is missing)
- `gh` is installed and logged in.
- Databricks CLI: install and login pending. The owner runs the login.
- R2: use the S3-compatible API or wrangler with a token scoped to `nba-bucket`. The owner creates the token.
- Codex: the desktop app exists; the CLI is not installed yet. When it is, check `codex --help` for a non-interactive mode and ask the owner before running a review.

## Positioning and wording
- This is a data product plus an NBA research study. The design target is player performance forecasts for points, rebounds, assists, 3-pointers, blocks and steals (the stat lines prop markets are built on). It is fine to say so in internal docs.
- Public-facing copy (UI, README, portfolio write-ups) stays professional: "player performance forecasts", "distributions", "calibration", "track record". No tout language ("lock", "can't miss", "free pick") and no promises of profit. Show uncertainty and the real track record honestly.
- Line and odds data stays parked as an optional later source.
