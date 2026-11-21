# Analysis scripts (read-only)

One-off studies behind the stability notes. They only read from Databricks and write nothing. Re-run them when a new season is complete to see whether the findings still hold.

| Script | Question | Written up in |
|---|---|---|
| `team_stability.py` | Are a team's rest and home/away effects real, and does a team's own split repeat? | `docs/advanced-stats-stability.md` |
| `player_stability.py` | The same for players (stat effects and availability). | `docs/players-advanced-stability.md` |
| `adjusted_stability.py` | Do both survive removing home/away and opponent strength? | `docs/adjusted-stability.md` |
| `backtest_baseline.py` (with `backtest_features.py`) | How good is the Predictions baseline (50/50 last-10 and season) against what happened? | `docs/predictions-backtest.md` |
| `backtest_minutes.py` | Does a recency-weighted average beat the 50/50 blend for minutes (the smoother the page uses), and what is the typical miss by minutes band? | `docs/predictions-backtest.md` (Result 6) |
| `defense_stability.py` | Does a team's defense against a position group repeat (shown, adjusted, position-specific)? | `docs/defense-stability.md` |

## How to run
- They need Databricks Connect, which is **not** in `requirements.txt` (it is a separate environment, see CLAUDE.md "Tools"). Use a venv with `databricks-connect` 16.4.x, `numpy` and `pyarrow<20`, logged in as profile `DEFAULT`.
- From the repo root: `<that venv>/bin/python scripts/analysis/team_stability.py`. The back-test's feature builder is plain Python with tests (`tests/test_backtest_features.py`, run by pytest). Each takes one to a few minutes and prints its tables.
- The scripts keep seasons up to `season <= 2026` (the 2025-26 season is season 2026), the last completed one when they were written. Raise that number in the `WHERE` clauses once another season is complete.
- `team_stability.py` rebuilds `game_context` in memory (`scripts/gold_game_context.py`) instead of reading the table, so it also works before the table is granted.
