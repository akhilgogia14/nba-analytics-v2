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
  const page: Page = path === '/players' ? 'players' : path === '/teams' || path === '/teams/advanced' ? 'teams' : 'today'
  return { page, team: /^[A-Z]{3}$/.test(team) ? team : '' }
}

/** The Teams page has two tabs: the Overview ("#/teams") and Advanced stats ("#/teams/advanced"). */
export type View = 'overview' | 'advanced'
export const isAdvancedHash = (hash: string): boolean => hash.replace(/^#/, '').split('?')[0] === '/teams/advanced'

/** The address for a page (or for the Teams page's Advanced stats tab), carrying the chosen team (if any). */
export function hashFor(page: Page, team: string, view: View = 'overview'): string {
  const path = page === 'teams' && view === 'advanced' ? 'teams/advanced' : page
  return `#/${path}${/^[A-Z]{3}$/.test(team) ? `?team=${team}` : ''}`
}

export const pageFromHash = (hash: string): Page => parseHash(hash).page

/** Writes the chosen team into the address without adding a back-button step (and without a page change). */
export function rememberTeam(page: Page, team: string, view: View = 'overview'): void {
  if (/^[A-Z]{3}$/.test(team) && window.location.hash !== hashFor(page, team, view)) {
    window.history.replaceState(null, '', hashFor(page, team, view))
  }
}
