# Release 071: Does defense by position repeat? (check and panel wording)

Date: 2026-11-20
Branch / PR: feat/defense-stability
Author: (Claude Code)

## What changed
- New read-only check `scripts/analysis/defense_stability.py` and write-up `docs/defense-stability.md` (README and NEXT updated).
- The Defense panel's "Few" bullet no longer says repeating is untested; a new "Does it repeat?" bullet gives the finding in plain words. No numbers or queries change.

## Finding
A team's defense repeats as a team-wide level (r about +0.2 to +0.3 across half-seasons and seasons); what is particular to a position group mostly does not (about 0 to +0.17; blocks the exception at about +0.17). Only 7 of 16 groups could be tested.

## How to verify
- Script run on real data (81,232 group-game rows), output summarised in the doc; `npx tsc -b`, `npx oxlint`, `npm test`, `npm run build` (see PR).
- The panel text is not seen as pixels.

## Risks
- About 150 team-seasons per group (SE about 0.08), 7 groups x 6 stats x 3 tests looked at: single high values are not claimed. Groups with few games (about 25 team-seasons for bench G-F) are weak.
- It tests repeat, not usefulness for forecasts.

## Owner walkthrough
On Teams > Advanced stats, the Defense panel's notes now include "Does it repeat?". In plain terms: a team that gives up a lot overall tends to keep doing so, so the Difference column mostly tells you how good the defense is. A team being especially weak to one position mostly does not carry over from one stretch to the next, so treat a single position row as "what has happened so far". The new files are the analysis script and its write-up; nothing else on the page changed.
