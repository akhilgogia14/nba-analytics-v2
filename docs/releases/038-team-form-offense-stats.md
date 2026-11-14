# Release 038: `team_form` gains seven offense stats

Date: 2026-11-13 (UTC)
Branch / PR: `feat/team-form-offense` (PR number added after opening)
Author: (Claude Code)

## What changed
- Gold `team_form` goes from 8 to **15 stats per team and game type**. New: `fg_pct`, `fg3_pct`, `ft_pct` (0-100 scale), `tov` (turnovers), `oreb` (offensive rebounds), `fga` and `fta` (shots and free throws attempted). They come from silver `team_game`, which already had the full team box score. The table is long format (one row per team, game type and stat), so this adds rows (about 85 groups x 7 = about 600 more) and **needs no `ALTER TABLE` and no new grant**.
- **Percentages:** per game it is made / attempts x 100 (empty if there were no attempts, never zero). The 10-game and season **averages are pooled** (total made / total attempts), not an average of per-game percentages, so a 10-of-20 game and a 30-of-40 game give 66.7%, not 62.5%. Median, p10, p90, min and max are per game.
- `team_vs_opponent` is **not changed**: it keeps its own eight stats (the old list is still exported as `STATS`; the new one is `FORM_STATS`).
- Gates: "8 stats per group" is now `groups_without_15_stats`, the allowed stat names are 15, and the two recompute gates (last-10 and season mean) recompute all 15 stats from silver in plain SQL, with pooled means for the three percentages.

## Why
The Teams page (release 037, step 2) leads with offense: shooting percentages and turnovers are the offensive numbers `team_form` did not have.

## How to verify
- `.venv/bin/python -m pytest tests -q`: **99 passed** (98 before; 1 new test for pooled versus per-game percentages, empty-not-zero when there are no attempts, and the new raw stats; the stat count test is now 15).
- Local Spark found a real bug on the first run: a division by zero under strict (ANSI) mode, which Databricks also uses. The pooled mean now uses `try_divide`.
- New gate SQL run read-only against the real table (before the new rows exist): it parses and runs; the only gate that fires is `groups_without_15_stats` (85 groups, as expected: all still have 8), and the recompute gates are clean for the 8 old stats. The 7 new stats are checked by the gates after the job run.
- **Not done yet:** the real job run (the daily job builds it after merge, or I run it with your yes) and the corrupted-copy checks on the real output; I will add both to this note afterwards.

## Files changed
- `scripts/gold_team_form.py`: the seven new stats and pooled percentage means. `sql/gold/team_form_gates.sql`: gates for 15 stats. `tests/test_gold_team_form.py`: tests. `docs/NEXT.md`.

## Risks and things I am unsure about
- The MERGE on `team_form` will insert about 600 rows; the delete guard is not involved (nothing is deleted).
- Percentage windows over a short window (few games) are noisy; the page should show the game count.
- Teams with no three-point attempts in a game get an empty value for that game; very unlikely in real data.

## Review focus for Codex
(Only if the owner asks.) Pooled-mean definition against the gate's recompute; empty-not-zero handling.

## Owner walkthrough
- **What changed:** behind the scenes only; nothing on the page changes. The team table now also knows each team's shooting percentages, turnovers, offensive rebounds and shots attempted over its last 10 games and the season, ready for the Teams page.
- **One rule worth knowing:** a team's "FG%" average counts every shot (total made divided by total taken), so a big game weighs more than a small one, like the standings do.
- **What to check yourself:** nothing yet. After the next job run I will show you a team's numbers next to the real box scores.
