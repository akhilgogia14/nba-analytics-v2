import { shortDate } from '../lib/format.ts'
import { LOG_COLUMNS, SPLITS, averageRow, logNote, madeAtt, signed, splitValue } from '../lib/gamelog.ts'
import { panelStyle } from '../lib/styles.ts'
import type { LogGame } from '../types.ts'

const num = (v: number | null) => (v === null ? '–' : String(v))
const mins = (v: number | null) => (v === null ? '–' : String(Math.round(v)))
const cell = 'py-1.5 pr-3 text-right tabular-nums whitespace-nowrap'
const head = 'py-1.5 pr-3 text-right font-semibold'

/**
 * The box-score table: the player's last 15 games played of the page's game type (regular season or playoffs, never both),
 * newest first, whatever the opponent. Date, game, a marker for games he started, minutes, shooting splits (made-attempted),
 * rebounds (offensive, defensive, total), assists, steals, blocks, turnovers, fouls, plus/minus and points, with an average
 * row at the bottom. A game from an earlier season shows its year. The table scrolls sideways on a narrow screen.
 */
export function GameLog({ games, error, gamesWord }: { games: LogGame[] | null; error: string; gamesWord: string }) {
  const shell = 'flex flex-col gap-3 rounded-[18px] border border-(--border) bg-(--panel) p-5'
  if (error) {
    return (
      <section className={shell} style={panelStyle}>
        <div className="text-sm text-(--warnText)" role="alert">The box scores could not load: {error}</div>
      </section>
    )
  }
  if (!games) {
    return (
      <section className={shell} style={panelStyle}>
        <div className="text-sm text-(--muted)">Loading the box scores...</div>
      </section>
    )
  }
  const avg = averageRow(games)
  const newest = games[0]?.seasonLabel
  return (
    <section className={shell} style={panelStyle}>
      <div className="flex flex-col gap-0.5">
        <div className="text-sm font-semibold">Box scores</div>
        <div className="text-xs text-(--muted)">{logNote(games, gamesWord)} S marks a game he started.</div>
      </div>
      {games.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-xs text-(--muted)">
                <th className="py-1.5 pr-3 text-left font-semibold">Date</th>
                <th className="py-1.5 pr-3 text-left font-semibold">Game</th>
                <th className="py-1.5 pr-3 text-center font-semibold" title="Started">S</th>
                <th className={head}>MIN</th>
                {SPLITS.map(([, , label]) => (
                  <th key={label} className={head}>{label}</th>
                ))}
                <th className={head}>OREB</th>
                <th className={head}>DREB</th>
                {LOG_COLUMNS.map(([k, label]) => (
                  <th key={k} className={head}>{label}</th>
                ))}
                <th className={head}>TOV</th>
                <th className={head}>PF</th>
                <th className={head}>+/-</th>
                <th className={head}>PTS</th>
              </tr>
            </thead>
            <tbody>
              {games.map((g) => (
                <tr key={g.id} className="border-t border-(--border)">
                  <td className="py-1.5 pr-3 whitespace-nowrap">
                    {shortDate(g.date)}
                    {g.seasonLabel !== newest && <span className="text-(--muted)">, {g.date.slice(0, 4)}</span>}
                  </td>
                  <td className="py-1.5 pr-3 whitespace-nowrap text-(--muted)">{g.isHome ? 'vs' : '@'} {g.opp}</td>
                  <td className="py-1.5 pr-3 text-center text-xs font-semibold text-(--accent)">{g.box.started ? 'S' : ''}</td>
                  <td className={cell}>{mins(g.minutes)}</td>
                  {SPLITS.map(([made, att, label]) => (
                    <td key={label} className={cell}>{madeAtt(splitValue(g, made), splitValue(g, att))}</td>
                  ))}
                  <td className={cell}>{num(g.box.oreb)}</td>
                  <td className={cell}>{num(g.box.dreb)}</td>
                  {LOG_COLUMNS.map(([k]) => (
                    <td key={k} className={cell}>{num(g.stats[k])}</td>
                  ))}
                  <td className={cell}>{num(g.box.tov)}</td>
                  <td className={cell}>{num(g.box.pf)}</td>
                  <td className={cell}>{signed(g.box.plusMinus)}</td>
                  <td className={`${cell} font-semibold`}>{num(g.stats.pts)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-(--whisker) font-semibold">
                <td className="py-1.5 pr-3" colSpan={2}>Average of these {games.length}</td>
                <td className="py-1.5 pr-3 text-center text-xs text-(--muted)" title="Games started">{avg.started}</td>
                <td className={cell}>{mins(avg.minutes)}</td>
                {avg.splits.map((v, i) => (
                  <td key={SPLITS[i][2]} className={cell}>{v}</td>
                ))}
                <td className={cell}>{num(avg.oreb)}</td>
                <td className={cell}>{num(avg.dreb)}</td>
                {LOG_COLUMNS.map(([k]) => (
                  <td key={k} className={cell}>{num(avg.stats[k])}</td>
                ))}
                <td className={cell}>{num(avg.tov)}</td>
                <td className={cell}>{num(avg.pf)}</td>
                <td className={cell}>{avg.plusMinus === null ? '–' : avg.plusMinus > 0 ? `+${avg.plusMinus}` : String(avg.plusMinus)}</td>
                <td className={cell}>{num(avg.pts)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
