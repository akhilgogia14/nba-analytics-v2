# Release 021: one dark theme with a team-colour spotlight

Date: 2026-11-13 (UTC)
Branch / PR: `feat/dark-spotlight`, PR (number added after opening)
Author: (Claude Code)

## What changed
- **One theme.** The Theme buttons and the other three themes (Paper, Graphite, Aurora) are gone, together with the saved-theme code. The page is one dark theme: Midnight's cards, fonts and teal accent over a plain near-black background (`#070A12`); Midnight's built-in teal and purple glows were removed.
- **Team spotlight.** Choosing a team lights the page like a stage light from the top-middle: a wide cone in the team's primary colour, a soft glow where the light starts, and a thin brighter core down the centre line in the team's secondary colour. The light stays fixed on screen while the page scrolls (a separate layer behind the page content, so it also works on phones, and the see-through cards let it show through).
- The median mark, the middle-80% band, the whisker and the accent text follow the team as before. A team colour that cannot be read on near-black falls back to the secondary colour (the Knicks' blue becomes their orange), and white or silver teams use their own.
- The brightness is lowered for teams that cannot take it, per team, so text stays readable: full strength for 27 of 30 teams, the weakest 0.25 instead of 0.32 (light colours such as the Spurs' silver).
- No data, table or grant changed.

## Why
The owner's request: dark mode only, no theme selection, and a spotlight down the middle in the selected team's colour palette.

## Decisions made without the owner (please confirm or change)
- Dark base is Midnight's, without its coloured glows. The 0/1/2/3+ strips still use Midnight's teal shades (they do not follow the team).
- The spotlight is fixed to the screen (does not scroll). Easy to change if the owner prefers it to scroll.
- Cone width about 44 degrees, core about 16 degrees, glow 280 px tall; brightness 0.32 / 0.26 / 0.16 (cone / glow / core) at most. These are single numbers in `lib/teamTheme.ts`.
- The owner pointed at the "band" example on ponytail.dev. That page's "band" is a status strip shown in the Claude Code terminal (task cost, tokens, tests), not a lighting effect, so it did not inform the spotlight. If the owner meant a different look, say so.

## How to verify
- `cd app && npm test`: 40 passed, `npx tsc -b` clean, `npm run lint` no findings, `npm run build` 241 kB JavaScript (76 kB gzipped). Python `pytest`: 86 passed (unchanged).
- Readability: text and muted text keep a contrast of at least 4.5 at the brightest point of the beam (cone, glow and core stacked, plus the card's own lightening) for all 30 teams; accent colours at least 4.5 on the page and cards. The test works the colours out step by step independently of the helper.
- CSS validity: a real CSS parser (lightningcss, already installed with Tailwind) fully parses the spotlight CSS for all 30 teams; two deliberately broken versions are left unparsed (test control). This check was added after finding that the simulated browser I use for interaction checks accepts any text, even garbage, so it cannot tell valid CSS from invalid.
- Geometry: both cones' brightest stop lands exactly on 180 degrees (straight down) for every team.
- Page-level check (the real page in a simulated browser with stubbed data, kept in my scratch folder, not the repo): no theme buttons; the spotlight layer is fixed, behind content and not clickable; it holds the Knicks colours; choosing San Antonio swaps it to silver and black; the page root is its own stacking context; 8 of 8.
- Deliberate breaks, each caught: wide cone off-centre, core in the primary colour, beam far too bright (3 tests fail), a typo making the CSS invalid, layer scrolling with the page, layer in front of the content.
- **Not verified:** how it looks. This session has no browser tool, so nothing was seen on screen: the cone width, brightness, the way the light shows through the cards, and the phone layout. The owner's first look is the real test. Browsers draw conic gradients and fixed layers well, but I have not tested this one in a real browser.

## Files added or changed
- `app/src/lib/themes.ts`: now one dark theme.
- `app/src/lib/teamTheme.ts`: spotlight layers and the readability maths (no theme argument any more).
- `app/src/App.tsx`: theme picker removed; fixed spotlight layer behind the page.
- `app/tests/teamTheme.test.mjs`: rewritten for the spotlight.
- `docs/NEXT.md`: step 15.

## Risks and things I am unsure about
- Unseen on screen (see above). Most likely tweaks: cone width and brightness, and whether the core is visible.
- The light may look strong behind the header on very bright teams; the brightness cap protects text, not taste.
- The saved theme in people's browsers is simply ignored now.
- The live app is NOT redeployed by this PR; the deploy waits for the owner's go (the app also stops about 24 hours after a deploy; it was last deployed at 14:29 UTC on 2026-11-13).

## Review focus for Codex
- `lib/teamTheme.ts` (the stacking maths for the peak, the gradient strings).
- `App.tsx` (stacking: `isolate`, `-z-10`, `pointer-events-none`).

## Open questions for the owner
1. After looking at the page: wider or narrower cone, brighter or dimmer, keep it fixed or let it scroll?
2. Keep the page-level and interaction checks in the repo as permanent tests? It would add one dev dependency (`jsdom`) to the app.

## Owner walkthrough
- **What changed:** the page is dark only now, and the Theme buttons are gone. Pick a team and a soft beam of light shines down the middle of the page from the top in the team's main colour, with a thin line of their second colour in the very centre. Scroll down and the light stays put.
- **What stayed the same:** the cards, the numbers, the headshot and logo, the tooltips.
- **What to look at yourself:** switch between a few teams (Knicks, Lakers, Spurs, Nets) and see how the beam and the chart marks change colour. Check you can read everything, including the small grey text near the top. Tell me if the light should be wider, narrower, brighter, dimmer or scroll with the page.
- **What the files mean:** `themes.ts` holds the one dark colour set; `teamTheme.ts` builds the beam from a team's two colours and makes sure text is still readable; `App.tsx` places the beam behind the page.
