# Release 091: Architecture page redesign

Date: 2026-11-21
Branch / PR: feat/architecture-redesign
Author: (Claude Code)

## What changed
- **The Architecture page is laid out like a consulting deck.** One headline sentence states the takeaway, a strip of five key numbers follows (Daily refresh, 3 data layers, 5-minute memory, 6-hour restarts, read-only), then the evidence, each section titled by its claim:
  - "Data flows through five stages, with four safeguards underneath": a chevron diagram (Source, Ingest, Process, Serve, Experience) with a logo on each tool, plus a row for what runs underneath all five (Delivery, Quality, Alerts, Access).
  - "Nine pieces, each chosen for a reason": cards with a logo, what it does and why.
  - "Most clicks never reach the database": the five click steps as a row of numbered columns.
  - "Eight design decisions, and what each one costs": each decision with what we chose and its cost side by side.
  - "The app can read, and nothing more": four access statements.
- **Logos** for GitHub, GitHub Actions, Cloudflare, Databricks, Node.js, Apache Spark and React, from the Simple Icons set (CC0), drawn in one colour as small inline SVGs (`app/src/lib/logos.ts`). No outside request is made. Slack, Quality and Access use plain icons drawn here instead (Slack's mark is not in the set; a check mark and padlock are not brands). A line at the foot says the marks belong to their owners.
- The old three row diagram and the pieces table are replaced; the facts are the same ones checked in release 090. New: each decision's "cost" line (my plain reading of each trade-off).
- Files: `app/src/components/docs/DocsArchitecture.tsx`, `Logo.tsx` (new), `app/src/lib/logos.ts` (new), `app/src/lib/docs.ts`, `app/tests/docs.test.mjs`. No server, data or pipeline change.

## How to retract
One self-contained PR: click **Revert**. The previous Architecture page returns.

## How to verify
- tsc, oxlint, build clean; 281 tests pass (the architecture test now also checks that every logo used exists).
- Looked at in headless Chrome at 1200 and 390 wide: no sideways page scroll; the chevrons, logos and tables read cleanly at both.

## Risks
- Third-party logos on a public page: used only to identify tools, in one colour, with a credit line. If you would rather not show brand marks, they can be swapped for plain icons in `logos.ts`.
- The "cost" lines are my reading of each trade-off; edit them if you see a different cost.
- Logos are drawn in the page's text colour, so a brand's own colours are not shown.

## Owner walkthrough
Open Documentation, then Architecture. The top of the page now has one sentence saying what the system does and five big numbers. Below is a left-to-right diagram: Source, Ingest, Process, Serve, Experience, with each tool's logo, and four safeguards underneath. Further down are cards for each piece, a row showing what happens when you click, and a list of eight design decisions with what each one costs. On a phone it stacks top to bottom. Nothing else in the app changed.
