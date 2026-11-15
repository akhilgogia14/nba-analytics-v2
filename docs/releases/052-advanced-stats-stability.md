# Release 052: stability check for the Advanced stats ideas (analysis only)

Date: 2026-11-15
Branch / PR: docs/advanced-stability
Author: (Claude Code)

## What changed
- One new document, `docs/advanced-stats-stability.md`: the result of a read-only analysis of five completed regular seasons (12,300 team-games). No code, no table, no app change.

## Why
`docs/NEXT.md` item 30 says the stability check comes before any screen. This is that check for the rest, back-to-back and home/away contexts.

## How to verify
- Read the document; the method is in it. The analysis ran as a script in the assistant's scratch folder (Databricks Connect, in-memory only) over `team_game_log` and the `game_context` logic of release 051. It is not kept in the repo; if you want it kept, say so and it becomes `scripts/analysis/`.
- Numbers to spot-check: home-minus-away margin +3.90 points (z 14.0); back-to-back margin -2.41 (z -6.5); rest edge margin +3.21 (z 7.8); team-level correlations between halves, odd/even games and seasons between -0.15 and +0.23, mostly under 0.15.

## Files added or changed
- `docs/advanced-stats-stability.md`, `docs/releases/052-advanced-stats-stability.md`.

## Risks and things I am unsure about
- The splits are not adjusted for opponent strength or for home/away overlap; the document lists this as the first follow-up.
- Only regular seasons and team-level stats were tested. Playoffs, player stats and defense by position were not.
- The script is not in the repo, so the run cannot be repeated from the repo alone.

## Review focus for Codex
Whether the correlation method (across team-seasons, minimum 3 games per side per split-half and 5 for season-to-season) supports the claim that team-specific splits are noise.

## Open questions for the owner
- Keep the analysis script in the repo?
- Next check: control for home/away and opponent strength before we show any combined effect?

## Owner walkthrough
We asked whether it is worth putting rest and home/away numbers on a screen. The answer has two halves. Across the whole league the effects are big and reliable: the home team beats the away team by almost four points; a team on the second night of a back-to-back does about two and a half points worse; being better rested than the opponent is worth about three points. But a single team's own record in those situations does not repeat from the first half of a season to the second, or from one season to the next, because each team has only 10 to 20 games in a given situation. So the Advanced stats page leads with the league-wide pattern and the team's next game, and shows the team's own numbers small, with the game count, as context. This document is the evidence. No screen changes with it.
