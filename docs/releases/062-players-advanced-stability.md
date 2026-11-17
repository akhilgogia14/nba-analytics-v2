# Release 062: stability check for player splits

Date: 2026-11-17
Branch / PR: docs/players-stability
Author: (Claude Code)

## What changed
- Docs only: `docs/players-advanced-stability.md` (method, tables, what it means for the design) and `docs/NEXT.md` (the Players Advanced tab is marked LIVE, the result is recorded).

## Why
The owner asked for the check (2026-11-17) before leaning on the grey player columns of the Players Advanced tab (release 061), mirroring release 052 for teams.

## How to verify
- Read-only queries on `player_season_games` joined to `game_context`, seasons 2021-22 to 2025-26, 2,232 player-seasons with 20+ games played; the analysis ran in memory in a scratch folder (outside the repo). Nothing was written to Databricks.
- Headline: the league effects are statistically clear and small (largest: +0.68 minutes and +0.31 points on the second night of a back-to-back, against a player's own average); a player's own splits do not repeat (84 correlations between -0.06 and +0.16, mean +0.017); the exception is availability on back-to-backs (r +0.20 between halves, +0.25 season to next season).

## Files added or changed
- `docs/players-advanced-stability.md`, `docs/releases/062-players-advanced-stability.md`, `docs/NEXT.md`.

## Risks and things I am unsure about
- The positive back-to-back effect on points and minutes is the opposite of the team effect and I only have a guess (selection of who plays). It is described in the doc, not explained.
- The analysis script is not in the repo (same as release 052). Its method is written out in the doc; keeping the script is still an open question.
- Not run: opponent-adjusted or home/away-adjusted versions, playoffs.

## Review focus for Codex
Whether the half-season split by the player's own game order (not the team's calendar) biases the correlation, and whether the 20-game rule on the whole season leaks into the halves.

## Open questions for the owner
- Add one sentence of evidence to the Players Advanced note (as the Teams note has), and a "plays the second night of back-to-backs: N of M" line near the top? Both are small app changes and deploy on merge.

## Owner walkthrough
We tested whether a player's habits by situation repeat. For every player in five seasons, we compared his first half of the season with his second half, odd games with even games, and one season with the next. The answer for stat lines (points, rebounds and so on) is no: how a player does at home versus away, or after rest versus on a back-to-back, in one half tells you almost nothing about the other half. The league-wide patterns are real but small: the biggest is that players average about 0.7 more minutes on the second night of a back-to-back than their own normal, which I can describe but not yet explain. One thing does repeat a little: whether a player sits out the second night of back-to-backs. It is partly injuries and partly a habit, so I would show it as a simple count, not a label.
