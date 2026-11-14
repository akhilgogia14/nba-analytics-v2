export type Page = 'players' | 'teams'

/** Which page the address asks for: "#/teams" is the Teams page, anything else the Player page. */
export const pageFromHash = (hash: string): Page => (hash.startsWith('#/teams') ? 'teams' : 'players')
