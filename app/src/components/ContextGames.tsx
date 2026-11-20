import type { ReactNode } from 'react'
import { gameCount, gameLine } from '../lib/contextGames.ts'
import { shortDate } from '../lib/format.ts'
import type { ContextGameBase } from '../types.ts'
import { ScrollX } from './ScrollX.tsx'

const cell = 'px-1.5 py-1.5 text-right text-[13px] md:px-3 md:text-[14px] tabular-nums whitespace-nowrap'
const head = 'px-1.5 py-1.5 text-right text-[10px] font-semibold md:px-3 md:text-xs tracking-normal md:tracking-wider text-(--muted) uppercase whitespace-nowrap'

export type GameColumn<G> = { head: string; phone?: boolean; cell: (g: G) => ReactNode }

/**
 * The games behind a comparison, for the Advanced tabs: a closed fold-out that asks for the games when first opened, then lists the
 * games on each side of the comparison (newest first) with the situation facts and the stats. It lists whatever games there are,
 * even when there are too few to compare.
 */
export function ContextGames<G extends ContextGameBase>({
  sides, columns, data, error, onOpen, note,
}: {
  sides: { label: string; total: number; games: G[] }[]
  columns: GameColumn<G>[]
  data: unknown
  error: string
  onOpen: () => void
  note?: (g: G) => string
}) {
  const total = sides.map((s) => `${s.label} ${s.total}`).join(', ')
  return (
    <details className="text-[14px]" onToggle={(e) => e.currentTarget.open && onOpen()}>
      <summary className="min-h-11 cursor-pointer font-semibold text-(--text)">Show the games ({total})</summary>
      {error && <div className="py-2 text-(--warnText)" role="alert">{error}</div>}
      {!error && !data && <div className="py-2 text-(--muted)">Loading the games...</div>}
      {!error && !!data && (
        <div className="flex flex-col gap-4">
          {sides.map((s) => (
            <div key={s.label} className="flex flex-col gap-1">
              <div className="text-xs font-semibold tracking-wider text-(--accent) uppercase">
                {s.label} · {gameCount(s.games.length)}
              </div>
              {s.games.length === 0 ? (
                <div className="text-(--muted)">No games in this situation yet.</div>
              ) : (
                <ScrollX>
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th className={`${head} text-left!`}>Game</th>
                        {columns.map((c) => (
                          <th key={c.head} className={`${head}${c.phone === false ? ' hidden md:table-cell' : ''}`}>{c.head}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {s.games.map((g) => {
                        const line = gameLine(g)
                        const extra = note?.(g)
                        return (
                          <tr key={g.id} className="border-t border-(--border)">
                            <th scope="row" className="px-1.5 py-1.5 text-left text-[13px] font-normal whitespace-nowrap md:px-3 md:text-[14px]">
                              <span className="font-semibold">{shortDate(g.date)}</span> · {line.title}
                              <div className="text-xs text-(--muted)">{extra ? `${extra} · ${line.note}` : line.note}</div>
                            </th>
                            {columns.map((c) => (
                              <td key={c.head} className={`${cell}${c.phone === false ? ' hidden md:table-cell' : ''}`}>{c.cell(g)}</td>
                            ))}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </ScrollX>
              )}
            </div>
          ))}
        </div>
      )}
    </details>
  )
}
