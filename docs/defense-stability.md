# Defense by position: does a team's pattern repeat? (2026-11-20)

The Teams > Advanced stats panel shows what each opposing group (starters and bench, by listed position) put up against a team, next to the league. Its caveat said it was untested whether a team's pattern repeats. This is that test. Script: `scripts/analysis/defense_stability.py` (read-only).

## Method
- Regular season 2021-22 to 2025-26 (the current season is too young); 81,232 team-game-group rows from gold `player_season_games`, `team_game_log` and `player_season_position`, with the panel's own definitions (starter = started the game; position = the listed label; stats = points, rebounds, assists, 3-pointers, blocks, steals; figure = per 36 minutes of the group).
- Three versions of the figure for each defending team-season and group:
  - **Shown:** the group's total over its minutes, as the panel shows it.
  - **Adjusted:** each opposing player's game minus his own season rate times his minutes, so who the defense happened to face is taken out (as in release 061).
  - **Position-specific:** adjusted, minus the same team's adjusted figure against all opposing players in the same games, so a team-wide level (good or bad defense overall) is removed and only what is particular to the group is left.
- Repeat tests, by correlation r across team-seasons: first half vs second half of a season, odd vs even games, and a season vs the next. Splits are by game, shared by all groups of a team. A side needs at least 20 player-games (40 per season for season-to-season). About 150 team-seasons (120 season pairs) per group: one standard error is about 0.08.
- Only 7 of 16 groups have enough games: starter G, F and C; bench G, F, G-F (about 25 team-seasons, so weak) and Not listed. The rare labels (C-F, F-G, F-C, starter G-F, starter Not listed) have under 40 player-games a season and cannot be tested.

## Result: mean r over the testable groups, per stat (range over the six stats)
| Version | First vs second half | Odd vs even | Season vs next |
|---|---|---|---|
| Shown | +0.10 to +0.20 | +0.21 to +0.29 | +0.20 to +0.35 |
| Adjusted | +0.13 to +0.20 | +0.21 to +0.30 | +0.18 to +0.33 |
| Position-specific | -0.02 to +0.17 | +0.03 to +0.17 | +0.05 to +0.18 |

1. **Defense does repeat, mostly as a team-wide level.** Shown and adjusted figures correlate about +0.2 to +0.3 (assists next season +0.35), far more than the team splits in `docs/advanced-stats-stability.md`. Adjusting for who they faced changes almost nothing.
2. **The position-specific part mostly does not.** Removing the team's overall level cuts the repeat to about zero for steals (-0.02 to +0.05), assists (+0.01 to +0.14) and rebounds (+0.03 to +0.18); points +0.09 to +0.12.
3. **Blocks are the exception:** +0.17, +0.15, +0.18 over the three comparisons, with bench guards (+0.19 to +0.31) and starting guards (+0.19 to +0.31) the main contributors. Single groups reach +0.3 or more in some tests, which with 7 groups x 6 stats x 3 tests looked at is partly what luck looks like (starting centers on points: +0.35, +0.29, then +0.13 next season). One is steady across all three tests and worth re-checking when another season arrives: **starting centers on 3-pointers (+0.36, +0.35, +0.35, 64 to 74 team-seasons)**. It is one value out of 126 looked at, so it is a candidate, not a finding.
4. **Odd vs even is higher than first vs second half.** Part of what repeats within a season is the team changing over the season (trades, injuries, rotation), which the odd/even split averages out.

## What this means
- Read the panel's Difference column mainly as "how good is this defense overall", not as "this team is weak against centers". The panel's caveat now says so.
- As a forecast input, a team-wide defense level is the candidate (it repeats); a per-position adjustment is not supported, apart from possibly blocks. Whether either improves the Predictions baseline is a separate back-test (`docs/predictions-backtest.md` set the numbers to beat); nothing is added to the page.
- Not covered: whether the team-wide level beats what the baseline already captures through the player's own recent games; playoffs; the current season; lineup or matchup effects (who guards whom is not in the data).
