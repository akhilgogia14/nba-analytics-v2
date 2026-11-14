import { shortDate } from '../lib/format.ts'
import { seasonTag } from '../lib/meetings.ts'
import { panelStyle } from '../lib/styles.ts'
import { pctText, resultText, teamMeetingsNote } from '../lib/teamPage.ts'
import type { GameType, TeamMeetings } from '../types.ts'

const selectClass =
  'h-10 rounded-xl border border-(--pillBorder) bg-(--inputBg) px-3 text-[14px] font-semibold text-(--text) disabled:opacity-50'
const cell = 'py-1.5 pr-3 text-right tabular-nums'
const num = (v: number | null) => (v === null ? '–' : String(v))

/**
 * The team's games against one opponent: all of this season's, topped up with last season's when there are few. Games from last
 * season are marked in the Season column and shown dimmer, with a dashed line where they start. Offense columns only for now.
 */
export function TeamMeetingsPanel({
  opponents, opp, onOpp, meetings, error, gameType, gamesWord,
}: {
  opponents: string[]
  opp: string
  onOpp: (code: string) => void
  meetings: TeamMeetings | null
  error: string
  gameType: GameType
  gamesWord: string
}) {
  const typeName = gameType === 'playoffs' ? 'Playoffs' : 'Regular season'
  return (
    <section className="flex flex-col gap-3 rounded-[18px] border border-(--border) bg-(--panel) p-5" style={panelStyle}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <div className="text-sm font-semibold">Against an opponent · {typeName}</div>
          <div className="text-xs text-(--muted)">Pick a team to see how this team has done against them.</div>
        </div>
        <select aria-label="Opponent" className={selectClass} value={opp} onChange={(e) => onOpp(e.target.value)}>
          <option value="">Choose an opponent...</option>
          {opponents.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {error && <div className="text-sm text-(--warnText)" role="alert">{error}</div>}
      {opp && !error && !meetings && <div className="text-sm text-(--muted)">Loading the games against {opp}...</div>}
      {meetings && opp && (
        <>
          <div className="text-[13px] text-(--muted)">{teamMeetingsNote(meetings, opp, gamesWord)}</div>
          {meetings.games.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="text-left text-xs text-(--muted)">
                    <th className="py-1.5 pr-3 font-semibold">Date</th>
                    <th className="py-1.5 pr-3 font-semibold">Season</th>
                    <th className="py-1.5 pr-3 font-semibold">Game</th>
                    <th className="py-1.5 pr-3 font-semibold">Result</th>
                    <th className={`${cell} font-semibold`}>FG%</th>
                    <th className={`${cell} font-semibold`}>3P%</th>
                    <th className={`${cell} font-semibold`}>3PM</th>
                    <th className={`${cell} font-semibold`}>AST</th>
                    <th className={`${cell} font-semibold`}>TOV</th>
                  </tr>
                </thead>
                <tbody>
                  {meetings.games.map((g, i) => {
                    const old = g.kind !== 'this'
                    const startsEarlier = old && i > 0 && meetings.games[i - 1].kind === 'this'
                    return (
                      <tr key={g.id} className={`${old ? 'opacity-70' : ''} ${startsEarlier ? 'border-t border-dashed border-(--whisker)' : ''}`}>
                        <td className="py-1.5 pr-3 whitespace-nowrap">{shortDate(g.date)}{old ? `, ${g.date.slice(0, 4)}` : ''}</td>
                        <td className="py-1.5 pr-3 whitespace-nowrap">
                          {old ? (
                            <span className="rounded-full border border-(--pillBorder) px-2 py-0.5 text-xs font-semibold text-(--muted)">
                              {seasonTag(g.kind, g.seasonLabel)}
                            </span>
                          ) : (
                            g.seasonLabel
                          )}
                        </td>
                        <td className="py-1.5 pr-3 whitespace-nowrap text-(--muted)">{g.isHome ? 'vs' : '@'} {g.opp}</td>
                        <td className="py-1.5 pr-3 whitespace-nowrap font-semibold" style={{ color: g.won ? '#4ADE80' : '#F87171' }}>{resultText(g)}</td>
                        <td className={cell}>{pctText(g.box.fgm, g.box.fga)}</td>
                        <td className={cell}>{pctText(g.box.fg3m, g.box.fg3a)}</td>
                        <td className={cell}>{num(g.box.fg3m)}</td>
                        <td className={cell}>{num(g.box.ast)}</td>
                        <td className={cell}>{num(g.box.tov)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  )
}
