# Release 001: source spike

Date: 2026-11-05
Branch / PR: `spike/001-source-spike` (pull request link is on the PR itself)
Author: (Claude Code)

## What changed
- Confirmed the data source: `sportsdataverse/sportsdataverse-data` releases (not `hoopR-nba-stats-data` as `PLAN.md` said). Files are one parquet per season per dataset.
- Confirmed season labels are END years (`_2022` = the 2021-22 season) and that the source is fresh (games through 2026-11-04, files updated 2026-11-05).
- Checked data quality on the four core tables: keys, "did not play" rows, and why `player_game_logs` is much smaller than the box scores. Checked the injury report (it is published, contrary to `PLAN.md`).
- Read both license texts (MIT and CC BY 4.0, so we must give credit).
- Edited `PLAN.md`: fixed the source repo name and replaced the "Wording" paragraph with the positioning rule from `CLAUDE.md`.
- Added `docs/spike-findings.md` (all facts and the rules for later steps) and this note. No code, no data files, nothing written to R2 or Databricks.

## Why
`PLAN.md` section 5 listed things that had to be verified before landing any data. This answers items 1 to 4 (file list and latest date, season labels, schemas and keys, license). Items 5 and 6 (Databricks reading R2, fallback source) are still open.

## How to verify
All checks were read-only. The scripts live in the scratchpad (outside the repo) and are not committed; the numbers can be re-created from the download URLs in `docs/spike-findings.md`. Real output, trimmed:

- File lists: `gh api repos/sportsdataverse/sportsdataverse-data/releases/tags/<tag>` for five tags. The 2027 files show `updated_at` of 2026-11-05 (injury report and box scores) and 2026-11-03 (schedule).
- Download: 24 core files (4 tables x seasons 2022 to 2027), 4.0 MB; 6 injury report files, about 3.7 MB.
- Key check (every table-season), result: `bad_key=0 dup_rows=0` everywhere except `team_boxscores` 2027, `bad_key=2 dup_rows=2` (the NBA Cup final placeholder, game `0062600001`, `team_id = 0`).
- Game logs vs team box scores, 2025: `{'both': 2628, 'right_only': 14, 'left_only': 0}`, points equal in matched rows: `1.0`; player points sum to team points: `1.0 over 2642 team-games`.
- "Did not play": 32,519 of 176,232 rows have a note and zero or empty minutes; 7 rows break the pattern (6 stale DNP notes in 2027 with real minutes, 1 other).
- `git` and `PLAN.md`: diff shows two line edits in `PLAN.md` and two new files in `docs/`.

## Files added or changed
- `PLAN.md`: source repo name corrected; "Wording" paragraph replaced with the positioning rule.
- `docs/spike-findings.md`: everything learned, plus 7 rules for later steps and a list of what is not verified.
- `docs/releases/001-source-spike.md`: this note.
- `CLAUDE.md`, `docs/NEXT.md`, `docs/LEARNING.md`, `docs/MODELING.md`, `docs/releases/TEMPLATE.md`, `docs/reviews/TEMPLATE.md`: the bootstrap files, committed for the first time in this pull request (they were untracked).

## Risks and things I am unsure about
- I only looked at summaries (counts, dates, value counts, a few sample rows). I have not read actual rows in depth, so there may be oddities I have not seen.
- The `season_type_id` meaning ('2' regular, '4' playoffs, '5' play-in, '6' Cup final) is inferred from counts, not from documentation.
- "Played" is defined as minutes greater than 0. Edge cases (a player who played under a minute, rounding) are not studied.
- The 6 stale "DNP" notes with real minutes are unexplained; if more of these exist in older seasons they could mislead anything that relies on `comment`.
- The injury report's player link rate (`person_id` empty) is unmeasured.
- Source freshness rests on one day's evidence. The maintainer runs the scraper on his own server; a stall is possible.
- License: not legal advice. Underlying NBA data terms were not researched.
- `PLAN.md` section 5 still says the injury report is "not published yet". I did not change that (outside the step list).

## Review focus for Codex
- Are the key checks in `docs/spike-findings.md` section 5 convincing, and is anything claimed that the outputs above do not support?
- Is the "did not play" rule (section 6 and rule 2) sound, given the stale-note rows?
- Is the license reading right (MIT for `sportsdataverse-data`, CC BY 4.0 in `LICENSE.md` of `hoopR-nba-stats-data`)?
- Is `PLAN.md` now consistent with `CLAUDE.md` on wording, and are there other places in the docs that still say "no betting framing"?
- Any place where a number in the findings does not match the table.

## Open questions for the owner
1. `PLAN.md` section 5 says the injury report is not published; it is. Should I correct that line in the next pull request?
2. Land core tables first (default in `PLAN.md`) and leave the heavy files (shots, play-by-play) for later?
3. Is CC BY 4.0 attribution (README plus app footer) acceptable for the portfolio?

## Owner walkthrough
- **What I did:** I looked through the free NBA data source without keeping any of it. I listed its files, downloaded a few small ones to a throwaway folder outside the project, and measured them. Nothing was uploaded and nothing was changed anywhere online.
- **What I learned:** The data is real and current: it includes games from last night. Each season's file is named after the year the season ENDS, so "2022" means the 2021-22 season. The player-by-player box scores are the file we need for player forecasts. A file called "player game logs" turned out to be team totals, so we will not use it for players.
- **Gotchas:** players who sit out still show up as rows, with zeros everywhere, and the "played" decision should come from minutes, not the note next to the name. There is one game (the NBA Cup final in December) that is only a placeholder. Both are noted so we handle them when cleaning the data.
- **License:** the data is free to use, even commercially, but we must credit the source. We will do that in the README and the app footer.
- **What the new files mean:** `docs/spike-findings.md` is the fact sheet; this release note is the summary for the reviewer; the small edit to `PLAN.md` fixes the source name and the wording rule. The other files in the pull request are your earlier planning documents, saved into the project for the first time.
- **What to check yourself:** skim `docs/spike-findings.md` section 9 (the rules); answer the three questions above.
