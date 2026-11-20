# Release 077: Advanced stats: league tiles, own numbers only

Date: 2026-11-20
Branch / PR: feat/advanced-kpi-tiles
Author: (Claude Code)

## What changed (UX plan: Advanced stats)
- **Teams and Players Advanced tabs:** each of the four panels (home vs away, back-to-back vs rested, 2+ days vs 1 day, more vs less rested than the opponent) now opens with small **league tiles** ("Points scored +1.9", ...), the league pattern for quick reference. The three league columns left the table.
- **The table keeps only this team's (or player's) own numbers:** Stat, first situation (n), second situation (n), Diff: four columns, which fit a phone with no sideways scroll.
- **Too-few-games rule:** the own table shows only when each side has at least **5 games**. Otherwise the panel says "Too few games to compare: Back-to-back 2, 1+ day rest 11. It needs at least 5 on each side." Players keep a line "played 2 of 2 team games" for each situation either way. This **replaces the earlier rule of 1 game (your choice on 2026-11-16)**; the new value (5) was your choice on 2026-11-20 and is one constant (`MIN_TEAM_GAMES` in `app/src/lib/context.ts`).
- The panel that applies to the next game moves to the top. The four explanation bullets are now a "How to read this" fold-out (no first person); one visible line keeps the caveat that a split in one half of a season did not predict the other half.
- Files: `app/src/components/KpiTiles.tsx` (new), `app/src/TeamsAdvancedPage.tsx`, `app/src/PlayersAdvancedPage.tsx`, `app/src/lib/context.ts` (`MIN_TEAM_GAMES`=5, `enoughGames`, `tooFewText`, `orderComparisons`), tests in `context.test.mjs`. No server or number changes.

## How to retract
Everything is in this one pull request. On GitHub, click **Revert** on the merged PR (merging that deploys the old tabs), or ask Claude to `git revert` the merge commit. To keep the new layout but change the threshold, change the one constant instead.

## How to verify
- tsc, oxlint, build clean; 226 tests pass (the old "1 game is enough" test now says 5; new tests for the too-few rule, its text and the panel order).
- Real data, Charlotte (Teams, simulated browser): four panels; next-game panels first; every league points tile equals the served league difference (+1.9, -1.2, +0.9, +1.6); the own table appears only with 5+ games on each side (home 7 vs 7: table; back-to-back 2 vs 11, rest 3 vs 8, edge 4 vs 1: too-few line); no league columns anywhere; fold-out closed. 12 checks pass.
- Phone screenshots of both tabs looked at; I found and fixed one real problem there (the Difference column was cut off); page height Teams Advanced 4,821 (was 4,791, a few tiles added), Players Advanced 3,859 (was 3,571).

## Risks
- Early in a season most panels show "Too few games". That is the honest answer, but the tab will look emptier until games pile up.
- Pages got a little longer, not shorter, because the tiles add a row; the sideways scrolling in tables is gone.
- The Defense grid on the Teams tab is unchanged (its redesign is the next step).

## Owner walkthrough
Open Teams, then Advanced stats. Each panel starts with a row of small tiles: how that situation changes things across the whole league (for example, home teams score 1.9 more points). Below it is this team's own record in that situation, only if there are at least 5 games on each side; if not, a plain sentence says there are too few games. The panel that matches the team's next game is first and tagged. The Players tab works the same way, with a line showing how many of his team's games he played in each situation.
