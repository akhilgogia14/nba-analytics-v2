# Release 083: "How this team stacks up" on the Teams page

Date: 2026-11-20
Branch / PR: feat/team-summary
Author: (Claude Code)

## What changed (UX plan: Teams page identity summary)
- **A new card under the team's name on Teams, Overview:** "How Charlotte Hornets stacks up". It shows, for the season so far and per game:
  - **Record** (W-L over the games played) and three tiles with a rank among all the teams: **points scored**, **points allowed**, **scoring margin** (for example 100.1, "30th of 30").
  - **One verdict line** in plain words: "Offense: weak (30th of 30 in points scored). Defense: strong (8th of 30 in points allowed)." Strong is the top third of the teams, weak the bottom third, the rest "in the middle". With fewer than six teams ranked (an early playoffs, say) no verdict is given.
  - **Strongest at / Weakest at:** up to two stats each from field goal %, 3-pointers made, assists, rebounds, turnovers (fewer is better), steals and blocks, where the team is in the top or bottom third.
  - **Positions it gives up points to:** the biggest "gives up more than the league" and "holds below the league" groups from the Defense grid's own ranked list (same 10-player-game bar, so the two pages cannot disagree), with a link to Advanced stats.
  - A note when the team has played under 20 games ("ranks can move a lot this early").
- **Click to explore:** clicking a tile, or a strength or weakness chip, opens the full ranking of all the teams for that stat, best first, with this team highlighted; each team name links to its own page. One list is open at a time.
- **Server:** one new read-only route, `GET /api/league/team-ranking?type=` (`RANKING_SQL`, `mapRanking` in `app/server/teamQueries.mjs`). It reads `team_game_log` only (the newest season of the game type, one row per team id, pooled FG%) and returns each team's per-game figures; ranks are worked out in the browser (`app/src/lib/teamSummary.ts`). No new table, grant or data change. If the route fails the card is simply left out; if the defense route fails the card has no positions line.
- Files: `app/server/teamQueries.mjs`, `app/server/index.mjs`, `app/src/api.ts`, `app/src/types.ts`, `app/src/lib/teamSummary.ts`, `app/src/components/TeamSummary.tsx`, `app/src/TeamsPage.tsx`, `app/tests/teamSummary.test.mjs`.

## How to retract
One self-contained PR: click **Revert** on the merged PR, or ask Claude to `git revert` the merge commit. The Teams page goes back to the scorecards straight under the team's name.

## How to verify
- tsc, oxlint, build clean; 258 tests pass (eight new: the ranking SQL, the row mapper, ranks with ties and lower-is-better stats, the thirds rule, the verdict sentence, strengths and weaknesses, number formats, the defense summary).
- Real data, checked against an independent SQL that ranks the teams with window functions: Charlotte 14 games, 4 wins, 100.14 points (30th), 110.43 allowed (8th), margin -10.29 (27th), turnovers 30th; New York and Oklahoma City also match (points 25th and 19th, allowed 2nd and 5th, margin 7th and 10th). 110.43 also equals the 110.4 "opposing points per game" headline on the Defense grid.
- Simulated browser, 13 checks pass: the title and subtitle; record; the three ranked tiles; the verdict; two weakest stats (three teams-stats are tied at 30th and two are shown); the defense line with the link; the early-season note; nothing open at first; the points-allowed list has 30 teams in order, Boston first (103.3) and Charlotte 8th highlighted; names link to team pages; opening another tile replaces the list; switching to Playoffs leaves no stale regular-season card.
- Phone and laptop screenshots looked at; one wording fix after looking ("5.6 points a game above the league").

## Risks
- Ranks are per game over the season so far, so early on they move a lot (the card says so under 20 games). A strong or weak label is a plain third of the league, not a tested threshold.
- Ties share a rank (a team can be 30th with two others); the card shows two strengths or weaknesses at most, so a third tied stat is not shown.
- Playoffs: ranks are among the teams that have played a playoff game this season, so "of 16" or fewer; a team that has not is not ranked and the card is left out.

## Owner walkthrough
Open Teams and pick a team. Under the team's name there is a new card, "How [team] stacks up". The tiles show the record and how many points the team scores and allows per game, each with its place among all the teams. The sentence below says in plain words whether the offense and defense are strong, in the middle or weak. The chips name what the team is best and worst at. The last lines say which kinds of players score the most against this team and link to the Defense by position grid. Click any of the figures or chips and a list of every team opens with this team highlighted, so you can see who sits above and below it.
