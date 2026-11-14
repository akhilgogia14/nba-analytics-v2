import type { SlateGame } from '../types.ts'

/** The schedule's dates are US dates, so "today" is today's date in US Eastern time, wherever the viewer is. Written YYYY-MM-DD. */
export function easternDate(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

/** A real calendar date written YYYY-MM-DD. */
export function isIsoDate(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false
  const d = new Date(`${v}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v
}

/** The date a number of days before or after (calendar arithmetic, so clock changes cannot skip or repeat a day). */
export function shiftDate(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** "Sat, Nov 14", with "Yesterday", "Today" or "Tomorrow" in front when it is one of those. */
export function dateHeading(iso: string, today: string): string {
  const text = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(`${iso}T12:00:00Z`))
  if (iso === today) return `Today · ${text}`
  if (iso === shiftDate(today, -1)) return `Yesterday · ${text}`
  if (iso === shiftDate(today, 1)) return `Tomorrow · ${text}`
  return text
}

/** The words under a game: the result once it is final, otherwise that it has not been played. */
export function gameStatus(g: SlateGame): string {
  if (!g.isFinal || g.homePts === null || g.awayPts === null) return 'Not played yet'
  return 'Final'
}

/** Which side won: null until the game is final. */
export function winner(g: SlateGame): 'home' | 'away' | null {
  if (!g.isFinal || g.homeWon === null) return null
  return g.homeWon ? 'home' : 'away'
}

/** The sentence shown when a date has no games of the chosen type. */
export function emptyText(iso: string, today: string, regular: boolean): string {
  const kind = regular ? 'regular-season' : 'playoff'
  return `No ${kind} games on ${dateHeading(iso, today).replace(/^[A-Za-z]+ · /, '')}. Use the arrows to look at another day.`
}
