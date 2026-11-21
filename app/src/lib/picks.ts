import type { GameDetail } from '../types.ts'

/**
 * Paper picks: a pick you save in this browser (player, stat, over or under, the line you type, the game). Nothing is placed anywhere.
 * Once the game is final the app grades it from the real box score: win, loss, push (landed exactly on the line) or void (he did not play).
 */
export type PickStat = 'pts' | 'reb' | 'ast' | 'fg3m' | 'blk' | 'stl'
export type Side = 'over' | 'under'
export type Outcome = 'win' | 'loss' | 'push' | 'void'
export type Pick = {
  id: string
  playerId: string
  playerName: string
  team: string
  opp: string
  isHome: boolean
  gameId: string
  gameDate: string
  stat: PickStat
  side: Side
  line: number
  /** The app's baseline for this stat when the pick was saved, so the pick can be compared with it later. */
  baseline: number | null
  savedAt: string
  /** Filled in once the game is final; a final result does not change, so it is kept and not looked up again. */
  result?: { outcome: Outcome; actual: number | null }
}

export const PICK_STATS: { key: PickStat; label: string }[] = [
  { key: 'pts', label: 'Points' },
  { key: 'reb', label: 'Rebounds' },
  { key: 'ast', label: 'Assists' },
  { key: 'fg3m', label: '3-pointers' },
  { key: 'blk', label: 'Blocks' },
  { key: 'stl', label: 'Steals' },
]
const STAT_KEYS = PICK_STATS.map((s) => s.key)
export const statLabel = (k: PickStat): string => PICK_STATS.find((s) => s.key === k)?.label ?? k
export const STORAGE_KEY = 'nba-form.picks.v1'

/** One pick per player, game and stat: saving again replaces it. */
export const pickId = (playerId: string, gameId: string, stat: PickStat): string => `${playerId}:${gameId}:${stat}`

/** The line as typed ("20.5", "20,5"): a number from 0 to 200 in half-steps or finer, else null. */
export function parseLine(text: string): number | null {
  const t = text.trim().replace(',', '.')
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(t)) return null
  const v = Number(t)
  return v >= 0 && v <= 200 ? v : null
}

/** Win, loss or push for one stat against a line. Over wins above the line, under wins below it, exactly on it is a push. */
export function gradePick(side: Side, line: number, actual: number): Outcome {
  if (actual === line) return 'push'
  return (actual > line) === (side === 'over') ? 'win' : 'loss'
}

/** The result of a pick from the game's detail: null while the game is not final (no team result yet, or the game is not found). */
export function resultFrom(pick: Pick, detail: GameDetail | null): Pick['result'] | null {
  if (!detail || detail.result === null) return null
  if (!detail.played) return { outcome: 'void', actual: null }
  const actual = detail.game.stats[pick.stat]
  return actual === null ? { outcome: 'void', actual: null } : { outcome: gradePick(pick.side, pick.line, actual), actual }
}

export type Tally = { wins: number; losses: number; pushes: number; voids: number }
export type PickRecord = Tally & { graded: number; pending: number; hitRate: number | null; agreed: Tally & { hitRate: number | null }; against: Tally & { hitRate: number | null } }

const emptyTally = (): Tally => ({ wins: 0, losses: 0, pushes: 0, voids: 0 })
const add = (t: Tally, o: Outcome) => {
  if (o === 'win') t.wins++
  else if (o === 'loss') t.losses++
  else if (o === 'push') t.pushes++
  else t.voids++
}
/** Wins out of wins plus losses: pushes and voids are not decided, so they are left out. Null when nothing is decided. */
const rate = (t: Tally): number | null => (t.wins + t.losses === 0 ? null : t.wins / (t.wins + t.losses))

/** Does the pick's side match the baseline's side? A baseline exactly on the line agrees with neither. */
export function agreesWithBaseline(p: Pick): boolean | null {
  if (p.baseline === null || p.baseline === p.line) return null
  return (p.baseline > p.line) === (p.side === 'over')
}

export function recordOf(picks: Pick[]): PickRecord {
  const all = emptyTally()
  const agreed = emptyTally()
  const against = emptyTally()
  let pending = 0
  for (const p of picks) {
    if (!p.result) {
      pending++
      continue
    }
    add(all, p.result.outcome)
    const a = agreesWithBaseline(p)
    if (a === true) add(agreed, p.result.outcome)
    else if (a === false) add(against, p.result.outcome)
  }
  return {
    ...all,
    graded: all.wins + all.losses + all.pushes + all.voids,
    pending,
    hitRate: rate(all),
    agreed: { ...agreed, hitRate: rate(agreed) },
    against: { ...against, hitRate: rate(against) },
  }
}

/** "Over 20.5 points" */
export const pickText = (p: Pick): string => `${p.side === 'over' ? 'Over' : 'Under'} ${p.line} ${statLabel(p.stat).toLowerCase()}`

/** Saved picks from the browser's storage. Anything that is not a well-formed pick is dropped, so a damaged or edited store cannot break the page. */
export function parsePicks(raw: string | null): Pick[] {
  if (!raw) return []
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(data)) return []
  const out: Pick[] = []
  for (const d of data as Loose[]) {
    if (!d || typeof d !== 'object') continue
    const stat = d.stat
    const ok =
      typeof d.playerId === 'string' && /^\d{1,12}$/.test(d.playerId) &&
      typeof d.gameId === 'string' && /^\d{8,12}$/.test(d.gameId) &&
      typeof d.gameDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(d.gameDate) &&
      typeof stat === 'string' && STAT_KEYS.includes(stat as PickStat) &&
      (d.side === 'over' || d.side === 'under') &&
      typeof d.line === 'number' && Number.isFinite(d.line) && d.line >= 0 && d.line <= 200
    if (!ok) continue
    const r = d.result as { outcome?: unknown; actual?: unknown } | undefined
    const result =
      r && ['win', 'loss', 'push', 'void'].includes(r.outcome as string) && (r.actual === null || typeof r.actual === 'number')
        ? { outcome: r.outcome as Outcome, actual: r.actual as number | null }
        : undefined
    out.push({
      id: pickId(d.playerId as string, d.gameId as string, stat as PickStat),
      playerId: d.playerId as string,
      playerName: typeof d.playerName === 'string' ? d.playerName.slice(0, 80) : '',
      team: typeof d.team === 'string' && /^[A-Z]{3}$/.test(d.team) ? d.team : '',
      opp: typeof d.opp === 'string' && /^[A-Z]{3}$/.test(d.opp) ? d.opp : '',
      isHome: d.isHome === true,
      gameId: d.gameId as string,
      gameDate: d.gameDate as string,
      stat: stat as PickStat,
      side: d.side as Side,
      line: d.line as number,
      baseline: typeof d.baseline === 'number' && Number.isFinite(d.baseline) ? d.baseline : null,
      savedAt: typeof d.savedAt === 'string' ? d.savedAt : '',
      ...(result ? { result } : {}),
    })
  }
  return out
}
type Loose = { [k: string]: unknown }

export function loadPicks(): Pick[] {
  try {
    return parsePicks(window.localStorage.getItem(STORAGE_KEY))
  } catch {
    return []
  }
}
/** True when the browser accepted the write (private windows and blocked storage can refuse). */
export function savePicks(picks: Pick[]): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(picks))
    return true
  } catch {
    return false
  }
}

/** Saves one pick (replacing the same player, game and stat) and returns the new list. */
export function withPick(picks: Pick[], pick: Pick): Pick[] {
  return [pick, ...picks.filter((p) => p.id !== pick.id)]
}

/** The list in the order the page shows it: undecided first by game date, then decided newest first. */
export function orderPicks(picks: Pick[]): Pick[] {
  const byDate = (a: Pick, b: Pick) => a.gameDate.localeCompare(b.gameDate)
  const open = picks.filter((p) => !p.result).sort(byDate)
  const done = picks.filter((p) => p.result).sort((a, b) => byDate(b, a))
  return [...open, ...done]
}
