import { shortDate } from '../lib/format.ts'
import { LOG_COLUMNS, averageRow, logNote } from '../lib/gamelog.ts'
import { panelStyle } from '../lib/styles.ts'
import type { RecentGame } from '../types.ts'

const num = (v: number | null) => (v === null ? '–' : String(v))

/**
 * The box-score table: the player's last 15 games played of the page's game type (regular season or playoffs, never both),
 * newest first, whatever the opponent, with an average row at the bottom. A game from an earlier season shows its year.
 */
export function GameLog({ games, error, gamesWord }: { games: RecentGame[] | null; error: string; gamesWord: string }) {
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
        <div className="text-xs text-(--muted)">{logNote(games, gamesWord)}</div>
      </div>
      {games.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs text-(--muted)">
                <th className="py-1.5 pr-3 font-semibold">Date</th>
                <th className="py-1.5 pr-3 font-semibold">Game</th>
                <th className="py-1.5 pr-3 text-right font-semibold">MIN</th>
                {LOG_COLUMNS.map(([k, label]) => (
                  <th key={k} className="py-1.5 pr-3 text-right font-semibold">{label}</th>
                ))}
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
                  <td className="py-1.5 pr-3 text-right tabular-nums">{num(g.minutes === null ? null : Math.round(g.minutes))}</td>
                  {LOG_COLUMNS.map(([k]) => (
                    <td key={k} className="py-1.5 pr-3 text-right tabular-nums">{num(g.stats[k])}</td>
                  ))}
                </tr>
              ))}
              <tr className="border-t-2 border-(--whisker) font-semibold">
                <td className="py-1.5 pr-3" colSpan={2}>Average of these {games.length}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums">{num(avg.minutes === null ? null : Math.round(avg.minutes))}</td>
                {LOG_COLUMNS.map(([k]) => (
                  <td key={k} className="py-1.5 pr-3 text-right tabular-nums">{num(avg.stats[k])}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
