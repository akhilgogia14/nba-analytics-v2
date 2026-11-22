# ML roadmap: from the contract to predictions in production

This is the living checklist for the model track. It is updated at the end of every step. Read `docs/ml-contract.md` first (what we promise); this file says **what we do, in what order, and what you do at each step**.

## How every step ends (the working rule)
After each step I give you a **Where we are** block: what is finished, what is in review, the next step, and exactly what I need from you. No step starts until you say go.

## Status (update this table at the end of each step)
| # | Step | Status |
|---|---|---|
| 1 | Model contract | In review (PR #114) |
| 2 | Prediction log, started with the baseline | Not started |
| 3 | `ml_features` table and the leakage test | Not started |
| 4 | Frozen datasets and time-based folds | Not started |
| 5 | Experiment harness (reproduces the baseline's numbers) | Not started |
| 6 | First models | Not started |
| 7 | Validation gate and model card | Not started |
| 8 | Registry, batch scoring, show it in the app | Not started |
| 9 | Monitoring, alerts, automatic fallback | Not started |
| 10 | CI, runbook, rollback drill | Not started |

## Words used below
- **Feature:** an input the model sees, like "his last-10 points average".
- **Leakage:** a feature that secretly contains information from the game being predicted.
- **Walk-forward folds:** training on the past and testing on the next block of time, repeatedly.
- **MLflow:** the tool that records every training run (settings, numbers, files).
- **Registry and alias:** the registry stores model versions; an alias such as `champion` is a movable label for the live version.
- **Idempotent:** running a job twice gives the same result, not duplicates.

---

## Step 2: Start the prediction log, with the baseline
**Why first:** a log of predictions made *before* games cannot be created honestly afterward. Starting it now with the baseline gives a real track record by the time a model is ready.
**Rule I propose (you confirm):** a prediction for a game date is only accepted if it was made on an earlier Eastern-time day (the source has no tip-off time, so "the day before" is a rule we can prove). The daily job therefore predicts tomorrow's games, never today's.
**I do:** design the append-only `predictions` table (player, game, stat, predicted number, 10th and 90th values, which baseline version, when it was made, data version); a gold PySpark step in the daily job that fills it; gates (no duplicates, nothing made on or after the game date, no empty numbers); tests; a view joining predictions to results.
**You do:** (1) approve the table design and the "which players" rule I show you; (2) re-run the Databricks login if I report it expired; (3) approve the exact grant statement for the app to read the table, if we need one; (4) merge the PR; (5) after the next job run, check the row counts with me.
**Verify:** next morning, rows exist for tomorrow's games; no row has a made-at date on or after its game date; a second run adds no duplicates.
**Done when:** three consecutive daily runs add rows and the gates pass.
**Undo:** Revert the PR; the table can stay or be dropped (I ask before dropping anything).

## Step 3: The `ml_features` table and the leakage test
**I do:** a gold table with one row per player per game: the label (his actual stat) and only pre-game features (his last-10, season and weighted averages, minutes trend, home or away, rest, back-to-back, road-trip number, opponent form, listed position). Gates, unit tests, and the test that scrambles the target game and everything after it and checks no feature changes.
**You do:** approve the feature list (I show it first, with the reason for each); merge; after the job run, compare the row count with `player_game_log`.
**Verify:** row counts match; the leakage test fails on purpose when I plant a leak (I show you that).
**Done when:** gates pass in the job and the planted-leak check fails as it should.

## Step 4: Frozen datasets and time-based folds
**I do:** a small module that cuts the feature table into the folds in the contract (tuning through 2024-25, final test from 2025-26) and records the Delta table version it read, so a run can be repeated exactly.
**You do:** read the fold diagram I give you; confirm the test window.
**Done when:** two runs on the same data version give identical rows.

## Step 5: The experiment harness
**I do:** set up MLflow (after checking the Free Edition limits in the docs) and one harness that runs any model on the same features, folds and metrics.
**The first test:** the harness must reproduce the baseline's known misses (points 4.665, rebounds 1.916, assists 1.364, minutes 4.915). If it does not, the harness is wrong and nothing proceeds.
**You do:** open the MLflow page (I send the steps) and see the baseline run listed.
**Done when:** the baseline reproduces to three decimals.

## Step 6: First models
**I do, one at a time, reporting after each:** a linear model that predicts the miss (actual minus baseline) from the context features; a quantile model for the 10th and 90th values; gradient boosting; minutes in two stages.
**You do:** read the leaderboard table I produce and tell me which results are surprising. This is where you learn what the data says.
**Done when:** every model is scored on the same folds and logged.

## Step 7: Validation gate and model card
**I do:** an automated report that applies section 4 of the contract to a candidate and prints pass or fail per rule, and a one-page model card.
**You do:** read both. The decision to promote is yours.
**Done when:** a candidate either passes everything or the baseline is confirmed as champion, in writing.

## Step 8: Registry, batch scoring, and the app
**I do:** register the model, set `champion` and `challenger` aliases, add a daily scoring step that writes model predictions into the `predictions` table beside the baseline's, and show the forecast on the Predictions page next to the baseline, with its range.
**You do:** approve the exact app grant; merge; check the page after the deploy; if a model is down the page must show the baseline only.
**Done when:** the model's predictions are logged before games for a week and the app shows them.

## Step 9: Monitoring and fallback
**I do:** a job that joins predictions to real results, then tracks rolling error against the baseline, range coverage, data freshness and drift; Slack alerts; automatic fallback.
**You do:** approve the alert thresholds I propose; they go into the contract.
**Done when:** I trigger a test failure and the fallback and the Slack alert both fire.

## Step 10: CI, runbook, rollback drill
**I do:** PR checks (tests, the leakage test, a small training smoke test), a runbook of "if X happens, do Y".
**You do:** practise the rollback: move the `champion` alias back and confirm the app follows.
**Done when:** you have done a rollback yourself, using only the runbook.

---

## Production-ready means all of this is true
- [ ] A written contract and a gate a model must pass
- [ ] Features are tested for leakage and shared by training and scoring
- [ ] Every run is reproducible from a recorded data version and commit
- [ ] Predictions are stored before games and never edited
- [ ] The app shows the baseline whenever the model cannot be trusted
- [ ] Rolling error and range coverage are monitored, with alerts
- [ ] A rollback has been practised
- [ ] Everything above is in the repo with tests and release notes
