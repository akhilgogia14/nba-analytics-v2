import { shortDate } from '../lib/format.ts'
import { meetingsNote, seasonTag } from '../lib/meetings.ts'
import { panelStyle } from '../lib/styles.ts'
import type { GameType, Meetings } from '../types.ts'

const COLUMNS = [
  ['pts', 'PTS'], ['reb', 'REB'], ['ast', 'AST'], ['fg3m', '3PM'], ['blk', 'BLK'], ['stl', 'STL'],
] as const

const selectClass =
  'h-10 rounded-xl border border-(--pillBorder) bg-(--inputBg) px-3 text-[14px] font-semibold text-(--text) disabled:opacity-50'

/**
 * The player's games against one opponent: all of this season's, topped up with earlier ones when there are few. Games from
 * an earlier season are marked in the Season column and shown dimmer, with a dashed line where they start.
 */
export function MeetingsPanel({
  opponents, opp, onOpp, meetings, error, gameType, gamesWord,
}: {
  opponents: string[]
  opp: string
  onOpp: (code: string) => void
  meetings: Meetings | null
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
          <div className="text-xs text-(--muted)">Pick a team to see how this player has done against them.</div>
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
          <div className="text-[13px] text-(--muted)">{meetingsNote(meetings, opp, gamesWord)}</div>
          {meetings.games.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="text-left text-xs text-(--muted)">
                    <th className="py-1.5 pr-3 font-semibold">Date</th>
                    <th className="py-1.5 pr-3 font-semibold">Season</th>
                    <th className="py-1.5 pr-3 font-semibold">Game</th>
                    {COLUMNS.map(([k, label]) => (
                      <th key={k} className="py-1.5 pr-3 text-right font-semibold">{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {meetings.games.map((g, i) => {
                    const startsEarlier = g.kind !== 'this' && (i === 0 || meetings.games[i - 1].kind === 'this')
                    const old = g.kind !== 'this'
                    return (
                      <tr
                        key={g.id}
                        className={`${old ? 'opacity-70' : ''} ${startsEarlier && i > 0 ? 'border-t border-dashed border-(--whisker)' : ''}`}
                      >
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
                        <td className="py-1.5 pr-3 whitespace-nowrap text-(--muted)">
                          {g.team} {g.isHome ? 'vs' : '@'} {g.opp}
                        </td>
                        {COLUMNS.map(([k]) => (
                          <td key={k} className="py-1.5 pr-3 text-right tabular-nums">{g.stats[k] ?? '–'}</td>
                        ))}
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
