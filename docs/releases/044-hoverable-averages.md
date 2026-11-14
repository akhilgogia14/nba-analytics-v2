# Release 044: the average lines on the sparklines are hoverable (and a bubble-format fix)

Date: 2026-11-14 (UTC)
Branch / PR: `feat/hoverable-averages` (PR number added after opening)
Author: (Claude Code)

## What changed
- **The two average lines can be hovered.** Hover (or keyboard-focus, or tap) the **dashed season-average line** or the **dotted league-average line** on a scorecard's sparkline and a bubble appears: "Season avg 110.3 / Average of this season's games" or "League avg 113.3 / League average per team game". The bubble follows the pointer along the line. Escape or a tap elsewhere closes it. The strips that catch the pointer are thin (about 10 pixels around each line) and sit on top of the game columns, so the line answers where it is and the game points answer everywhere else.
- **The card text is explained on hover too:** "season avg" and "league avg" in the top right of a card each show a short explanation (which line on the chart they are).
- This works on the Player page for the season line (there is no league line there) and on the Teams page for both lines.
- **A bug of mine fixed (found while doing this):** when I generalised the scorecard for the Teams page (release 041), the card's one-decimal number format also leaked into the sparkline's **game bubbles**, so on the **deployed** Player page a game bubble read "103.0 PTS" instead of "103 PTS" (confirmed on the deployed code before fixing), and on the Teams page counts read "111.0 PTS". The sparkline now has two separate formats: one for a game's value (whole numbers stay whole; percentages get one decimal and a % sign) and one for averages (one decimal). The big numbers on the cards are unchanged.

## Why
The owner asked: "make the avg hoverable as well". I read it as the average lines on the spark charts (the points were already hoverable). If the owner meant something else, say so.

## How to verify
- `cd app && npm test`: **135 passed** (133 before; 2 new: the line bubble's wording and format, and the game-bubble format for count and percentage cards). `npx tsc -b`, `npx oxlint`, `npm run build`: clean.
- **Sparkline in a simulated browser, 16 of 16** (a card built with team data, then a percentage card, then a player card): no bubble at rest; hovering the season line gives "Season avg 110.3" with its explanation and leaving removes it; the league line gives "League avg 113.3"; keyboard focus shows it and Escape closes it; a tap shows it and a tap elsewhere closes it; a game point still shows its own bubble with a whole number ("103 PTS · vs CLE"); a percentage card reads "League avg 45.8%" and a game bubble "42.0% FG% · vs CLE"; the card text has both hover explanations; the player card has no league line and no league text, only its season line is hoverable, and its game bubble reads "103 PTS" as it did before release 041.
- **Whole Teams page against the real tables, 34 of 34** (unchanged from release 043).
- **Not done:** not seen in a real browser. The pointer-following position uses the browser's own measurements, which the simulated browser cannot supply (it falls back to the middle), so how well the bubble tracks the pointer is for the owner's look.

## Files changed
- `app/src/components/Sparkline.tsx` (hit strips, one state for "point or line"), `Scorecard.tsx` (two formats, explanations on the header text), `app/src/lib/spark.ts` (`lineTip`), `app/src/lib/teamPage.ts` (`pointFormat`), `app/src/TeamsPage.tsx`; tests `app/tests/spark.test.mjs`, `teamPage.test.mjs`; `docs/NEXT.md`.

## Risks and things I am unsure about
- Where the dashed and dotted lines are within about 10 pixels of each other, the strips overlap and the one drawn last (league) wins; moving the pointer a little still reaches the other.
- A game point very close to an average line can be harder to hit than before, because the line's strip sits on top; the point's column is still reachable everywhere outside the strip.
- Touch screens: tap a line to see its bubble, tap elsewhere to close it (same as the points).

## Review focus for Codex
(Only if the owner asks.) The single "active" state in `Sparkline.tsx`; that the Player page output is identical apart from the fixed bubble format and the new season-line bubble.

## Open questions for the owner
None new (the two from release 043 stand).

## Owner walkthrough
- **What you will see:** move the mouse onto the dashed line (the team's or player's season average) or the dotted line (the league average) on any scorecard's small chart and a little bubble tells you what it is and its value. Previously only the game dots did that. On a phone, tap the line.
- **A fix you will notice on the Player page:** the bubble over a game dot now says "27 PTS", not "27.0 PTS". That was my mistake from the Teams page work; it was wrong on the live page for the last few hours.
- **What to check yourself:** on the Teams page hover each of the two lines on a few cards and check the bubble is easy to trigger and reads well in the team's colours.
