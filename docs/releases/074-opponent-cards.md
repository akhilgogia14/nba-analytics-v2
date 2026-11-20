# Release 074: Player cards and Predictions follow the opponent

Date: 2026-11-20
Branch / PR: feat/opponent-filter
Author: (Claude Code)

## What changed (UX plan, part 1 of the universal opponent filter)
- **Players Overview:** with an opponent set (from the address or the meetings picker) and some meetings on record, two pills appear above the cards: **Recent form** and **vs ATL · last 9 meetings**. It opens on the opponent. The six cards then show the average of the last 10 meetings (any season) as the big number, "avg of last 9 meetings vs ATL" with median, the sparkline and the range / 0-1-2-3+ shares of those meetings, and the season average as the subtext with the "vs season avg" chip. The eyebrow and the subtitle say the same (dates with their year, since meetings can span seasons).
- No meetings on record: the cards stay on recent form with one line saying so. No opponent: nothing changes.
- **Predictions:** the "last 10 vs opponent" row uses the opponent in the address if there is one (otherwise his next opponent, as before); if it is not his next opponent, a note names both.
- New `app/src/lib/oppCards.ts` builds a card's summary from a list of games with the same rules as the stored last-10 summary (linear-interpolation percentiles). Files: `app/src/App.tsx`, `app/src/PredictionsPage.tsx`, `app/src/components/Scorecard.tsx`, `app/src/lib/oppCards.ts`, `app/src/lib/format.ts`, `app/tests/oppCards.test.mjs`. No server, table or grant changes.

## How to verify
- tsc, oxlint, build clean; 217 tests pass (percentiles, summary, missing values, shares, window label, date with year).
- **The browser calculation equals the server's:** run on 32 players (4 teams) x 6 stats = 192 summaries from each player's last 10 games, every mean, median, 10th/90th percentile, lowest, highest and share matches the stored summary (0 differences).
- Real data, simulated browser (Brandon Miller vs ATL): the six big numbers equal an independent last-meetings average from the raw game rows (21.1, 4.9, 3.0, 3.8, 1.1, 1.0); season average and median shown; lowest and highest right; Recent form and back works; Naz Reid vs MIN (never played) shows the note and recent form; no opponent leaves the page as before; Predictions uses the chosen opponent and states his next one when different. 9 + 2 checks pass. A laptop screenshot was looked at.

## Risks
- A small number of meetings makes a noisy card; the label says how many ("last 9 meetings") and the sparkline shows each one.
- The combined-stats table (points + rebounds + assists ...) and the hexagons still show recent form / the full season (hexagons are part 2).
- The page reads the address when it first opens (as team and player already did), so changing the address by hand while on the page needs a reload; links from other pages work.

## Owner walkthrough
Open a player from a team's roster (or a Today's games card): the player's six cards now compare him against that opponent. A small switch above the cards lets you flip between "Recent form" (his last 10 games) and "vs ATL" (his last meetings with them, from any season). In the opponent view the big number is the average of those meetings, the grey text at the top right still shows his season average, and the arrow shows how far the opponent average is from his season average. On Predictions, the last row of the table and each chart is his last 10 against the opponent you came with.
