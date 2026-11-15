# Advanced stats: do rest and home/away effects hold up? (stability check, 2026-11-15)

Question: before we put rest, back-to-back and home/away splits on a screen, are the effects real, and are a team's own splits steady enough to show?

## Method
- Data: every regular-season game of the five completed seasons, 2021-22 to 2025-26 (12,300 team-games, 6,150 games), from gold `team_game_log` joined to the `game_context` logic of release 051 (computed in memory, nothing written).
- Four contexts, each a comparison of A against B: **home vs away**; **back-to-back vs 1+ day of rest**; **2+ days of rest vs 1 day**; **more rested vs less rested than the opponent** (`rest_edge` above or below zero).
- Six stats: points scored, points allowed, scoring margin, FG% (pooled: total made / total attempted), 3-pointers made, turnovers.
- **Part 1, league-wide:** pool every team-game, take the difference A minus B and divide by its standard error (z; above about 2 is unlikely to be chance).
- **Part 2, one team over time:** for each team and season, work out the team's own A-minus-B effect; then correlate it across the 150 team-seasons between (a) the first and second half of the season, (b) odd and even games, (c) a season and the next. A correlation near zero means a team's split does not repeat, so it is mostly noise. With 150 pairs, a correlation within about plus or minus 0.16 is indistinguishable from zero.

## Part 1: the league-wide effects are real
| A vs B (games in A / B) | Points scored | Points allowed | Margin | FG% | 3PM | Turnovers |
|---|---|---|---|---|---|---|
| Home vs away (6,150 / 6,150) | +1.95 (z 8.5) | -1.95 (z -8.5) | **+3.90 (z 14.0)** | +0.68 (z 6.9) | +0.41 (z 5.8) | -0.14 (z -2.0) |
| Back-to-back vs 1+ day rest (2,137 / 10,013) | -1.27 (z -4.1) | +1.15 (z 3.7) | **-2.41 (z -6.5)** | -0.58 (z -4.4) | -0.09 (z -0.9) | -0.07 (z -0.8) |
| 2+ days rest vs 1 day (2,329 / 7,684) | +0.91 (z 3.0) | +0.43 (z 1.4) | +0.48 (z 1.3) | +0.12 (z 0.9) | -0.01 (z -0.1) | +0.05 (z 0.5) |
| More vs less rested than opponent (2,808 / 2,808) | +1.61 (z 4.7) | -1.61 (z -4.7) | **+3.21 (z 7.8)** | +0.78 (z 5.3) | +0.13 (z 1.3) | -0.03 (z -0.3) |

Reading it: the home team's margin is about 3.9 points better; a team on the second night of a back-to-back is about 2.4 points worse than a rested one, mostly through shooting (FG% down 0.6) and points allowed up; a rest advantage over the opponent is worth about 3.2 points of margin. More rest than one day, by itself, adds little (+0.5 margin, not clear). (In the last row points allowed is exactly minus points scored by construction: every game with an unequal rest appears once on each side.)

## Part 2: a team's own splits do not repeat
Correlation (r) of the team's effect across team-seasons. Lowest and highest of the 24 per method (4 contexts x 6 stats):

| Test | Lowest r | Highest r | Typical |
|---|---|---|---|
| First half vs second half of a season (n about 150) | -0.09 | +0.13 | around 0 |
| Odd vs even games (n about 150) | -0.15 | +0.14 | around 0 |
| Season vs next season (n = 120) | -0.10 | +0.23 | around 0.05 |

The two largest values (+0.23 for the back-to-back margin effect and +0.21 for the home FG% effect, both season to next season) sit about 2.5 and 2.3 standard errors from zero. Among 72 correlations a couple of values that high are expected by chance. Games per team-season in each situation (median): home 41 / away 41; back-to-back 14 / rested 67; 2+ days 16 / 1 day 51; more rested 19 / less rested 19. The shortest sides are around 10 games, which is why the effects are noisy.

## What this means for the design
1. **The league-wide effects are the main content.** They are large, steady and explainable, and the schedule lets us say exactly which one applies to a team's next game.
2. **A team's own split is context, not a trait.** Show it small and muted, with the number of games, and never as a headline ("Team X is bad on back-to-backs"). Hide a difference when either side has fewer than 8 games.
3. **Do not feed a team-specific rest effect into a forecast** until a back-test shows it helps. The league-wide effect is a candidate for a forecast input.

## Not covered yet (follow-ups)
- **Confounding:** the splits are as played. Home and rest overlap (a team on a back-to-back is more often on the road), and opponent strength differs. A next check should compare within the same home/away group or adjust for opponent strength.
- Player-level splits, playoffs (few back-to-backs), and the defense-by-position grid in `docs/NEXT.md` item 30b have not been tested.
- Whether any of this improves a forecast of a player's line is a back-test question (`docs/MODELING.md`).
