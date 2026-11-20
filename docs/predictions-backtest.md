# Predictions baseline: back-test against what happened (2026-11-18)

Question: the Predictions page (release 068) shows a baseline, half his last-10 average and half his season average, plus min, average and max over three views of his past games. How good is that baseline, were the 50/50 weights right, does the opponent view help, and how tight are the min-to-max ranges? This is the "baseline first" step of `docs/MODELING.md`: whatever model comes later has to beat these numbers.

## Method
- Data: every regular-season game a player played, 2021-22 to 2026-27 so far, from gold `player_season_games` (read-only). Each game after a player's first 10 is a target: 126,070 target games from 1,086 players.
- **Walk-forward, no peeking:** each target is predicted only from games before it (`scripts/analysis/backtest_features.py`; a test changes the target and everything after it to absurd values and checks every predictor is unchanged).
- **Honest split:** blend weights were chosen on targets up to 2024-25 (96,247 games); every score below is on 2025-26 and 2026-27 so far (29,823 games, 19,008 of them by rotation players: average over his previous 10 games at least 20 minutes), which the weights never saw.
- Predictions are of the stat **given that he plays**. Who sits out is a separate question, not tested here.
- Predictors: last-10 mean, last-5 mean, exponentially weighted mean (about a 10-game memory), season-to-date mean (last-10 until the season has a game), career mean, and the mean of his last 10 meetings with the opponent. Scores: MAE (mean absolute error, in the stat's own units) and RMSE.
- Script: `scripts/analysis/backtest_baseline.py` (and `backtest_features.py`).

## Result 1: the 50/50 weights are right
On the training seasons, the lowest error is at 0.3 to 0.7 on last-10 for every stat (points 0.5, rebounds 0.4, assists 0.4, 3-pointers 0.3, blocks 0.4, steals 0.3, minutes 0.7), and the curve is flat: for points, a weight of 0.4 and 0.6 differ from the best by 0.004 points of error. On the held-out seasons the chosen weights score the same as 50/50 to within 0.015 for every stat (points identical, 4.665). **Keep 50/50.**

## Result 2: the blend beats either window alone, but only slightly
Held-out MAE, all players (RMSE in brackets); the page's baseline is "blend50":

| Stat | Typical size (mean) | blend50 | season only | last 10 only | last 5 only | weighted mean | career |
|---|---|---|---|---|---|---|---|
| Points | 10.6 | **4.665** (6.11) | 4.744 | 4.752 | 4.878 | 4.698 | 5.206 |
| Rebounds | 4.0 | **1.916** (2.53) | 1.938 | 1.955 | 2.005 | 1.933 | 2.054 |
| Assists | 2.5 | **1.364** (1.86) | 1.379 | 1.388 | 1.420 | 1.373 | 1.471 |
| 3-pointers | 1.2 | **0.900** (1.26) | 0.907 | 0.913 | 0.940 | 0.908 | 0.933 |
| Blocks | 0.45 | 0.512 (0.74) | 0.512 | 0.516 | 0.524 | 0.516 | 0.525 |
| Steals | 0.77 | 0.733 (0.96) | 0.735 | 0.742 | 0.758 | 0.737 | **0.730** |
| Minutes | 22.2 | 5.097 (6.66) | 5.270 | 5.223 | 5.133 | **5.015** | 6.491 |

- On points the blend is 1.7% better than the season average and 1.8% better than last 10. A shorter window is worse (last 5: +4.6%). It is a real but small edge.
- Blocks and steals are essentially flat: nothing beats the long-run average by a meaningful amount.
- **Minutes** are the one place a different smoother helps: the weighted mean is 1.6% better than the blend (5.015 vs 5.097). A small candidate improvement.
- Rotation players are harder to predict in absolute terms (points MAE 5.25) because they score more; the ranking of predictors is the same.
- Scale: a points error of 4.7 on a typical 10.6 is large, because games vary a lot. The blend's RMSE of 6.1 against a spread (standard deviation) of 8.65 in points means the plain blend explains roughly half of the game-to-game variation in points (including the differences between players). The rest is the game itself.
- The blend does not drift: on average it is 0.08 points and 0.16 minutes too low. The result holds in each held-out season separately (2025-26 points 4.643 vs 4.724 season-only; 2026-27 so far 4.797 vs 4.867).

## Result 3: the opponent view adds almost nothing (v1 finding confirmed)
Mixing his last-10-meetings mean into the blend, on games where he had met the team before:

| Stat | 0% opponent | 10% | 20% | 30% | 50% | 100% |
|---|---|---|---|---|---|---|
| Points | 4.705 | **4.700** | 4.720 | 4.767 | 4.936 | 5.703 |
| Rebounds | 1.929 | **1.926** | 1.932 | 1.946 | 1.999 | 2.256 |
| Minutes | **5.039** | 5.067 | 5.144 | 5.265 | 5.631 | 7.060 |

A 10% share improves points by 0.1% (about one hundredth of a point of error), more than that makes it worse, and the opponent view alone is far worse than the blend (points +21%). For minutes any opponent weight hurts. With at least 5 earlier meetings the picture is the same. So the page is right to mute the opponent columns and say they are context. (Steals gain 0.7% at 20% to 30%, the largest, and still small.) What this does not test: the opponent's defense for his position (the defense grid), which is a different signal from his own history against the team.

## Result 4: the page's min-to-max range is honest but wide
How often the actual game falls inside the range of his last 10 games (the page's Min and Max), and how wide that range is:

| Stat | Inside last-10 range | Width | Inside season range | Width |
|---|---|---|---|---|
| Points | 85.7% | 16.9 | 86.5% | 19.1 |
| Rebounds | 88.4% | 6.9 | 88.6% | 7.8 |
| Assists | 90.7% | 4.8 | 90.3% | 5.4 |
| 3-pointers | 93.3% | 3.1 | 92.7% | 3.5 |
| Blocks | 95.4% | 1.6 | 95.1% | 1.9 |
| Steals | 94.5% | 2.4 | 93.6% | 2.8 |
| Minutes | 80.1% | 17.9 | 82.0% | 20.9 |

For ten games, about 82% of new games should land inside the range by chance alone (nine in eleven); the figures are higher for counts because a tie with the min or max counts as inside. The ranges do their job (the answer is inside them 80 to 95% of the time) but they are wide: for points, a 17-point band while the typical miss of the blend is 4.7. They are a description of what has happened, not a tight interval; a model's ranges would have to be narrower at the same coverage to be worth having.

## Result 5: the typical miss depends a lot on minutes (added 2026-11-19)
The page now shows each player's typical miss (release 069). One figure for everyone would mislead, so the back-test was split by the player's average minutes over his previous 10 games. MAE of the 50/50 blend, held-out seasons:

| Minutes band (games) | Points | Rebounds | Assists | 3-pointers | Blocks | Steals | Minutes |
|---|---|---|---|---|---|---|---|
| Under 10 (2,666) | 2.918 | 1.443 | 0.814 | 0.498 | 0.276 | 0.447 | 5.594 |
| 10 to 20 (8,184) | 3.875 | 1.791 | 1.080 | 0.721 | 0.449 | 0.641 | 5.871 |
| 20 to 30 (12,302) | 4.893 | 1.986 | 1.430 | 0.967 | 0.552 | 0.780 | 5.016 |
| 30 and up (6,771) | 5.892 | 2.129 | 1.805 | 1.157 | 0.610 | 0.870 | 4.114 |
| Everyone (29,923) | 4.665 | 1.917 | 1.364 | 0.901 | 0.512 | 0.733 | 5.097 |

Players who play more put up bigger numbers and so miss by more in absolute terms (points: 2.9 for under 10 minutes, 5.9 for 30 and up); the one exception is minutes themselves, which are steadier for players who play a lot (4.1 against 5.6). Each figure is an average over the players in the band, so a player who scores very little misses by less than his band's number (a 3-minute player with a baseline of 0.0 cannot be 2.9 points below it); the page says so.

The script was rerun on 2026-11-19, which added 100 games played since (29,923 held-out games instead of 29,823). No figure in Results 1 to 4 moved by more than 0.002 and the chosen weights are identical.

## What this means for the page and the modeling
1. **Keep the baseline as is (50/50).** No weight change is supported.
2. **Number to beat:** held-out MAE of 4.665 points, 1.916 rebounds, 1.364 assists, 0.900 3-pointers, 0.512 blocks, 0.733 steals, 5.097 minutes (all players). A model earns a place only below these on the same games, with ranges that are narrower at the same coverage (`docs/MODELING.md` validation gate).
3. **Small things worth trying first:** a weighted-mean smoother for minutes (about 1.6% better); a "typical miss" figure next to the baseline on the page (for example "this baseline misses points by about 4.7 on average"), which tells a reader how much to lean on it.
4. **Where a real gain is plausible:** minutes and role (who starts, who is out), then who the opponent's defense gives up the most to (defense grid), rest and home/away only through minutes. The earlier stability work says player-specific rest effects do not repeat; league effects are tiny. Expect modest gains.
5. Not covered: playoffs, availability (whether he plays), games with fewer than 10 prior games (rookies, returns), injuries or trades, and models beyond smoothers (Poisson/negative binomial counts, quantile regression).
