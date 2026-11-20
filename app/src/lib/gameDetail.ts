import { SPLITS, madeAtt, signed, splitValue } from './gamelog.ts'
import { STAT_SHORT } from './hex.ts'
import type { GameResult, GridStat, LogGame } from '../types.ts'

/** "W 118-110", "L 102-110 (2OT)": the team's final score from the log, or '' when there is none. */
export function resultText(r: GameResult | null): string {
  if (!r || r.teamPts === null || r.oppPts === null) return ''
  const ot = r.overtimes > 0 ? ` (${r.overtimes === 1 ? '' : r.overtimes}OT)` : ''
  return `${r.won ? 'W' : 'L'} ${r.teamPts}-${r.oppPts}${ot}`
}

const n = (v: number | null) => (v === null ? '–' : String(v))

/** His line in that game as small tiles: minutes, the six stats, the three shooting splits, turnovers, fouls and plus/minus. */
export function detailTiles(g: LogGame): { label: string; value: string }[] {
  const split = (made: string, att: string) => madeAtt(splitValue(g, made), splitValue(g, att))
  const s = SPLITS.map(([made, att, label]) => ({ label, value: split(made, att) }))
  return [
    { label: 'MIN', value: g.minutes === null ? '–' : String(Math.round(g.minutes)) },
    { label: 'PTS', value: n(g.stats.pts) },
    { label: 'REB', value: n(g.stats.reb) },
    { label: 'AST', value: n(g.stats.ast) },
    s[1], s[0], s[2], // 3P, FG, FT
    { label: 'STL', value: n(g.stats.stl) },
    { label: 'BLK', value: n(g.stats.blk) },
    { label: 'TOV', value: n(g.box.tov) },
    { label: 'PF', value: n(g.box.pf) },
    { label: '+/-', value: signed(g.box.plusMinus) },
  ]
}

/** "23 PTS: 4.8 above his season average of 18.2", or '' when either number is missing. */
export function againstAverage(value: number | null, mean: number | null, stat: GridStat): string {
  if (value === null || mean === null) return ''
  const d = Math.round((value - mean) * 10) / 10
  const how = d === 0 ? 'equal to' : `${Math.abs(d).toFixed(1)} ${d > 0 ? 'above' : 'below'}`
  return `${value} ${STAT_SHORT[stat]}: ${how} his season average of ${mean.toFixed(1)}`
}
