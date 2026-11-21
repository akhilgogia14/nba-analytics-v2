# Release 089: Documentation pages

Date: 2026-11-21
Branch / PR: feat/docs-pages
Author: (Claude Code)

## What changed
- **A new Documentation page** (`#/docs`) with a "Documentation" link in the page switcher, and four sections under it:
  - **Start here** (`#/docs`): the short version, links to the three sub-pages, and 9 common questions (where the data comes from, how fresh it is, what season 2027 means, why a season shows 80 games, what counts as "played", and more).
  - **Data model** (`#/docs/model`): the three layers (bronze, silver, gold) with every table as a link, the three things everything is about (player, team, game and their ids), and a table of the gold tables: one row is, unique key, built from, read by.
  - **Data dictionary** (`#/docs/dictionary`): a searchable list. Every gold table lists all its columns with a type and a plain meaning (9 tables, 258 columns); silver and bronze list each table, what one row is and the rules applied. `#/docs/dictionary?q=days_rest` opens it already filtered.
  - **Data workflow** (`#/docs/workflow`): seven steps from the source to the page (each with where it runs and the check it does), when it runs, and what a gate, a warning and the build log are.
- The words live in one file, `app/src/lib/docs.ts`, written from the repo's scripts and SQL. The page reads nothing from the database.
- Files: `app/src/DocsPage.tsx`, `app/src/components/docs/` (`DocsHome`, `DocsModel`, `DocsDictionary`, `DocsWorkflow`, `Section`, `shared`), `app/src/lib/docs.ts`, `lib/pages.ts` (docs address), `Root.tsx`, `PageSwitch.tsx`; `app/tests/docs.test.mjs`. No server, data or pipeline change.

## How to retract
One self-contained PR: click **Revert**. The page and its link go away; nothing else depends on them.

## How to verify
- tsc, oxlint, build clean; 280 tests pass (7 new: the addresses, every table documented once with its key columns present, search, and two drift tests: the silver and gold tables in `scripts/silver_build.py` and the bronze tables in `config/sources.json` must match what is documented, so adding a table without documenting it fails the tests).
- Checked against Databricks (read-only, 2026-11-21): all 9 gold tables' documented columns match the real columns exactly (none missing, none extra); all silver and bronze tables exist.
- Looked at in headless Chrome at desktop width and at a phone width (390): no sideways page scroll.

## Risks
- Column meanings are my plain-language reading of the code. Two to check by eye: `player_season_games.game_number` and `team_games` ("place among the team's games of that type"), and the prior_* columns of `player_game_log`.
- A new column is not caught by the tests (they cannot see Databricks); it needs a line in `docs.ts`.
- Pipeline timings (hourly polls, 3:05 PM Eastern) are copied from the workflow file and will go stale if it changes.

## Owner walkthrough
Click **Documentation** in the top row of buttons on any page. "Start here" explains what the app is built on and answers common questions; click a question to open the answer. "Data model" shows the three layers as three boxes, with every table as a small button: click one to jump to its columns. "Data dictionary" lists every table with what one row is and each column in plain words; type a word like "rest" or "minutes" in the search box to find it. "Data workflow" walks the seven steps a game goes through, from the public source to a number on a page, and what protects it on the way. Nothing else in the app changed.
