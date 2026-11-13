# Release 020: look and feel (headshots, logos, team colours, chart tooltips)

Date: 2026-11-13 (UTC)
Branch / PR: `feat/look-and-feel`, PR #27
Author: (Claude Code)

## What changed
- **Headshots and team logos.** The player header shows a round headshot next to the name and a round team logo next to the team code. Images load live from the NBA's public image address when the page opens; nothing is stored in the repo. If an image does not load, the page shows the player's initials or a coloured badge with the team letters (white or dark letters, whichever is readable).
- **Team-colour background.** Choosing a team lays a soft tint of its primary colour across the top of the page (fading out over about 560 pixels), and the median mark, middle-80% band, whisker and accent text take the team's colour (its secondary colour if the primary cannot be read on the theme). The four themes stay; they keep their cards, text and fonts. With no team chosen, the page looks as before.
- **Chart tooltips.** Hover, tap or keyboard-focus the average dot, median mark, middle-80% band or lowest-to-highest line of a card and a bubble gives its number and what it means ("Median 25.5: the middle game of the last 10 games: half were above this, half below."). The 0/1/2/3+ strips use the same bubble, so they now work on touch and keyboard too. Escape or a tap elsewhere closes it.
- New modules: `lib/teams.ts` (colours, ids, image addresses, readable-text helper, from v1), `lib/images.ts` (what to show or fall back to), `lib/teamTheme.ts` (tint and accent maths), `lib/tips.ts` (bubble text and position), `components/Avatar.tsx`.
- No data, table or grant changed. The app still reads only regular-season `player_form` rows.

## Why
The owner asked for these (tooltips, headshots and logos, team-colour background) and the agreed order put the look-and-feel work before `player_vs_opponent`, because it needs no new data. v1 already had the colour table and the load-live-with-fallback pattern.

## Decisions made without the owner (please confirm or change)
- The tint is a wash on top of each theme, not a solid page colour: a solid colour would make text unreadable for light teams (Spurs silver) or very dark ones (Nets black).
- Tint strength: 0.22 on Paper and Aurora, 0.32 on Midnight, 0.30 on Graphite (one number per theme, easy to change).
- With a team look on, the grey "muted" text moves halfway toward the main text colour (darker on light themes, lighter on dark ones). Without it only 1 of 30 teams could have the full tint on Paper.
- The headshot crop favours the top of the image (as in v1).
- Images come from the NBA's server and are not licensed to us; the owner said this is fine for a for-fun project. Nothing is committed or stored.

## How to verify
- `cd app && npm test`: 37 passed (22 before this release plus 15 new). `npx tsc -b` clean, `npm run lint` no findings, `npm run build` 245 kB JavaScript (77 kB gzipped). Python `pytest`: 86 passed (unchanged).
- Team ids: all 30 abbreviation-to-id pairs were read from the real `team_game` table (30 rows, one id each) and are pasted into a test; they are the NBA's own ids (NYK 1610612752). Brunson's headshot and the Knicks logo returned images (HTTP 200) from the NBA's server.
- Readability maths (tested for every team on every theme, 120 combinations): text and muted text keep contrast of at least 4.5 under the tint, accent colours keep at least 4.5 on the page and on the cards. This found two real problems before shipping: a fixed tint strength failed for red teams on Paper (Atlanta 4.19), and the plain muted grey allowed the full tint for only 1 of 30 teams on Paper; both were fixed (see the muted-text decision above).
- Deliberate breaks, each caught by tests: a changed team id, a loosened headshot address check (first missed, test strengthened), text helper always white, stronger tint, lower accent limit, no muted adjustment, always-primary accent, tint from the secondary colour.
- Server render of the real components: avatar and badge 5 of 5 (right addresses, accessible names, both fallbacks); points and threes cards 10 of 10 (four labelled keyboard-focusable hit areas per bar, four more on the strip, no bubble until hovered).
- Interaction test (the real card in a simulated page, kept in my scratch folder, not the repo): hover, leave, switching marks, keyboard focus, Escape, tap a strip piece, tap elsewhere, pressing inside the bar, bubble kept inside the card, theme colours: 12 of 12. Four deliberate breaks (Escape, tap-away, keyboard focus, mouse-leave) each failed exactly one check (my first mouse-leave break was a no-op because of a macOS `sed` quirk; redone as a real edit).
- **Not verified:** how any of this looks. This session has no browser tool, so nothing was seen on screen: tint colours, headshot crop, bubble size and position, phone layout. The owner's first look is the real test.

## Files added or changed
- `app/src/lib/teams.ts`, `images.ts`, `teamTheme.ts`, `tips.ts` (new): the logic.
- `app/src/components/Avatar.tsx` (new): headshot and logo components.
- `app/src/components/Scorecard.tsx`: hit areas, bubble, keyboard and tap handling; takes the game count.
- `app/src/App.tsx`: header with headshot and logo; team look applied to the page background and variables.
- `app/tests/teams.test.mjs`, `images.test.mjs`, `teamTheme.test.mjs`, `tips.test.mjs` (new): 15 tests.
- `docs/NEXT.md`: step 14.

## Risks and things I am unsure about
- **Unseen on screen** (see above). The most likely things to need a tweak: tint strength, the avatar crop, bubble width (224 px) on small phones, and whether the muted-text change is noticeable.
- The tint is layered with CSS `linear-gradient(...), var(--bg)`; this is standard but was not tested in a real browser.
- Images load from the NBA's server; if the NBA changes the addresses or blocks requests, the page falls back to initials and letter badges (tested), and nothing breaks.
- The images load on every page open (cached by the browser). 
- The live app is NOT redeployed by this PR; the deploy is a manual step the owner asked to trigger. Free Edition stops the app about 24 hours after a deploy (expect a stop near 13:41 UTC on 2026-11-14 if it is not redeployed; restart with `databricks apps start nba-player-form`).

## Review focus for Codex
- `lib/teamTheme.ts` and its tests (the contrast maths, the choice of accent colour, `color-mix` strings).
- `components/Scorecard.tsx`: event handlers, the outside-tap listener cleanup, accessibility of the hit areas.
- That image addresses cannot be influenced by outside input (`headshotUrl` accepts digits only).

## Open questions for the owner
1. After looking at the page: tint stronger or softer? Headshot crop? Anything to change in the bubble?
2. Keep the interaction test permanently? It would add one dev dependency (`jsdom`) to the app.
3. Next in the agreed order: `player_vs_opponent`, then the data-features PR (games table, last-updated, opponent filter, playoffs switch). Still right?

## Owner walkthrough
- **What you see:** pick a team and the top of the page glows softly in that team's colour, and the little marks on the charts (median line, shaded band, thin line) turn that colour too. The player's headshot sits left of his name and the team logo sits next to the team code.
- **Tooltips:** hover over a chart mark (on a phone, tap it) and a small dark bubble appears with the number and a plain explanation. Hover over a piece of the 0/1/2/3+ strip for its share. Click or tap somewhere else, or press Escape, and it goes away. You can also Tab to the marks with the keyboard.
- **If a picture is missing:** you see the player's initials or a coloured badge with the team letters instead. That is intended, not a bug.
- **The four themes still work.** Each theme keeps its own look; the team colour is added on top.
- **What to check yourself:** try a light team (San Antonio, silver), a dark team (Brooklyn, black) and a bright one (Atlanta, red) in each theme, and make sure you can still read everything. Tell me what to make stronger or softer.
- **What the new files mean:** `teams.ts` holds the colours and ids; `images.ts` decides picture or fallback; `teamTheme.ts` works out the tint and makes sure text stays readable; `tips.ts` writes the bubble text; `Avatar.tsx` draws the headshot and logo.
