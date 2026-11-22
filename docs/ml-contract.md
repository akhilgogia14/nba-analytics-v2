# Model contract: player stat forecasts (v1, 2026-11-22)

Status: **agreed by the owner on 2026-11-22**, except the items marked **(my call)**, which are Claude's proposals for the owner to accept or change. This is the written promise made before any model is trained. It follows `docs/MODELING.md` and uses the numbers in `docs/predictions-backtest.md`.

**Change control:** the contract changes only with the owner's approval and a dated line in the log at the bottom. It is never edited after seeing a model's results to make that model pass.

## 1. What is being predicted
- **One prediction** = one player, one upcoming regular-season game, **given that he plays**, made **before tip-off** using only information from earlier games.
- **First stats (wave 1):** points, rebounds, assists, minutes. Each is judged separately against its own baseline.
- **Wave 2, later:** 3-pointers, blocks, steals (small counts, they need count models, and the back-test found nothing beats the long-run average by much).
- **Not covered yet:** combined stats (points + rebounds + assists and so on), playoffs, whether he plays at all, and games with fewer than 10 earlier games (rookies, long returns).
- **Output for each prediction:** a point forecast (one number) and a **10th to 90th percentile range**, the same "middle 80%" language the Predictions page uses.
- **Players covered:** all players with at least 10 earlier games. Every report also shows **rotation players** (average of at least 20 minutes over their previous 10 games) on their own.

## 2. The baseline a model must beat (the champion at the start)
| Stat | Baseline | Held-out average miss (MAE, all players) |
|---|---|---|
| Points | 50/50 blend of last-10 and season averages | 4.665 |
| Rebounds | same blend | 1.916 |
| Assists | same blend | 1.364 |
| Minutes | weighted average of recent games (release 087) | 4.915 |

These are measured on 2025-26 and 2026-27 games (29,923 games on 2026-11-19). The held-out window grows as games are played, so the **rule is relative**: a model is compared with the baseline **on the same games**, never with a number quoted from here.

## 3. Data and splits (my call)
- **Features** come only from before the game (the leakage rules in section 5).
- **Tuning and model choice:** walk-forward folds inside seasons up to and including 2024-25 (train on the past, test on the next block; never shuffle across time).
- **Final test:** games from 2025-26 on. A candidate is scored on it only at the validation gate, never used to choose settings.
- **Known limit:** the baseline was already studied on the 2025-26 window (with its settings chosen on earlier seasons only), so the baseline's number there is fair, but the window is not untouched for the baseline.
- Each run records the data version (the Delta table version it read) and the git commit.

## 4. The promotion gate (all must pass for a model to replace the baseline)
1. **Accuracy (agreed):** average miss at least **1% lower** than the baseline on the final test, all players, with the **paired 95% confidence interval** of the per-game difference **excluding zero** (a real gain, not luck).
2. **No group worse (agreed):** no group may be more than **1% worse** than the baseline: rotation players, each minutes band (under 10, 10 to 20, 20 to 30, 30 and up), and each season on its own.
3. **Honest ranges (my call):** the 10th to 90th range must contain the actual result **between 77% and 83%** of the time on the final test, overall and for rotation players. The report also shows its width next to the page's last-10 min-to-max range.
4. **Integrity (my call):** the leakage test passes; a rerun with the same data version, code and seed gives the same metrics; the data version and commit are recorded.
5. **Written up (my call):** a model card (what it is, what it is good and bad at, the numbers above) is committed with it.

If no model passes, **the baseline stays champion**. That is a documented result, not a failure.

## 5. Rules every feature must follow (leakage)
- A feature uses only games **before** the one being predicted, and the current game is never in its own average.
- Every new feature ships with a test that scrambles the target game and everything after it and checks the feature does not change (the same test the back-test harness already uses).
- Training and scoring use **the same feature code and the same feature table**.

## 6. Non-goals and anti-goals
- No odds, lines or betting advice; no profit claims; public wording stays "forecast", "range" and "track record".
- Not live: batch scoring once a day before games.
- A model that is better on average but clearly worse for a group of players is not shipped.
- No tuning on the final test. No editing this contract after seeing results.

## 7. How the system behaves in production (details set in later steps)
- Predictions are stored **before tip-off and never edited**, then joined to results to give an honest track record.
- The app always shows the baseline; the model's forecast shows beside it only after it passes the gate.
- If the champion's rolling error is worse than the baseline's for a set stretch, the app falls back to the baseline automatically. The thresholds are set in the monitoring step and added here with the owner's approval **(my call)**.

## 8. Open items
- Injury and "who is out" data (in bronze, unused) is the biggest feature not yet built.
- Writing predictions needs a writable table and a permission change; the exact statement is shown to the owner first.
- Databricks Free Edition limits for MLflow, the model registry and serving are to be verified in the docs before the registry step (`docs/MODELING.md`).

## 9. Decision log
| Date | Decision | By |
|---|---|---|
| 2026-11-22 | First stats: points, rebounds, assists, minutes | Owner |
| 2026-11-22 | Range: 10th to 90th percentile | Owner |
| 2026-11-22 | Promotion bar: at least 1% lower error, interval excludes zero, no group more than 1% worse | Owner |
| 2026-11-22 | Players: all, with rotation players reported separately | Owner |
| 2026-11-22 | Splits, coverage band 77 to 83%, integrity checks, model card, monitoring thresholds later | Claude's call, for owner review |
