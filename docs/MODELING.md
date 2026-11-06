# Modeling and research track

Half data product, half research study on the NBA. Both tracks share the same data and the same evaluation harness.

## Two tracks
- **Product track:** pipelines, gold tables, the app, daily batch predictions, monitoring. Judged by reliability and usefulness.
- **Research track:** written studies, each a notebook plus a short report with a question, method, result and caveats. Judged by honesty and clarity. Negative results count (v1's back-test is study zero).
Starter studies: how many games before a hot streak means anything; how stable are minutes; does rest matter; do opponent effects exist at all; which peer-cohort method predicts best; are our 80% ranges actually right 80% of the time.

## Principles
- Choose the model family by the shape of the target: counts (3PM, STL, BLK) need count models; ranges need quantile or interval methods; "will he play" is classification.
- Baseline first (the v1 blend of last-10 and season averages). A model earns a place only by beating it out of sample.
- Time-based splits only (train on the past, test on the future; walk-forward). Never shuffle across time. Watch for leakage.
- One shared harness: same features, same splits, same metrics for every model, results logged to MLflow as a leaderboard. This is how we get exposure to many models fairly.
- Metrics: MAE or RMSE for point forecasts; pinball loss for quantiles; interval coverage (does an 80% range contain the result about 80% of the time); log loss, Brier score or CRPS for probabilities; calibration plots.

## Model ladder (add rungs slowly, one family at a time)
| Rung | Models | Use when | NBA example |
|---|---|---|---|
| 0 Baselines | rolling mean, EWMA, last-10/season blend | always, first | v1 blend |
| 1 Linear and GLM | ridge, lasso, Poisson, negative binomial, ordinal, quantile regression | simple, interpretable, right distribution for counts | blocks as Poisson; ranges via quantile regression |
| 2 Shrinkage and hierarchical | empirical Bayes, mixed-effects, Bayesian (PyMC or Stan) | small samples, grouped players | a player partially pooled toward his peer cohort |
| 3 Tree ensembles | random forest, gradient boosting (LightGBM, XGBoost, CatBoost) | tabular features, interactions | minutes and usage drivers |
| 4 Calibrated uncertainty | conformal prediction, NGBoost, distributional boosting | you need trustworthy ranges | wrapping any model in honest intervals |
| 5 Time series | ETS, ARIMA, state-space or Kalman "form" models | evolving player form | tracking a hot or cold stretch |
| 6 Unsupervised | k-means, Gaussian mixtures, kNN, PCA, UMAP | structure without labels | peer cohorts (the Maxey-like-Brunson idea) |
| 7 Neural nets | MLP, GRU or LSTM, Transformer, player embeddings | learning and exposure; rarely wins on this data size | sequence model over game logs |
| 8 LLM-assisted | text features from injury notes, tool-calling assistants | unstructured text | see docs/LEARNING.md |

## Production-like practice (what "production" means here)
1. **Reproducible training:** code in the repo, pinned dependencies, fixed seeds, a recorded data version.
2. **Experiment tracking:** MLflow logs params, metrics, and artifacts for every run.
3. **Model registry:** register models in Unity Catalog with versions and aliases (for example champion and challenger).
4. **Same features for training and scoring:** both read the same gold feature tables, to avoid train/serve skew.
5. **Validation gate:** a model is promoted only if it beats the baseline out of sample and its interval coverage is acceptable.
6. **Batch scoring first:** a daily job writes predictions to a table, recording the model version. Real-time serving later, as exposure.
7. **Prediction log:** predictions are stored before games, never edited, then joined to outcomes afterward.
8. **Monitoring:** data freshness, input drift, error and calibration over time, with alerts and a rollback path (point the alias back).
9. **CI:** tests on feature code and model validation, in GitHub Actions.

Databricks Free Edition limits to plan around (as of 2026-11-05, verify in the docs before relying on them): about 5 concurrent job tasks, and 2 concurrent model serving endpoints with no provisioned throughput. Free Edition includes MLflow, Unity Catalog model registry, Jobs and model serving, so batch scoring first and one small serving endpoint later fits.
