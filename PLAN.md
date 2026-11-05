# NBA Analytics v2: Plan and Handoff

Status: planning complete, no code yet. Written 2026-11-05. This is the first document in the repo. Read it fully before doing anything.

## 1. What this is

An advanced analytics and ML tool for researching and predicting NBA player performance. Two phases:

1. **Research app (first).** A beautiful, detailed data-discovery and research experience, mainly for the owner.
2. **ML and AI layer (later).** Predictions and a natural-language question layer, built only after a back-test harness exists.

It is also a portfolio piece for hiring managers (the owner's passion should show), and a playground for learning. Quality and polish matter more than speed. It does not need to answer in 30 seconds or be explainable in 5 minutes.

Wording: this is a research and prediction tool. Do not use betting framing in the product, the docs or the UI. Line and odds data is parked (see section 9).

## 2. Lessons from v1 (repo: akhilgogia14/nba-analytics-databricks, archived)

What worked, so keep it:
- Heavy transforms on Databricks, output pushed to a small serving store; the app never queries Databricks directly.
- Written memory (AGENTS.md, handoff, log, decision log, backlog) so new sessions pick up cold.
- Branch, pull request, owner-merges flow.
- Tests that fail when docs disagree with code (drift tests); mutation-checking new tests.
- An outside reviewer (Codex) found real bugs. Review earlier and more often.
- The back-test was the most valuable late addition.

What failed, so avoid it:
- Breadth before a core question. Over a dozen pages organized by table, not by user question.
- Too many metrics that fed no decision.
- Heavy process for a solo project (seven workflows, milestone logs).
- Thin data (about 1.5 seasons, sparse play-by-play).
- Silent data-quality traps: NULL keys corrupting merges, a job running an old notebook copy, partial coverage producing misleading headlines, "did not play" inferred from missing rows.
- Claiming repo state from a stale origin/main. Always `git fetch` before saying whether something is merged.
- Free-tier friction (one tiny warehouse, restricted network, no external storage, app stopping after 24h).

Key v1 finding: in a back-test of about 2,500 games, a plain blend of last-10-game and season averages beat every fancier adjustment. Opponent history, comparable-player history, home/away and rest added almost nothing. Most "he always plays worse against them" is noise at small samples. Rule: any adjustment must beat the plain baseline out of sample, otherwise it is context, not a number that changes the answer.

## 3. Decisions made

| Area | Decision |
|---|---|
| v1 | Archived. Tag the final state, archive the GitHub repo read-only, stop its schedules, delete the deployed Databricks App. Leave v1 Databricks tables in place until v2 works (owner to confirm). |
| v2 repo | https://github.com/akhilgogia14/nba-analytics-v2 |
| Primary data source | sportsdataverse/hoopR-nba-stats-data (NBA Stats data, published as GitHub Release assets). Not yet verified for freshness (see section 5). |
| Seasons | 2021-22 onward. The repo labels seasons by END year, so minimum season = 2022. Verify against real files. |
| Landing zone | Cloudflare R2 bucket `nba-bucket` (free tier). Raw files stored untouched, with a manifest per run. |
| Compute and ML | Databricks first (the owner knows it and it is free; it is the portfolio centerpiece for ML and MLflow). |
| Serving and hosting | Open. Start with a small serving store; port off Databricks Apps once the product is good. |
| Budget | Up to $15 a month total. |
| Fallback scraper | Vendor his `python/nba_data_build` code (pinned commit, license and attribution kept) under `vendor/`. NBA Stats blocks most cloud IPs, so it would need a small VPS or home machine. Plan only, do not build unless he stops updating. |
| Shot maps, play-by-play | Later phase. Hidden for now. |
| Line and odds data | Parked. Polling job appending to a table when the time comes. Kafka is overkill for this. |
| Process | Branch and PR, owner merges. Codex reviews plans and PRs. One daily job, one health check. |

## 4. Product direction

**Core screen:** Today's games, pick a player, see the typical range for PTS, REB, AST, 3PM, BLK, STL and combinations, with the reasoning available on click (not forced into view).

**Uncertainty display:**
- Points, rebounds, assists and combos: dot strip of recent games with a median line and a shaded central 80% band; click for the full histogram.
- 3PM, blocks, steals are small counts: show bars for 0, 1, 2, 3+ with percentages. A numeric band is meaningless for these.
- Minutes always visible; it drives everything else.
- Do not headline "went over X in N of last M" style hit rates.

**Peer cohorts:** compare a player to similar roles, not position labels. Example: Tyrese Maxey should be compared to other starting guards of an all-star, franchise-player profile (like Brunson), not a bench guard or a center. Define by minutes, usage, starter share and assist rate. Show the cohort openly with a swap control. Peer and vs-opponent views always show sample size and a noise signal, and they are context until the back-test says otherwise.

**Vs-opponent history:** several seasons, shown with sample sizes.

**Design direction:** FiveThirtyEight (editorial, annotated charts, direct labels), the Oura app (calm, one clear headline number per card, soft layered cards), The Pudding (narrative, scroll-driven moments). It must look beautiful and detailed and must not look like generic AI output. Mock the one screen and review it before building.

## 5. Data source facts and open verification

Known from reading the repo page:
- Datasets include player_boxscores (about 188 MB total), player_game_logs (about 16 MB), team_boxscores, game_rosters, officials, schedules, rosters, standings, lineups, possessions, shots (about 1 GB), pbp (about 4.8 GB), plus derived models (RAPM, BPM, WAR, DARKO, impact). An injury_report dataset exists in the code but is not published yet.
- Total of all releases is about 7.4 GB. With 2022+ only, estimated about 2 to 2.5 GB (a guess, verify).
- The latest commit is a 2026-27 season update. The README table shows box scores last published 2026-10-01 and the daily workflow last run 2026-07-12, so freshness is unconfirmed.
- His raw scraping runs from a cron job on his own server. Three contributors. Small bus factor.
- LICENSE is the short R-package stub (year and copyright holder). Read LICENSE.md for the full text before copying code.

Must verify in the first spike:
1. Real per-season file list and the latest game date in the box score release.
2. Season label convention (end-year) against actual files.
3. Column schemas and key behavior (NULL-safe composite keys).
4. License text.
5. Whether Databricks Free Edition can read from R2 over its S3-compatible endpoint. If not, route data into Databricks another way.
6. Fallback source choice if the repo is stale.

## 6. Task list

**Phase 0: Access and setup**
- Clone this repo locally; work in Claude Code from the repo folder.
- Confirm gh, Databricks CLI and Codex CLI are authenticated. Never paste secrets in chat; use GitHub Actions secrets and Databricks secrets.

**Phase 1: Archive v1 (destructive; confirm each step with the owner)**
- Inventory v1 workflows, schedules, the Databricks job and App, MotherDuck, Slack alerts.
- Stop schedules first. Tag final state. Archive the repo. Delete the deployed Databricks App. Decide about v1 tables (default: leave).

**Phase 2: Data source spike (no app code)**
- List per-season files, create the R2 layout, write the manifest format.
- Backfill 2022+ into R2 (untouched bytes, source URL, size, checksum, fetch time in the manifest).
- Daily GitHub Actions job: check releases, copy new or changed files to R2, write the manifest, alert on failure.
- Test Databricks reading R2; pick the route if blocked.
- Vendor his Python folder (pinned commit, license kept).
- Go or no-go on the source; choose a fallback.

R2 layout: `raw/hoopr_stats/<dataset>/<season>/<file>` plus `_manifest/<date>.json`. Raw means untouched; no transforms in the landing zone. Free tier is 10 GB; keep one current copy of each big asset and dated snapshots only for small core tables.

**Phase 3: Repo foundation**
- Short AGENTS.md, decision log, scope doc, REVIEW.md checklist for Codex, CI (tests and lint), PR template.
- Run the first Codex review on this plan.

**Phase 4: Data foundation (minimal model)**
- Bronze (raw snapshots), silver and gold: game logs, schedule, player dimension (position group, minutes, starter share), coverage metadata.
- Quality gates: row-count reconciliation, NULL-safe composite keys, coverage fields on every dataset, "did not play" rules.
- One daily job with a health check and failure alert.

**Phase 5: Design**
- Design direction doc from the references; mock the one screen; owner reviews before any app code.

**Phase 6: Research app MVP**
- Today's games and player search; player page with the stat distributions; peer cohort builder; vs-opponent history with sample sizes.

**Phase 7: Back-test harness (before any ML)**
- Out-of-sample scoring on error and calibration; a baseline (blend of last-10 and season averages) that every model must beat.

**Phase 8: ML and AI**
- Feature tables and MLflow tracking; first model checked against the baseline; natural-language question layer; a pick log so predictions are scored against outcomes.

**Later:** shot maps, play-by-play features, injury-report features, line data, move hosting if uptime matters.

## 7. Working agreements

- Plan before build. One small step at a time; show the result.
- Branch, then pull request, then owner merges. No direct pushes to main after the initial bootstrap commit.
- `git fetch` before claiming anything about branch or PR state.
- Verify before claiming done: run the tests and read the output.
- Back-test before building any adjustment. Context is not a prediction.
- Keep the repo small: add a table or page only when a screen needs it.
- Written memory: AGENTS.md (how to work here), a short handoff, a decision log. Keep them short and current.
- Ask before any destructive action (deleting files, apps, tables, or data).
- Secrets never go in chat, commits or logs.

## 8. Open questions for the owner

1. Delete the v1 Databricks tables and job, or leave until v2 works? (Default: leave.)
2. Time budget (hours a week) and any target date.
3. Is a roughly $5 a month VPS acceptable as the fallback scraper, or only if the maintainer stops updating?
4. Land all 2022+ datasets at once, or core tables first? (Default: core first, then the heavy files.)

## 9. Parked

Shot maps and play-by-play features, an NFL or fantasy version, line and odds data, home/away shot splits, the maintainer-independent scraper, moving hosting off Databricks Free.
