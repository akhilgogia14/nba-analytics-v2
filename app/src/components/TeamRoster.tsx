import { useEffect, useRef } from 'react'
import { hashFor } from '../lib/pages.ts'
import { panelStyle } from '../lib/styles.ts'
import { ROSTER_COLUMNS, rosterNote, startsText, statText } from '../lib/roster.ts'
import type { RosterPlayer } from '../types.ts'

/**
 * A team's roster under its cards: each player's last-10 averages and how many of those games he started, starters first. A name
 * opens that player's page with the team and the opponent kept. On a phone the table scrolls sideways with the name pinned.
 */
export function TeamRoster({
  team,
  opp,
  players,
  error,
  autoScroll,
}: {
  team: string
  opp: string
  players: RosterPlayer[] | null
  error: string
  autoScroll: boolean
}) {
  const box = useRef<HTMLElement>(null)
  const done = useRef(false)
  useEffect(() => {
    // asked to land on the roster (from Today's games): scroll to it once it has loaded
    if (autoScroll && players && !done.current) {
      done.current = true
      box.current?.scrollIntoView?.({ block: 'start' })
    }
  }, [autoScroll, players])

  return (
    <section ref={box} aria-label="Roster" className="flex scroll-mt-4 flex-col gap-3 rounded-[18px] border border-(--border) bg-(--panel) p-5" style={panelStyle}>
      <div className="flex flex-col gap-0.5">
        <div className="text-sm font-semibold">Roster · last 10 games</div>
        <div className="text-xs text-(--muted)">{rosterNote(players)}</div>
      </div>
      {error && <div className="text-sm text-(--warnText)" role="alert">{error}</div>}
      {!error && !players && <div className="text-sm text-(--muted)">Loading the roster...</div>}
      {players && players.length > 0 && (
        <>
          <div className="text-xs text-(--muted) md:hidden">Swipe the table sideways for the other columns.</div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] border-collapse text-[13px] md:min-w-[640px] md:text-sm">
              <thead>
                <tr className="text-left text-xs tracking-wider text-(--muted) uppercase">
                  <th className="sticky left-0 z-10 w-28 bg-(--inputBg) py-2 pr-2 font-semibold md:w-auto md:bg-transparent md:pr-3">Player</th>
                  <th className="px-1.5 py-2 text-right font-semibold md:px-2" title="Games he started, of his last 10 played">Starts</th>
                  {ROSTER_COLUMNS.map((c) => (
                    <th key={c.key} className="px-1.5 py-2 text-right font-semibold md:px-2" title={c.title}>
                      {c.short}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {players.map((p) => (
                  <tr key={p.id} className="border-t border-(--border)">
                    <td className="sticky left-0 z-10 w-28 bg-(--inputBg) py-2 pr-2 font-semibold md:w-auto md:bg-transparent md:pr-3">
                      <a href={hashFor('players', team, 'overview', p.id, opp)} className="text-(--text) no-underline hover:underline" title={`Open ${p.name}`}>
                        {p.name}
                      </a>
                    </td>
                    <td className="px-1.5 py-2 text-right tabular-nums text-(--muted) md:px-2">{startsText(p)}</td>
                    {ROSTER_COLUMNS.map((c) => (
                      <td key={c.key} className={`px-1.5 py-2 text-right tabular-nums md:px-2 ${c.key === 'pts' ? 'font-semibold' : ''}`}>
                        {statText(p.stats[c.key])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {players && players.length === 0 && !error && <div className="text-sm text-(--muted)">No players on record for this team this season.</div>}
    </section>
  )
}
