# Release 025: one Regular season / Playoffs toggle for the whole page, and clearer average labels

Date: 2026-11-13 (UTC)
Branch / PR: `feat/game-type-toggle` (PR number added after opening). **Includes PR #32's commits** (release 024, the team-palette chart); merging either first is fine.
Author: (Claude Code)

## What changed
- **One toggle on the page, "3. Games: Regular season / Playoffs"**, next to the Team and Player pickers. It drives everything: the six scorecards, the combined-stats table, the header text, the notes under the player's name and the season hexagon chart. The chart's own game-type switch is gone.
- **The server's form route takes a game type** (`/api/players/:id/form?type=regular-season|playoffs`, default regular season). Anything else is refused with a 400 before it reaches SQL. The query filters on exactly one game type through a parameter, so a regular-season figure is never blended with a playoff figure.
- **A player with no playoff games** gets a plain message ("... has no playoff games on record. Switch back to Regular season ...") instead of an error. The chart hides in that case.
- **All 30 teams stay in the Team picker in both modes** (checked: the list has 30; every team loads in playoffs mode, either a full page or the plain message).
- **Playoff notes are different from regular-season notes.** A playoff window is old by nature, so there is no "last played 150 days ago". Instead: "Playoff games only. {Name}'s latest playoff game on record was on {date} ({season} playoffs), so these games can reach back across earlier playoff runs."
- **Clearer labels for the two averages (your question):**
  - The big number on a scorecard now reads "avg of last 10 games · median 25.5" (it was "average · median").
  - The small figure top right now reads "2026-27 season avg 26.0" (it was "Season avg").
  - The combined table headers read "Last-10 average" and "Season average" (they were "Average" and "Season avg").
  - The chart says "season average" everywhere (it said "season mean"; same thing, one word now). The legend dot says "average of these games".
- **Team colour on the toggle:** the selected pills and the tooltip bubbles across the whole page now take the team's bright colour (before, only the chart's did; the rest were teal).

## Why
The owner asked what the difference is between "season avg" and "average", and for one toggle for playoffs versus regular season across the KPIs and the chart, before deploying.

## The difference between the two numbers (plain words)
- **Average** (the big number): the average of the player's **last 10 games** of the chosen type. It is recent form, and it moves every game.
- **Season average** (small, top right): the average of **every game this season** of the chosen type. It is the baseline.
- Example (Brunson, points, regular season): last-10 average 26.5, 2026-27 season average 26.0.
- In the playoffs mode the season average is blank: no playoff games have been played yet this season (the latest playoffs on record are 2025-26), so the cards show only the last-10 playoff games.
- The hexagon chart's "season average" is the average over all that player's games of that type in the season the chart shows (all teams together for a traded player).

## Decisions made without the owner (please confirm or change)
- The Team and Player pickers still show **this season's roster** in both modes (so every player is a regular-season player first). A player who has never been in the playoffs gets the plain message.
- In playoffs mode the scorecards show the **last 10 playoff games**, which can reach back across earlier playoff runs; the note says so.
- Play-in and NBA Cup are not on the page (the data has them).

## How to verify
- `cd app && npm test`: **66 passed** (56 before in this branch; 60 on the palette branch; 6 new here). New: the toggle options and sentence wording, the regular-season and playoff notes with hand-worked text (a 4-game window with 2 games from before the season and a 13-day absence; a playoff window that must not mention absence), the game-type validator (rejects `play-in`, `nba-cup`, `Playoffs`, a trailing space, an injected string, a number, a list), "the form query filters on one game type by a parameter and names neither type in its text", and an all-30-teams test (a name, a style and a palette for each; none falls back to teal).
- `npx tsc -b`, `npx oxlint`, `npm run build`: clean.
- Real data through the app's own server (read-only): Brunson regular season 26.5 points over 374 games (2026-10-23 to 2026-11-11, season average 26.0); Brunson playoffs 28.7 points over 79 games (2026-05-10 to 2026-06-13, 2025-26, no season average). These are identical to the numbers in release 019. Bad or injected `type`: 400. Unknown player: 404 for the regular season, `{"none":true}` for the playoffs. 30 teams listed.
- **Whole page in a simulated browser against that server (20 of 20; the script is not in the repo):** one toggle with two pills and no second one in the chart; 30 teams in the picker; regular-season wording and 82 hexagons; click Playoffs: "Last 10 playoff games played", the playoff note, no "days ago", the chart switches to 19 playoff hexagons with no empty slots; back to Regular season: everything returns; James Wiseman (no playoff games) in playoffs mode: the plain message, no error box, no chart, and switching back restores his page; every one of the 30 teams loads in playoffs mode without an error.
- **Not done:** nobody has seen it in a real browser, and it is not deployed.

## Files added or changed
- `app/server/queries.mjs`, `app/server/index.mjs`: the form query takes a game type; the validator; the route's new `type` parameter and its "no games" answer.
- `app/src/lib/gameType.ts` (new): the toggle's options, the sentence word, the notes under the name.
- `app/src/App.tsx`: the toggle, the game-type state, the form reload, the no-games message, the wording, the team-colour variables for selected buttons.
- `app/src/components/SeasonGrid.tsx`: takes the game type from the page; its own switch removed; wording.
- `app/src/components/Scorecard.tsx`, `CombosTable.tsx`: the clearer labels.
- `app/src/lib/hex.ts`: "season average" wording. `app/src/lib/styles.ts`: the shared button styles. `app/src/api.ts`, `app/src/types.ts`: the game type in the request and the "no games" answer.
- `app/tests/gameType.test.mjs` (new), `queries.test.mjs`, `hex.test.mjs`: tests.
- `docs/NEXT.md`: step 19.

## Risks and things I am unsure about
- **Not seen on a screen.** The toggle's place (next to the pickers) and size are my best guess.
- **A player's team in playoffs mode** is the player's current team, not necessarily the team he played the playoffs for (a player traded since will appear on his new team). The chart's team tabs show the real teams per grid.
- Switching the toggle reloads the player's form (a second or so while the warehouse answers; the cache keeps each answer five minutes per player and type).
- The page still lists only players who played this season; reaching other players is an open item.

## Review focus for Codex
- That no code path can request or return a blend of the two game types: the validator, the single `game_type = :gt` parameter, the cache key (`form:{id}:{type}`).
- `formNotices`: playoff notes never claim an absence.
- That the "no games" answer cannot be mistaken for an error by the page.

## Open questions for the owner
1. Is the toggle where you want it (next to Team and Player), and are the new labels clearer?
2. Should the pickers in playoffs mode list only players on teams from the latest playoffs, instead of this season's roster? (Today every team and player stays available, with a plain message where there are no playoff games.)
3. Deploy now (needs your "deploy")?

## Owner walkthrough
- **What you will see:** a third control next to Team and Player called "Games", with two buttons: Regular season and Playoffs. Click Playoffs and the whole page switches: the six cards show the player's last 10 playoff games, the table underneath does too, the heading says "playoff games", and the hexagon chart shows that player's most recent playoff run instead of the regular season. Click Regular season to go back. There is only this one toggle; the chart no longer has its own.
- **The two averages:** on each card, the big number is the average of his last 10 games ("avg of last 10 games"). The small text in the corner is his average over the whole season ("2026-27 season avg"). They are different on purpose: one is how he is playing right now, the other is his normal level. In the playoffs view the corner text is blank, because no playoff games have happened yet this season.
- **If a player has never played in the playoffs** you see a short message saying so, not an error. Pick another player or switch back.
- **Team colours:** the selected buttons and the little pop-up labels now use the team's colour everywhere, not only in the chart.
- **What each new or changed file does:** `gameType.ts` holds the toggle's two options and the sentences that change with it; `queries.mjs` and `index.mjs` now ask the database for exactly one game type at a time and refuse anything else; `App.tsx` holds the toggle and reloads the page's data when you click it.
- **What to check yourself:** after a deploy, open Jalen Brunson (Knicks): regular season shows 26.5 points average and "2026-27 season avg 26.0"; click Playoffs and it shows 28.7 and a note about the 2025-26 playoffs; the chart shows 19 hexagons. Then pick a bench player who never made the playoffs and click Playoffs: you should get the short message.
