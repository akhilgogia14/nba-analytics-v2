# Advanced stats: do the effects and the "own split" findings survive adjusting for home/away and opponent? (2026-11-17)

Follow-up to `docs/advanced-stats-stability.md` (teams) and `docs/players-advanced-stability.md` (players). Both compared games as played, so a back-to-back effect could really be a home/away or opponent-strength effect. This check removes both and repeats the two questions: is the league effect still there, and does a team's or player's own split repeat?

## Method
- Same data as before: regular season 2021-22 to 2025-26, gold `team_game_log` / `player_season_games` joined to `game_context` (read-only, nothing written). 12,150 team-games with a known rest; 124,176 played player-games in 2,225 player-seasons with 20+ games played.
- **Teams:** the outcome is scoring margin. Opponent strength is taken out by subtracting what the two teams' own season margins predict (team rating minus opponent rating). Then one regression holds home/away, back-to-back, 2+ days (baseline: 1 day of rest) and rest edge more/less rested (baseline: even) at the same time.
- **Players:** each played game's stat minus the player's own season average (as in release 061). The same regression, plus a term for the opponent (how far games against that team in that season run above or below players' own averages).
- **Stability:** a team's or player's own split is recomputed on the adjusted numbers (home edge and opponent removed) and correlated across seasons as before: first vs second half, odd vs even games, season vs next.

## 1) Teams: the league effects mostly survive, the back-to-back one shrinks
Margin, as played vs adjusted (z in brackets). The adjusted column is what one situation is worth with the others held fixed.

| Situation | As played (plain margin, one at a time) | Adjusted (ratings, and all situations in one model) |
|---|---|---|
| Home vs away | +3.9 (z 14) | **+3.8 (z 13.5)** |
| Back-to-back vs 1 day of rest | -2.3 (z -6.0) | **-1.5 to -1.6 (z -3.4 to -4.2)** |
| 2+ days vs 1 day | +0.5 (z 1.3) | -0.5 to -0.6 (z -1.4), not distinguishable from zero |
| More rested than the opponent vs even | +1.6 (z 4.6) | **+1.5 (z 3.8 to 4.0)** |
| Less rested than the opponent vs even | -1.6 (z -4.6) | -0.6 to -0.7 (z -1.7 to -1.8), weak |

Reading it: home is about 3.8 points whichever way it is measured. A back-to-back costs about **1.5 to 1.6 points once everything else is held fixed**, not the 2.4 seen as played: roughly a third of the as-played gap was home/away and opponent mix. A rest advantage over the opponent is worth about 1.5 points, and the disadvantage mostly turns out to be the back-to-back itself (a team that is less rested than its opponent is usually on a back-to-back), so it should not be added on top. More than one day of rest, by itself, shows nothing.

## 2) Teams: a team's own split still does not repeat
After adjusting, the 12 correlations (4 contexts x 3 methods, 120 to 150 team-seasons each) run from -0.11 to +0.24. Same pattern as before: the two biggest are back-to-back margin, season to next season (+0.24; was +0.22 as played), and home margin, first half vs second half (+0.19; was +0.10). With about 150 pairs one standard error is about 0.08, so these are 2.3 to 2.9 standard errors, and 12 numbers were looked at (24 in the earlier check). Everything else is within -0.11 to +0.14, around zero. Not strong enough to call a team trait; the earlier advice (context, muted, 8 games minimum) stands. If anything, the back-to-back one is the only candidate worth re-checking when another season arrives.

## 3) Players: the league effects do not change
Adjusting for home, the other rest terms and the opponent leaves the player effects the same to within 0.02 on every stat. Back-to-back vs 1 day: points +0.28 as played, +0.29 adjusted; rebounds +0.08 / +0.10; minutes was the largest in the earlier note and is unchanged at about +0.7. The two "rest edge" lines that looked like small effects as played (points -0.07 and +0.11) shrink to about zero (+0.02, -0.02) once the back-to-back is held fixed. So on a player's stats the positive back-to-back effect is not a home/away or opponent artefact; the earlier selection explanation (players on the second night are the healthy, in-rotation ones) is still my guess, not shown.
- The opponent term comes out at exactly 1.00. That is built in (the opponent effect is computed from the same games), not a finding, and the opponent differences are small (a team's allowed levels barely move a player's stat relative to his own average), so adjusting for them changes almost nothing.

## 4) Players: a player's own split still does not repeat
Per stat, the mean correlation across the 12 values (4 contexts x 3 methods; 1,281 to 2,215 player-seasons) is +0.01 to +0.03 both as played and adjusted, and the highest value for any stat is +0.13 (minutes, back-to-back, season to next season; +0.14 as played). Adjusting changes no conclusion. Availability on back-to-backs (the one personal signal, r +0.20 to +0.25) was not recomputed here because it is a count of games played, which this adjustment does not touch.

## What this means for the design
1. **Say the back-to-back effect for teams as "about 1.5 points", not 2.4,** wherever the app or notes quote it. The Teams Advanced tab shows the as-played league figure per bucket; its note does not give a number, so the only change is to keep this in mind when we add a forecast input.
2. **Do not stack the rest-edge and back-to-back effects for teams.** They overlap; use one back-to-back term plus home, with rest edge only as a description.
3. **Nothing changes for players or for the own-split columns.** The player effects are not artefacts of home/away or the opponent, and a player's or team's own split still should not be treated as a trait.
4. **Forecast input candidates (for the modeling work, `docs/MODELING.md`):** home (+3.8 margin), back-to-back (-1.5 margin), and for players the small back-to-back minutes bump and availability on the second night. All still need a back-test.

## Not covered
- Playoffs; role or minutes splits; defense-by-position (the grid in `docs/NEXT.md` item 30b).
- A stricter version that matches games within the same opponent or uses preseason ratings (the season rating here includes the games being studied, which, if anything, shrinks the effects slightly).
- Why the player back-to-back effect is positive.
- The three scripts behind the stability notes are in `scripts/analysis/` (README there says how to re-run them).
