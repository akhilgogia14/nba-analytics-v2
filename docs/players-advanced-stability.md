# Advanced stats for players: do rest and home/away effects hold up? (stability check, 2026-11-17)

Question: the Players Advanced tab (release 061) shows how a player's stats move with home or away, rest and back-to-backs. Are the league-wide effects real, and are a player's own splits steady enough to lean on? This repeats the team check (`docs/advanced-stats-stability.md`, release 052) for players.

## Method
- Data: every regular-season game of the five completed seasons, 2021-22 to 2025-26, from gold `player_season_games` joined to `game_context` (read-only; nothing written). 270,272 player-games in the grid (131,274 played). Only player-seasons with at least 20 games played count (2,232 of them), the same rule the page uses for the league columns.
- Four contexts, each A against B: home vs away; back-to-back vs 1+ day of rest; 2+ days vs 1 day; more rested vs less rested than the opponent.
- Seven stats: points, rebounds, assists, 3-pointers made, blocks, steals, minutes. Plus **availability**: the share of the team's games he played in situation A minus the share in B.
- **Part 1, league-wide:** each played game's stat minus that player's own average for the season; A minus B of the averages, divided by its standard error (z).
- **Part 2, one player over time:** each player-season's own effect (A minus B over games he played, at least 3 per side per half, 5 per side per season), correlated across player-seasons between (a) the first and second half of his season, (b) odd and even games, (c) a season and the next. A correlation near zero means a player's split does not repeat. With 1,300 to 2,200 pairs, a correlation within about plus or minus 0.05 is indistinguishable from zero.

## Part 1: the league effects are statistically clear and small
Per played game, against the player's own season average (z in brackets). Played games A / B in the first column.

| A vs B (played games) | Points | Rebounds | Assists | 3PM | Blocks | Steals | Minutes | Availability (A vs B) |
|---|---|---|---|---|---|---|---|---|
| Home vs away (63,209 / 62,712) | +0.09 (2.8) | +0.03 (1.9) | +0.05 (5.1) | +0.03 (4.4) | +0.02 (4.6) | -0.01 (-1.6) | -0.15 (-3.9) | 59.8% vs 59.3% |
| Back-to-back vs 1+ day rest (21,656 / 102,653) | +0.31 (6.8) | +0.09 (4.6) | +0.04 (3.3) | +0.03 (3.6) | 0.00 (-0.1) | +0.01 (1.4) | **+0.68 (13.2)** | 58.9% vs 59.6% |
| 2+ days vs 1 day (24,001 / 78,652) | -0.12 (-2.7) | -0.04 (-2.4) | -0.03 (-2.2) | -0.02 (-2.1) | 0.00 (0.9) | +0.01 (1.1) | -0.28 (-5.8) | 60.0% vs 59.5% |
| More vs less rested than the opponent (28,854 / 28,603) | -0.17 (-3.5) | -0.03 (-1.6) | -0.01 (-1.0) | -0.02 (-2.0) | 0.00 (0.7) | 0.00 (-0.3) | -0.50 (-9.0) | 59.8% vs 59.4% |

Reading it: with this many games almost everything is statistically distinguishable from zero, but nothing is large. The biggest is minutes on the second night of a back-to-back, +0.7 minutes over a player's own average; the biggest points effect is +0.3. Availability barely moves (about 0.5 percentage points either way). **The direction on back-to-backs is the opposite of the team result** (a team's margin is 2.4 points worse, release 052), so it must not be read as "back-to-backs help players". My best explanation is selection (a player who is playing on the second night is, almost by definition, healthy and in the rotation, while a player coming off a day of rest includes returns from injury and light-minute games), but I have not shown that. It is a description of what happened, not a cause.

## Part 2: a player's own splits do not repeat (one exception)
Correlation r of a player's effect across player-seasons. 84 values (4 contexts x 7 stats x 3 methods):

| Test | Lowest r | Highest r | Typical |
|---|---|---|---|
| First half vs second half of a season (n 1,547 to 2,037) | -0.06 | +0.10 | about +0.02 |
| Odd vs even games (n 1,598 to 2,215) | -0.06 | +0.06 | about +0.01 |
| Season vs next season (n 1,282 to 1,426) | -0.04 | +0.16 | about +0.03 |

All 84 are between -0.06 and +0.16 (mean +0.017). Only the back-to-back **minutes** effect, season to next season, is clearly above chance (+0.16, about 5.7 standard errors), and even that explains under 3% of the variation. The player columns on the page are therefore context, as the page already says.

**The exception is availability on back-to-backs:** whether a player plays the second night (compared with his share of games played when rested) correlates +0.20 between the two halves of a season and +0.25 from one season to the next. Odd vs even games gives only +0.04, so part of the first-half/second-half link is time clustering (an injury keeps a player out of consecutive games, back-to-backs included), but the season-to-next-season figure suggests a player-level habit too (veterans and stars who are rested on the second night). Home/away (0.00 to +0.02) and the other rest contrasts (-0.01 to +0.08) do not repeat.

Games per player-season in each situation (median played games): home 30 / away 30; back-to-back 10 / rested 49; 2+ days 11 / 1 day 37; more rested 13 / less rested 13. The shortest sides (10th percentile) are 5 to 6 games, which is why a player's own split is noisy.

## What this means for the design
1. **The league columns are right to lead, with two decimals** (the effects are small; one decimal would show "0.0"). Say plainly that they are small.
2. **A player's own averages by situation are context, not a trait.** Keep them muted with the number of games (already done). The page note can state the evidence, as the Teams note does: "when we tested five seasons of past data, a player's own split in one half of a season did not predict the other half".
3. **Availability on back-to-backs is the one personal signal that repeats a little (r 0.2 to 0.25).** It is a candidate for a short "plays the second night of back-to-backs: 2 of 5" line at the top, but it mixes habit with injury, so show it as a count, never as a rate with a label.
4. **Do not feed a player-specific rest effect into a forecast** unless a back-test shows it helps (`docs/MODELING.md`). The league-wide player effects are tiny; the strongest candidate input is availability, not the stat effects.

## Not covered (follow-ups)
- Confounding: splits are as played (home and rest overlap; opponent strength varies). A within-home/away or opponent-adjusted version has not been run, for teams or players.
- Playoffs, and splits by minutes (starters vs bench) or by role.
- Whether availability on back-to-backs predicts DNP better than the league base rate (a back-test question).
- Why the back-to-back effect on minutes and points is positive.
