# Release 065: Teams note as bullets, and the Players tabs keep the player

Date: 2026-11-17
Branch / PR: feat/teams-note-bullets-and-player-link
Author: (Claude Code)

## What changed
- Teams > Advanced stats: "How to read this" is four short bullets instead of a paragraph: league columns, team columns, what we tested (a team's own split in one half of a season did not predict the other half, release 052), and "games are compared as played". The facts are the ones the old paragraph stated.
- Players page: the Overview and Advanced stats tabs now carry the chosen player both ways. The Overview page reads `player=` from the address, selects him (if he is on the chosen team's list, otherwise the first player as before), and keeps him in the address when you choose someone else. So Overview -> Advanced stats -> Overview stays on the same player.

## Why
Both were left open after releases 061 and 063 and answered "yes" by the owner (2026-11-17).

## How to verify
- `npx tsc -b`, `npx oxlint`: clean. `npm test`: 173 passed (no logic tests changed; the address helpers were tested in release 061).
- Real data, simulated browser through a local server (10 of 10 checks pass): choosing a non-first player on the Overview puts him in the address; the Advanced tab link carries team and player; the Advanced page opens on him; the Overview link on the Advanced page carries both; the Overview then opens on the same player (not the first in the list) and keeps him in the address; a link with a player who is not on the team falls back to the first player; the Teams note has four bullets with the evidence sentence and the old paragraph is gone.
- After merge the deploy run is checked before saying it is live.

## Files added or changed
- `app/src/TeamsAdvancedPage.tsx`, `app/src/App.tsx`, `docs/NEXT.md`, `docs/releases/065-teams-note-bullets-and-player-link.md`.

## Risks and things I am unsure about
- Not seen in a real browser.
- Changing the address by hand to a different player while already on the Players page does not move the selection (the page reads the address when it opens, as it already did for the team); following a link or a tab does.
- The Players overview now keeps `player=` in the address, so a copied link opens on that player.

## Review focus for Codex
Whether the `useEffect` that writes the address on the Players page could fight with the initial `player` from the address when the team list is still loading.

## Open questions for the owner
None.

## Owner walkthrough
Two small things. First, the grey explanation on a team's Advanced stats page is now four short bullets you can scan, matching the one on the player pages. Second, on the Players page, if you pick a player and press the Advanced stats button, you land on that player, and pressing Overview takes you back to the same player instead of the first name in the list.
