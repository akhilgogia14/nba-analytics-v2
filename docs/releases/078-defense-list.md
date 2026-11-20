# Release 078: Defense by position as a ranked list

Date: 2026-11-20
Branch / PR: feat/defense-list
Author: (Claude Code)

## What changed (UX plan: Defense grid)
- **Headline tiles first** (per the stat switch): the opposing players' total per game against this team, the league average, and the difference. It is the groups added together, the part our stability test found repeats.
- **"Who they give up to" list:** one row per group with at least 10 opposing player-games: name, per-game figure (league figure beside it) and a bar from the league level, right when the team gives up more, left when less, with the signed difference. Sorted from most given up to least. No sideways scrolling.
- **Small groups** (under 10 opposing player-games, or empty) are in a closed fold-out ("Show 12 small groups"), so an empty group never shows a difference.
- **The full 9-column table is in a closed "All the numbers" fold-out**, unchanged, with the explanation bullets (first-person "my choice" reworded). One visible line keeps the finding that overall defense repeats but position-specific parts mostly do not.
- Files: `app/src/components/DefenseGrid.tsx`, `app/src/lib/defense.ts` (`defenseTotals`, `listRows`, `barShare`), `app/tests/defense.test.mjs`. No server or number changes.

## How to retract
One self-contained PR: click **Revert** on the merged PR (merging that deploys the old grid), or ask Claude to `git revert` the merge commit.

## How to verify
- tsc, oxlint, build clean; 229 tests pass (three new: totals add the groups, ordering and what is kept out of the list, bar lengths).
- Real data (Charlotte, 14 games, simulated browser): the headline "opposing points per game" is 110.4, equal to the team's points allowed from the team game log (independent calculation); league 113.8 equals the league's points per team game from the same table; difference -3.4; list sorted; small groups closed; full 9-column table still present. 7 checks pass.
- Phone and laptop screenshots looked at; two phone layout fixes made (difference beside the name; wider league text on laptop). Phone page height: 4,066 (was 4,821).

## Risks
- With only 14 games, just 4 of 16 groups clear the 10-player-game bar, so most of the list is in the fold-out. It fills in as the season goes on. Starting centers, the candidate flagged in release 071, are in the fold-out for now (8 player-games for Charlotte).
- The 10-player-game bar is a plain choice, not tested.
- Per-game figures mix minutes with how well the group scored; per 36 is in the full table.

## Owner walkthrough
Open Teams, Advanced stats, and scroll to "Defense by position". At the top are three small tiles: how many points opposing players score against this team in a game, the league average, and the gap. Below is a list of the positions that have played enough games against the team, with the one this team gives up the most to at the top. A bar to the right means the team gives up more than usual to that group; a bar to the left means it holds them below the league. Groups with only a few games are in a fold-out, and the original wide table is under "All the numbers".
