export const TEAM_NAMES: Record<string, string> = {
  ATL: 'Atlanta Hawks', BKN: 'Brooklyn Nets', BOS: 'Boston Celtics', CHA: 'Charlotte Hornets', CHI: 'Chicago Bulls',
  CLE: 'Cleveland Cavaliers', DAL: 'Dallas Mavericks', DEN: 'Denver Nuggets', DET: 'Detroit Pistons',
  GSW: 'Golden State Warriors', HOU: 'Houston Rockets', IND: 'Indiana Pacers', LAC: 'LA Clippers',
  LAL: 'Los Angeles Lakers', MEM: 'Memphis Grizzlies', MIA: 'Miami Heat', MIL: 'Milwaukee Bucks',
  MIN: 'Minnesota Timberwolves', NOP: 'New Orleans Pelicans', NYK: 'New York Knicks', OKC: 'Oklahoma City Thunder',
  ORL: 'Orlando Magic', PHI: 'Philadelphia 76ers', PHX: 'Phoenix Suns', POR: 'Portland Trail Blazers',
  SAC: 'Sacramento Kings', SAS: 'San Antonio Spurs', TOR: 'Toronto Raptors', UTA: 'Utah Jazz', WAS: 'Washington Wizards',
}

export function teamLabel(code: string): string {
  return TEAM_NAMES[code] ? `${TEAM_NAMES[code]} (${code})` : code
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "2026-10-23" -> "Oct 23". Done by hand so the time zone can never shift the day. */
export function shortDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return iso
  return `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}`
}

/** Whole days between an ISO date and today (UTC dates). */
export function daysSince(iso: string, now: Date = new Date()): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return 0
  const then = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return Math.round((today - then) / 86_400_000)
}

export const LABELS: Record<string, string> = {
  pts: 'Points', reb: 'Rebounds', ast: 'Assists', fg3m: '3-pointers made', blk: 'Blocks', stl: 'Steals',
  pra: 'Points + rebounds + assists', pr: 'Points + rebounds', pa: 'Points + assists', ra: 'Rebounds + assists',
  minutes: 'Minutes',
}

export const CARD_STATS = ['pts', 'reb', 'ast', 'fg3m', 'blk', 'stl'] as const
export const TABLE_STATS = ['pra', 'pr', 'pa', 'ra', 'minutes'] as const
