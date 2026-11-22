# Release 092: The model contract

Date: 2026-11-22
Branch / PR: docs/ml-contract
Author: (Claude Code)

## What changed
- **A new document, `docs/ml-contract.md`:** the written promise made before any model is trained. It says what a prediction is (one player, one upcoming regular-season game, given that he plays, made before tip-off), which stats come first (points, rebounds, assists, minutes), what output each gets (a number and a 10th to 90th percentile range), which players are covered (all, with rotation players also reported alone), and what the baseline to beat is (with the average misses we measured).
- **The promotion gate, in writing:** a model replaces the baseline only if it is at least 1% better with a confidence interval that excludes zero, no group of players is more than 1% worse, its ranges contain the actual result 77% to 83% of the time, and the run is reproducible with the leakage test passing. If nothing passes, the baseline stays.
- **A second document, `docs/ml-roadmap.md`:** the ten steps from the contract to predictions in production, each with what I do, what you do, how you verify it, and when it is done, plus a status table updated at the end of every step.
- No code, no tables and no app change. Docs only.
- Step 1 of the ML plan from the conversation on 2026-11-22. The next steps (prediction log starting with the baseline, then the feature table, frozen datasets, the experiment harness, first models) each come as their own pull request.

## How to retract
One self-contained PR: click **Revert**. The document goes away; nothing depends on it yet.

## How to verify
- The four decisions in section 9 are yours (answered on 2026-11-22). The items marked "my call" are mine, and the log says so.
- The baseline numbers match `docs/predictions-backtest.md` (points 4.665, rebounds 1.916, assists 1.364) and Result 6 (minutes 4.915).

## Risks
- The 77% to 83% coverage band, the split choices and the model-card rule are my proposals. If you would rather have a different band, say so before the harness is built, because the gate is coded from this page.
- The final test window (2025-26 on) was already used to study the baseline, so it is not untouched for the baseline, though no baseline setting was chosen on it.

## Owner walkthrough
Open `docs/ml-contract.md`. Sections 1 and 2 say what we are predicting and the numbers to beat. Section 4 is the one that matters most: it is the checklist a model has to pass before it ever shows on a page. Section 6 says what we will not do, and section 9 lists who decided what. Nothing in the app or in Databricks changed.
