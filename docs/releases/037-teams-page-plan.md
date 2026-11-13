# Release 037: plan for the Teams page (offense first)

Date: 2026-11-13 (UTC)
Branch / PR: `docs/teams-page-plan` (PR number added after opening)
Author: (Claude Code)

## What changed
- Documentation only. This note is the plan for a separate **Teams** page that mirrors the Player page at team level, **offense first** (defense comes later), in the same team-colour palette. No code, no Databricks change.

## Why
The owner asked for team-level stats as the next feature, as its own page, with the player page's structure. A written plan with the exact new tables and grants lets the owner approve each one before anything runs (CLAUDE.md: ask before each new table or grant).

## The plan, in order (one pull request per step)
1. **This note** (plan only).
2. **Gold, no schema change: more stats in `team_form`.** `team_form` is long format (one row per team, game type and stat), so new stats are just more rows; no `ALTER`. Add offense stats computed from silver `team_game` (which already has the full box score): `fg_pct`, `fg3_pct`, `ft_pct`, `tov`, `oreb`, `fga`, `fta`. Keep the existing `pts`, `reb`, `ast`, `fg3m`; `blk`, `stl`, `allowed`, `margin` stay in the table for the later defense work. The gates that say "8 stats per group" and list the stat names are updated, and corrupted-copy checks prove they still fire. Percentages are per-game values for the distribution; the season figure is total made / total attempted (not an average of percentages).
3. **Gold, new table `team_game_log`** (PySpark): one row per team per game played, newest first for the app, with date, opponent, home or away, win or loss, score, margin, FG, 3P, FT, TOV, OREB, REB, AST, STL, BLK, PF and overtime periods. Key `(team_id, game_id)`. It serves the Box scores view and the "Against an opponent" panel, so the page does not need `team_vs_opponent`. It ships with gates, warnings, tests and corrupted-copy checks like `player_season_games`.
4. **App: a "Teams" page** beside the player page (a "Players | Teams" switch at the top, no new libraries): team picker, Regular season / Playoffs toggle (never mixed), Averages view (scorecards with sparklines and the "vs season avg" chip) and Box scores view (last 15 games, average row), the "against an opponent" panel with the same this-season-first, last-season-fill rule, team-colour accents and court background. New routes under `/api/teams/:id/...`.

## Proposed scorecards (offense first), for the owner to adjust
Points, FG%, 3-pointers made, 3P%, assists, turnovers. (Rebounds, offensive rebounds, FT% and free throws attempted are available as extra cards or table columns.) Season average and last-10 distribution as on the player page.

## Grants and statements (each needs the owner's yes before it is run)
- `GRANT SELECT ON TABLE workspace.nba_v2_gold.team_form TO \`8f06dddb-8775-4b0d-b35d-06c5a7a01a26\`` (the app identity; step 4 only).
- `GRANT SELECT ON TABLE workspace.nba_v2_gold.team_game_log TO \`8f06dddb-8775-4b0d-b35d-06c5a7a01a26\`` (after step 3 creates the table; step 4 only).
- Creating `team_game_log` is done by the existing bundle job when the new gold script is merged (step 3); I will show the job run first.

## How to verify
Nothing to run for this note. Each later step will quote real test output and a real job run.

## Files added or changed
- `docs/releases/037-teams-page-plan.md` (this note), `docs/NEXT.md` (Step 27 added).

## Risks and things I am unsure about
- **Data freshness:** team box scores come from the same source as player box scores; games through 2026-11-11 until the producer's daily job recovers (it failed on 2026-11-13).
- A team's last-10 window crosses into earlier seasons when it has few games of a type (existing `team_form` rule); the page labels it, as the player page does.
- Percentages over small windows are noisy; the page should say how many games each card covers.
- The "Players | Teams" switch and the page layout are untested in a real browser (no browser tool); the owner's look is the visual check.

## Review focus for Codex
(Only if the owner asks for a review.) The percentage definitions, the updated gate for the stat list, and that no regular-season and playoff rows are ever mixed.

## Open questions for the owner
1. Are the six proposed scorecards right (points, FG%, 3PM, 3P%, assists, turnovers)?
2. Should the page open on Averages, as the player page does now?
3. OK to leave `team_vs_opponent` unused for now and answer the opponent panel from `team_game_log`?

## Owner walkthrough
- **What this is:** a written plan, nothing built yet. A new Teams page that looks and works like the player page, but for a whole team: its points, shooting, assists and turnovers over the last 10 games, a table of the last 15 games, and a panel to see how it did against one other team.
- **What you would see once built:** a "Players | Teams" switch at the top, a team picker, the same Averages and Box scores buttons, the same colours for each team.
- **What to check yourself:** read the three questions above and tell me what to change. The next step (more stats in `team_form`) will not touch Databricks until you say yes to the exact statements.
