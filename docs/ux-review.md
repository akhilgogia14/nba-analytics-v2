# UX review: can an avid fan or a bettor get the answer quickly? (2026-11-20)

Status: findings for the owner's decision. Nothing has been changed in the app. Screenshots (laptop 1280 wide, true phone 390 wide with a phone user agent, real Knicks and Brunson data) are local only, not in the repo.

## Who it is for, and what each page should answer
Audience (owner): an avid NBA fan, and someone using the data to inform a bet, with AI predictions to come later. The owner's concern: "the idea is correct, but the execution is a miss". The numbers are there, but it is not built to be read quickly, and the pages are not tied together.

| Page | The question it should answer in 5 seconds |
|---|---|
| Today's games | Who plays, in what situation, and which game do I open? |
| Teams | Is this team good or bad on offense and defense, who do they give up points to (starters or bench, which positions), and how do they do against this opponent? |
| Players | How has this player played lately, and against this opponent? |
| Predictions | What should I expect from him in his next game, and how far off might it be? |

## What the owner has asked for so far (all in scope)
1. **Tie the pages into one flow:** Today's game, then a team with the opponent already set (last 10 meetings), then the roster underneath with last-10 averages, then a player, then his prediction.
2. **One universal opponent filter** held in the address and shared by every page. With it set, a player's cards show the average of the last 10 meetings, with the season average as subtext; the season hexagons light up games against that opponent in the team's color, and show future games against them as grey outlines.
3. **Advanced stats:** the league averages become small KPI tiles above each table, so the table holds only the team's (or player's) own numbers. "Too much info on the table at the moment."
4. **Today's games:** a clearer label for "3 in 4 nights" (it means the third game in four nights, tonight included); average points scored and allowed as subtext under each team; remove the Team button (the team name already links to the Teams page).
5. **Teams page summary** of the team's identity: good or bad at defense, scores a lot, and which positions they give up to or shut down.

## Evidence from the screens
Phone page heights (CSS pixels, 390 wide, Brunson and the Knicks): Today's games 2,262; Predictions 3,390; Teams 3,533; Players 4,283; Players Advanced 3,571; **Teams Advanced 4,791 (about six phone screens)**. No page scrolls sideways as a whole.

1. **Tables scroll sideways inside their frame, with no cue, and the useful columns are off-screen.** On a phone the Predictions table shows Stat, Baseline and a clipped Typical miss; Min, Avg and Max need a sideways swipe. The Defense grid on a phone shows the position and the player-game count; the actual numbers are off-screen.
2. **Explanation comes before data.** Predictions has 6 bullets (about 14 lines on a laptop) before the table; Teams Advanced 4; Players Advanced 5; the Defense panel 6. They restate column definitions that a short tooltip or a one-line header could carry.
3. **The answer is not stated.** Predictions shows 11 numeric columns per stat and 7 charts that repeat them, but never "about 28 points, usually 22 to 34".
4. **Advanced tables mix a steady number with a noisy one, side by side.** Six columns: three league (large samples) and three team (often 2 to 7 games), with the noisy team difference in bold. Examples on screen: points allowed "-26.0" from 3 games; back-to-back "+20.5" from 2 games. The player version's league columns are +0.05 and -0.05, with the page's own note saying effects are "well under one point".
5. **The Defense grid is 16 rows by 9 columns.** Most rows are tagged "few". Empty rows ("Not listed", 0 games) still show a "-4.5" difference against the league. It does not answer "which positions does this team shut down?" at a glance, and the stability check says the position-specific part mostly does not repeat, so it should say how good the defense is first.
6. **Slop in the copy.** "The weights are my choice" and "our earlier back-test" read as a developer's notes, not product copy. Decimals are inconsistent (27.9 next to 3.23 next to ±1.16).
7. **The opponent control hides at the bottom.** On Players the "Against an opponent" picker sits below the hexagons, past the cards; Teams the same. Nothing on Today's games carries the opponent into those pages.
8. **Today's games** is the cleanest page. Chips need a clearer label ("3 in 4 nights"; "Road trip · game 4" is cryptic), the Team and Players buttons repeat on both teams of every card, and no tip-off time or team scoring is shown (whether the source has tip-off times is not checked).
9. **What works and should be kept:** the Overview cards (big number, sparkline, range, vs season), the "next game" strip with situation chips, the season hexagons, the dark layout and consistent navigation. These are the pattern to extend, not replace.

## Element inventory (verdicts: Keep, Shorten, Move, Cut, New)
### Today's games
| Element | Answers | Verdict |
|---|---|---|
| Day picker, regular season or playoffs | Which day | Keep |
| Team name and logo | Who | Keep; becomes the link to the Teams page (matchup mode) |
| "Team" button, per team | Open the team | **Cut** (name already links) |
| "Players" button, per team | See his players | Keep, or send to the roster flow |
| Chips: back-to-back, "3 in 4 nights", "4 in 6 nights", "Road trip · game N", rested | Is the team tired or fresh | **Shorten and clarify** ("3rd game in 4 nights", tooltip) |
| "Not played yet", score | Status | Keep (add tip-off time if the source has it) |
| Avg points scored, allowed | Is this team good on offense and defense | **New** (season avg, last 10 smaller; owner to choose) |

### Teams: Overview
| Element | Answers | Verdict |
|---|---|---|
| Team and games pickers, Averages or Box scores toggle | Which team, which view | Keep |
| Six cards (points, FG%, 3PM, 3P%, assists, turnovers): last-10 average, vs season, sparkline, range | How is the offense recently | **Keep**; add defense (points allowed) so a team is good or bad at both ends |
| Legend row, note | How to read the range | Shorten (tooltip or one line) |
| "Against an opponent" picker, meetings table | How do they do against X | **Move** to the top as the universal opponent filter |
| Roster with last-10 averages | Who are the players | **New** |
| Team summary line (defense, scoring, who they give up to) | Good or bad? | **New** |

### Teams: Advanced stats
| Element | Answers | Verdict |
|---|---|---|
| "Next game" strip | The situation tonight | Keep |
| "How to read this" (4 bullets) | Column meaning | **Shorten** to one line plus tooltips |
| Four tables (home or away, back-to-back, 2+ days, more or less rested): league A, league B, league difference, team A, team B, team difference | Does the situation matter | **Rework:** league figures become KPI tiles above each table; table shows only the team's two numbers and the difference; show "too few games" instead of bold numbers from 2 to 3 games |
| Defense by position (16 rows, 9 columns, 6 bullets) | Who do they give up points to | **Rework:** one summary line (overall defense rank), then a compact grid (positions by role, one stat at a time, bars, "few" rows hidden behind a toggle); empty rows removed |

### Players: Overview
| Element | Answers | Verdict |
|---|---|---|
| Team, player, games pickers | Which player | Keep |
| Six cards with sparkline, range and share strip | How has he played lately | **Keep**; with the opponent set, the big number is the last-10-meetings average and the subtext the season average |
| Season hexagons | His whole season at a glance | Keep; light up games against the chosen opponent (team color) and grey outline the future ones |
| "Against an opponent" picker and meetings | How against X | **Move** up as the universal filter |
| Combined stats (PRA and the rest) | Combined lines | Keep (lower on the page) |

### Players: Advanced stats
| Element | Answers | Verdict |
|---|---|---|
| "Next game" strip, 5 bullets | Situation tonight, how to read | Keep strip; **shorten** bullets |
| Tables: league (+0.05, -0.05) and player (7 games) | Does the situation change him | **Rework** as for Teams: league effects as KPI tiles; table shows only his numbers, with a minimum-games rule |

### Predictions
| Element | Answers | Verdict |
|---|---|---|
| Team, player pickers; next-game strip | Who and when | Keep (pre-filled from the flow) |
| (missing) | What to expect | **New:** a headline per stat above everything ("Points 27.9, usually 22 to 34, typical miss ±5.9") |
| "How to read this" (6 bullets) | Definitions | **Cut to one line plus tooltips**; remove first-person wording |
| Table: baseline, typical miss, min, avg, max by three views (11 columns) | The detail | **Move down or behind a toggle**; default to baseline and range |
| Seven charts repeating the table | Spread of games | Keep one form, not both by default |

## Flow map: today versus wanted
Today: Today's games card, then "Team" (team only) or "Players" (team only), then pick the player yourself, then pick the opponent yourself on each page, then open Predictions and pick the player again.
Wanted: Today's game, then a Team page with the opponent already set and the roster under it, then a player (opponent still set), then "See prediction" (same player and opponent). Breadcrumb back the same way. The address already carries team and player; the opponent is the missing piece, plus one roster query on data we already have (no new table).

## Ranked changes (worst first, effort S/M/L)
1. **Carry the opponent in the address; wire the game card, matchup strip and hand-off links** (M).
2. **Roster with last-10 averages on the team page** (M).
3. **Predictions: headline answer first; shorten or cut the explanation; hide the 11-column detail by default** (M).
4. **Advanced tables: KPI tiles for the league, own-numbers-only tables, "too few games" rule** (M).
5. **Phone: make sideways tables show a cue and keep the key columns visible; Defense grid redesign** (M to L).
6. **Today's games: chip labels, remove Team button, scoring subtext** (S).
7. **Universal opponent filter on the player cards and hexagons (colors, future games)** (L; needs team colors and a check of how far ahead the schedule goes).
8. **Copy pass: remove first-person text, one number format per stat** (S).

## Open decisions for the owner
1. One team at a time from a game card (with a switch to the other), or both rosters side by side? (Default: one at a time.)
2. Roster on the Teams Overview page, or its own tab? (Default: Teams Overview.)
3. Today's scoring subtext: season average, last 10, or season with last 10 smaller? (Default: season with last 10 smaller.)
4. Players button on Today's games: keep, or send to the roster flow? (Default: the roster flow.)
5. Regular season first; playoffs stay on the toggle. OK?
6. Which change first? (Suggested: 6 and 8 as a quick PR, then 1 and 2, then 3 and 4.)

## Not covered
No users were watched, so these are an expert's review against the owner's goal, not measured behavior. A 5-second test with 3 to 5 people would check the headline answer on Predictions and the team summary. Tip-off time availability, team colors and how far ahead the stored schedule goes are not checked yet.
