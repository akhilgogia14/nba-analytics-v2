# Release 028: a basketball-court background and card transitions

Date: 2026-11-13 (UTC)
Branch / PR: `feat/animations` (PR number added after opening)
Author: (Claude Code)

## What changed
- **Background:** faint half-court lines (key, free-throw circle, three-point arc, basket, half-court arc) in the selected team's accent colour, at 11% opacity, fixed behind the page. They draw themselves in when the page opens and again when the team changes, then drift very slowly.
- **Transitions:** when a player or the Regular season / Playoffs toggle changes, the player header, the six cards, the legend, the season chart and the table float up and fade in one after another (about half a second each, small delays between them).
- **Sparklines:** each line draws left to right, then its fill fades in.
- **Reduced motion:** everything is switched off for visitors whose device asks for it; the court lines then just show, fully drawn.

## Why
The owner asked for a simple, elegant basketball-themed background and transition animations. An earlier idea (an animated player figure) was tried as a preview and dropped by the owner; nothing from it is in the repo.

## How to verify
- `cd app && npm test`: 80 passed (no new tests; animation is not something these tests can see). `npx tsc -b` and `npx oxlint`: clean. `npm run build`: builds.
- Ran locally against the real data and opened in the owner's browser; the owner looked and liked it.
- **Not done:** no automated check of the motion itself, and not deployed.

## Files added or changed
- `app/src/components/CourtBackground.tsx` (new): the court drawing.
- `app/src/index.css`: the motion rules and the reduced-motion switch-off.
- `app/src/App.tsx`: adds the court (re-drawn when the team changes) and groups the player's sections so they animate in on a new player or game type.
- `app/src/components/Sparkline.tsx`: two class names so the line and fill can animate.

## Risks and things I am unsure about
- The court lines are decoration at low opacity; on a very bright screen they may be harder to see, on a dim one more visible. One number (`opacity-[0.11]`) controls it.
- The page remounts the player's sections on each new player or game type, so a card's open tooltip closes at that moment (intended).

## Later
- An optional ball arcing across the court now and then was proposed and left out.

## Review focus for Codex
- The `stagger` / `cards` rules in `index.css` against the elements in `App.tsx`; the reduced-motion block covers every animation added.

## Open questions for the owner
1. Is the court too faint or too strong, and the speed right?

## Owner walkthrough
- **What you will see:** a very faint basketball half-court behind the whole page, in the team's colour. When you open the page, or pick another team, its lines draw themselves in one by one; afterwards it drifts a tiny bit, so the page feels alive without distracting.
- **When you pick a new player:** the name, the six cards, the chart and the table slide up and fade in one after another instead of snapping into place. The little lines under each number draw themselves from left to right.
- **If your computer is set to reduce motion:** none of this moves. You just see the court lines and the page, still.
- **What each file does:** `CourtBackground.tsx` draws the court lines; `index.css` holds the timing of every animation (and the off switch); `App.tsx` places the court behind the page and groups the sections so they animate on a new player; `Sparkline.tsx` just tags the line so it can draw itself.
