import { shortDate } from '../lib/format.ts'
import { panelStyle } from '../lib/styles.ts'
import { pctText, resultText, teamAverageRow, teamLogNote } from '../lib/teamPage.ts'
import type { TeamGame } from '../types.ts'

const num = (v: number | null) => (v === null ? '–' : String(v))
const madeAtt = (made: number | null, att: number | null) => (made === null || att === null ? '–' : `${made}-${att}`)
const cell = 'py-1.5 pr-3 text-right tabular-nums whitespace-nowrap'
const head = 'py-1.5 pr-3 text-right font-semibold'

/**
 * The team's box-score table: its last 15 games played of the page's game type (regular season or playoffs, never both),
 * newest first, whatever the opponent. Date, game, result, then the offense: points, field goals with percentage, threes with
 * percentage, free throws, offensive and total rebounds, assists, turnovers, steals, blocks and fouls, with an average row at the bottom. A game
 * from an earlier season shows its year. The table scrolls sideways on a narrow screen.
 */
export function TeamGameLog({ games, error, gamesWord }: { games: TeamGame[] | null; error: string; gamesWord: string }) {
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
  const avg = teamAverageRow(games)
  const newest = games[0]?.seasonLabel
  return (
    <section className={shell} style={panelStyle}>
      <div className="flex flex-col gap-0.5">
        <div className="text-sm font-semibold">Box scores</div>
        <div className="text-xs text-(--muted)">{teamLogNote(games, gamesWord)}</div>
      </div>
      {games.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-xs text-(--muted)">
                <th className="py-1.5 pr-3 text-left font-semibold">Date</th>
                <th className="py-1.5 pr-3 text-left font-semibold">Game</th>
                <th className="py-1.5 pr-3 text-left font-semibold">Result</th>
                <th className={head}>PTS</th>
                <th className={head}>FG</th>
                <th className={head}>FG%</th>
                <th className={head}>3P</th>
                <th className={head}>3P%</th>
                <th className={head}>FT</th>
                <th className={head}>OREB</th>
                <th className={head}>REB</th>
                <th className={head}>AST</th>
                <th className={head}>TOV</th>
                <th className={head}>STL</th>
                <th className={head}>BLK</th>
                <th className={head}>PF</th>
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
                  <td className="py-1.5 pr-3 whitespace-nowrap font-semibold" style={{ color: g.won ? '#4ADE80' : '#F87171' }}>
                    {resultText(g)}{g.overtimes ? ` (${g.overtimes > 1 ? `${g.overtimes}OT` : 'OT'})` : ''}
                  </td>
                  <td className={`${cell} font-semibold`}>{num(g.pts)}</td>
                  <td className={cell}>{madeAtt(g.box.fgm, g.box.fga)}</td>
                  <td className={cell}>{pctText(g.box.fgm, g.box.fga)}</td>
                  <td className={cell}>{madeAtt(g.box.fg3m, g.box.fg3a)}</td>
                  <td className={cell}>{pctText(g.box.fg3m, g.box.fg3a)}</td>
                  <td className={cell}>{madeAtt(g.box.ftm, g.box.fta)}</td>
                  <td className={cell}>{num(g.box.oreb)}</td>
                  <td className={cell}>{num(g.box.reb)}</td>
                  <td className={cell}>{num(g.box.ast)}</td>
                  <td className={cell}>{num(g.box.tov)}</td>
                  <td className={cell}>{num(g.box.stl)}</td>
                  <td className={cell}>{num(g.box.blk)}</td>
                  <td className={cell}>{num(g.box.pf)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-(--whisker) font-semibold">
                <td className="py-1.5 pr-3" colSpan={2}>Average of these {games.length}</td>
                <td className="py-1.5 pr-3 text-xs whitespace-nowrap text-(--muted)" title="Games won">{avg.wins}-{games.length - avg.wins}</td>
                <td className={cell}>{num(avg.pts)}</td>
                <td className={cell}>{avg.fg}</td>
                <td className={cell}>{avg.fgPct}</td>
                <td className={cell}>{avg.fg3}</td>
                <td className={cell}>{avg.fg3Pct}</td>
                <td className={cell}>{avg.ft}</td>
                <td className={cell}>{num(avg.oreb)}</td>
                <td className={cell}>{num(avg.reb)}</td>
                <td className={cell}>{num(avg.ast)}</td>
                <td className={cell}>{num(avg.tov)}</td>
                <td className={cell}>{num(avg.stl)}</td>
                <td className={cell}>{num(avg.blk)}</td>
                <td className={cell}>{num(avg.pf)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
