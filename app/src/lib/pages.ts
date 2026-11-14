export type Page = 'players' | 'teams' | 'today'
export type Route = { page: Page; team: string }

/**
 * The address says which page to show and which team is chosen: "#/teams", "#/teams?team=BOS", "#/players?team=BOS".
 * Today's games is the default (an empty or unknown address opens it); "#/teams" and "#/players" open the other two. A team is
 * three capital letters; anything else is ignored.
 */
export function parseHash(hash: string): Route {
  const [path, query = ''] = hash.replace(/^#/, '').split('?')
  const team = new URLSearchParams(query).get('team') ?? ''
  const page: Page = path === '/players' ? 'players' : path === '/teams' ? 'teams' : 'today'
  return { page, team: /^[A-Z]{3}$/.test(team) ? team : '' }
}

/** The address for a page, carrying the chosen team (if any). */
export function hashFor(page: Page, team: string): string {
  return `#/${page}${/^[A-Z]{3}$/.test(team) ? `?team=${team}` : ''}`
}

export const pageFromHash = (hash: string): Page => parseHash(hash).page

/** Writes the chosen team into the address without adding a back-button step (and without a page change). */
export function rememberTeam(page: Page, team: string): void {
  if (/^[A-Z]{3}$/.test(team) && window.location.hash !== hashFor(page, team)) {
    window.history.replaceState(null, '', hashFor(page, team))
  }
}
