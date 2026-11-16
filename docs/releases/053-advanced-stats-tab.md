# Release 053: Advanced stats tab on the Teams page

Date: 2026-11-15
Branch / PR: feat/advanced-stats-tab (stacked on feat/game-context, PR #65)
Author: (Claude Code)

## What changed
- The Teams page gets two tabs under its header: **Overview** (the page exactly as it was) and **Advanced stats** (new, its own address: `#/teams/advanced?team=BOS`).
- The Advanced stats view shows, for the chosen team and game type (regular season or playoffs, never mixed):
  1. **Next game**: opponent, date, home or away, which game of a homestand or road trip, days of rest or back-to-back, crowded stretches ("4th game in 6 nights"), the opponent's rest and the rest edge.
  2. **Four comparisons**: home vs away, back-to-back vs rested, 2+ days of rest vs 1 day, more rested vs less rested than the opponent. Each has the six stats (points scored, points allowed, margin, FG%, 3-pointers, turnovers), the league-wide figures for every season on record, and the team's own figures this season in muted type. The comparisons that match the next game carry an "Applies to the next game" tag.
  3. A plain-words note on how to read it (the evidence is `docs/advanced-stats-stability.md`, release 052): league columns are steady, a team's own split is context, not a trait; a team difference is hidden ("too few games") under 8 games on either side.
- New route `/api/teams/:team/context?type=...` reading gold `game_context` (release 051) and `team_game_log`. A bad team or type gets a 400 before SQL.
- Nothing else changes: Today's games, Players, Teams Overview, every table and every address keep working as before (the only edit to an existing page is the tab bar line in `TeamsPage.tsx`).

## Why
`docs/NEXT.md` item 30 (the owner asked for an additive Advanced stats tab that points users at the schedule situation of the next game).

## IMPORTANT: merge order (this PR cannot work before the table exists)
1. Merge #65 (`game_context`), run the job (`daily-sync` with `force_silver` on) so the table is built.
2. Give the app read access: `GRANT SELECT ON TABLE workspace.nba_v2_gold.game_context TO` the app identity (exact statement shown to the owner first, a yes needed).
3. Only then merge this PR (it deploys automatically). Merged earlier, the Advanced stats tab shows the standard "Could not read the data" message and the Overview tab and the other pages are unaffected.
- To undo: close this PR before merging, or revert the merge commit; the table and the grant are harmless to leave in place.

## How to verify
- `npx tsc -b`, `npx oxlint`, `npm test` (157 passed: 146 before, 11 new), `npm run build`: clean.
- Real data, read-only. The real table does not exist yet, so a throwaway copy of the server in the scratch folder replaced the table name by an independent SQL version of the same logic (proved identical to the PySpark output on all 15,610 rows in release 051). The repo's server was not modified for this. Through it: NYK's next game is Nov 15 at TOR: 1 day of rest, game 2 of a road trip, 4th game in 6 nights, TOR has 2 days of rest, NYK less rested by 1 day; league buckets match the stability check (home beats away by 1.94 points of scoring; back-to-back margin -2.41 vs rested).
- Simulated browser (jsdom) on that data: the Overview tab is unchanged and gains the tabs; the Advanced tab link carries the team; the page shows the six next-game facts; four comparison panels with six rows each; the three matching comparisons (home/away, 2+ vs 1 day, rest edge) are tagged and back-to-back is not; league home-away points difference reads +1.9; the team column reads "too few games" where a side has fewer than 8 games; choosing Boston keeps the Advanced tab in the address; Playoffs mode shows a plain message; Overview, Players and the empty address (Today's games) still work. Final run: 21 of 21 checks passed. (The first run had one failing check: my test expected the heading 'Boston Celtics' while the page showed 'Boston Celtics (BOS)'; I made the page match the Teams page style, name only, and re-ran.)
- Not seen in a real browser by anyone yet; phone width untested apart from a horizontally scrollable table.

## Files added or changed
- `app/server/contextQueries.mjs` (fixed SQL and row mapping), `app/server/index.mjs` (the route).
- `app/src/TeamsAdvancedPage.tsx` (the page), `app/src/components/TeamTabs.tsx` (the two tabs), `app/src/lib/context.ts` (comparisons, differences, wording), `app/src/lib/pages.ts` (the address), `app/src/Root.tsx`, `app/src/TeamsPage.tsx` (tab bar), `app/src/api.ts`, `app/src/types.ts`.
- `app/tests/context.test.mjs`: 11 tests. `docs/releases/053-advanced-stats-tab.md`.

## Risks and things I am unsure about
- **Needs the table and one grant** (see merge order).
- The league columns include every season on record (2021-22 to now) pooled, so they describe the league's average pattern over six years, not this season alone.
- The splits are as played; they are not adjusted for opponent strength or for home/away overlap (follow-up in release 052).
- Rest figures of 8+ days are worded as "a long break, or games missing from the schedule" because the schedule hides placeholder games (release 051 warning).
- A live query on every first load of a team: about 15 to 20 seconds in the throwaway test through the SQL version; against the stored table it should be quicker, and answers are cached for 5 minutes.
- The tab exists on the Teams page only; the Players page has none yet.

## Review focus for Codex
The bucket SQL (`LATERAL VIEW explode(filter(array(...)))`), the "applicable comparisons" rule, and the minimum-games handling.

## Open questions for the owner
- Is the Advanced tab where you want it (under the page header, next to Overview)?
- Should Today's games get chips (B2B, Away, days of rest) next? (planned step 6 in `docs/NEXT.md`)

## Owner walkthrough
On the Teams page there are now two small buttons under the header: Overview and Advanced stats. Overview is the page you know. Advanced stats opens a new view for the same team. At the top it describes the team's next game in plain words, for example "Away at Toronto, game 2 of a road trip, 1 day of rest, 4th game in 6 nights, Toronto has 2 days of rest, New York less rested by 1 day". Below are four tables. Each compares two situations: home against away, a back-to-back against a rested team, two or more days of rest against one day, and more rested against less rested than the opponent. On the left are the league figures over six seasons, which are large samples. On the right, in grey, are this team's own numbers this season; they are small samples, so when a team has fewer than eight games in a situation the page says "too few games". Tables that match the team's next game carry a tag. New files: `TeamsAdvancedPage.tsx` is the page, `context.ts` holds the wording and maths, `contextQueries.mjs` is the one question the server asks the database, `TeamTabs.tsx` is the two buttons. It cannot work until the `game_context` table is built and the app has been given permission to read it; the order is in the "merge order" section above.
