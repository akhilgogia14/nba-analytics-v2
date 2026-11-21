export type Page = 'players' | 'teams' | 'today' | 'predictions' | 'picks'
export type Route = { page: Page; team: string }

/**
 * The address says which page to show and which team is chosen: "#/teams", "#/teams?team=BOS", "#/players?team=BOS".
 * Today's games is the default (an empty or unknown address opens it); "#/teams" and "#/players" open the other two. A team is
 * three capital letters; anything else is ignored.
 */
export function parseHash(hash: string): Route {
  const [path, query = ''] = hash.replace(/^#/, '').split('?')
  const team = new URLSearchParams(query).get('team') ?? ''
  const page: Page =
    path === '/players' || path === '/players/advanced' ? 'players' : path === '/teams' || path === '/teams/advanced' ? 'teams' : path === '/predictions' ? 'predictions' : path === '/picks' ? 'picks' : 'today'
  return { page, team: /^[A-Z]{3}$/.test(team) ? team : '' }
}

/** The player carried in the address ("#/players/advanced?team=NYK&player=1628973"): digits only, anything else is ignored. */
export function playerFromHash(hash: string): string {
  const query = hash.replace(/^#/, '').split('?')[1] ?? ''
  const id = new URLSearchParams(query).get('player') ?? ''
  return /^\d{1,12}$/.test(id) ? id : ''
}

/** The Teams and Players pages each have two tabs: the Overview ("#/teams", "#/players") and Advanced stats ("#/teams/advanced", "#/players/advanced"). */
export type View = 'overview' | 'advanced'
export const isAdvancedHash = (hash: string): boolean => ['/teams/advanced', '/players/advanced'].includes(hash.replace(/^#/, '').split('?')[0])

/** The opponent carried in the address ("#/teams?team=NYK&opp=POR"): three capital letters, anything else is ignored. */
export function oppFromHash(hash: string): string {
  const query = hash.replace(/^#/, '').split('?')[1] ?? ''
  const opp = new URLSearchParams(query).get('opp') ?? ''
  return /^[A-Z]{3}$/.test(opp) ? opp : ''
}

/** True when the address asks to land on the roster ("#/teams?team=NYK&opp=POR&focus=roster"). */
export const focusRosterFromHash = (hash: string): boolean => new URLSearchParams(hash.replace(/^#/, '').split('?')[1] ?? '').get('focus') === 'roster'

/** The opponent in the address the page is at now. */
export const currentOpp = (): string => oppFromHash(window.location.hash)

/**
 * The address for a page (or for a page's Advanced stats tab), carrying the chosen team, on Players and Predictions the chosen player
 * (if any), and on Teams, Players and Predictions the opponent (if any, and never the team itself). `focus: 'roster'` asks the Teams
 * page to scroll to the roster.
 */
export function hashFor(page: Page, team: string, view: View = 'overview', player = '', opp = '', focus = ''): string {
  const path = (page === 'teams' || page === 'players') && view === 'advanced' ? `${page}/advanced` : page
  const parts = [
    /^[A-Z]{3}$/.test(team) ? `team=${team}` : '',
    (page === 'players' || page === 'predictions') && /^\d{1,12}$/.test(player) ? `player=${player}` : '',
    page !== 'today' && /^[A-Z]{3}$/.test(opp) && opp !== team ? `opp=${opp}` : '',
    page === 'teams' && focus === 'roster' ? 'focus=roster' : '',
  ].filter(Boolean)
  return `#/${path}${parts.length ? `?${parts.join('&')}` : ''}`
}

export const pageFromHash = (hash: string): Page => parseHash(hash).page

/** Writes the chosen team (and player, opponent) into the address without adding a back-button step (and without a page change). The opponent already in the address is kept unless one is given. */
export function rememberTeam(page: Page, team: string, view: View = 'overview', player = '', opp: string = currentOpp()): void {
  if (/^[A-Z]{3}$/.test(team) && window.location.hash !== hashFor(page, team, view, player, opp)) {
    window.history.replaceState(null, '', hashFor(page, team, view, player, opp))
  }
}
