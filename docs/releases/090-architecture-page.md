# Release 090: Architecture page

Date: 2026-11-21
Branch / PR: feat/docs-architecture
Author: (Claude Code)

## What changed
- **A fifth Documentation section, Architecture** (`#/docs/architecture`), next to Start here, Data model, Data dictionary and Data workflow. It has:
  - **The big picture:** three diagrams in boxes and arrows (left to right on a computer, top to bottom on a phone): the data path (source, GitHub Actions sync, R2, Databricks), the request path (browser, app server on Databricks Apps, SQL warehouse, gold tables) and the release path (pull request, deploy workflow, Databricks Apps).
  - **The pieces and why each one is here:** 9 pieces (GitHub, GitHub Actions, R2, Databricks tables, the Databricks job, the SQL warehouse, Databricks Apps, the React app, Slack), what each does and why it was chosen.
  - **What happens when you click:** five steps, including the 5-minute memory, fixed queries with named values, and the app logging in as itself.
  - **Design decisions and trade-offs:** 8 (daily batches, raw files untouched, checks between layers, read-only gold, compute where the data is, one reader today and a serving store later, built for a free tier, picks in the browser).
  - **Access and secrets:** 4 plain statements, with no secret values anywhere.
- The Data workflow page now says the app is redeployed when a sync changed something (it said "after a build").
- Files: `app/src/components/docs/DocsArchitecture.tsx` (new), `app/src/lib/docs.ts` (the words), `app/src/DocsPage.tsx`, `app/tests/docs.test.mjs`. No server, data or pipeline change.

## How to retract
One self-contained PR: click **Revert**. The tab goes away; the other Documentation pages stay.

## How to verify
- tsc, oxlint, build clean; 281 tests pass (1 new: three paths, every piece described, five request steps, address opens the tab).
- Facts were read from `app/server/databricks.mjs` (own identity and token), `app/server/index.mjs` (5-minute cache), `.github/workflows/daily-sync.yml` and `deploy-app.yml` (schedules, Slack, redeploy), `databricks.yml` (the job) and `app/app.yaml` (the SQL warehouse resource).
- Looked at in headless Chrome at desktop width and 390: no sideways page scroll.

## Risks
- "Why this one" lines for GitHub Actions, R2 and Slack are the recorded reasons plus my plain-language reading; edit them if your reasons differ.
- The serving-store line describes an option, not a plan. The PLAN lists serving and hosting as open.
- The diagrams are text boxes, not drawn lines, so a change to the system needs a change in `docs.ts`.

## Owner walkthrough
Click **Documentation**, then **Architecture**. At the top are three rows of boxes: the first is how data gets in (from the public source to the Databricks tables, on a schedule), the second is what happens when you open or click a page (your browser, the app server, the database), and the third is how a code change reaches the live app. Below is a table of every piece with what it does and why it was chosen, five steps describing a single click, eight design choices with their trade-offs, and a short list of how secrets and access are handled. Nothing else in the app changed.
