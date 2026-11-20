import { useEffect, useRef, useState } from 'react'
import { OUTLOOK_STATS, VIEWS, baseline, fmtOutlook, missBand, missBandText, summarize, typicalMiss, type OutlookStat, type Views } from '../lib/outlook.ts'
import { CHART_PAD, ROW_HEIGHT, chartLayout, dotGroups, tipGames } from '../lib/outlookChart.ts'
import { panelStyle } from '../lib/styles.ts'

/** One stat: three rows on a shared scale, each a line from his lowest to his highest, a dot for every game, a tick at the average, and a dashed line at the baseline. */
function StatChart({ views, stat, label, digits, opp }: { views: Views; stat: OutlookStat; label: string; digits: number; opp: string | null }) {
  const layout = chartLayout(views, stat)
  const [active, setActive] = useState<{ row: number; value: number } | null>(null)
  const box = useRef<HTMLDivElement>(null)
  // a tap or click elsewhere closes the tooltip (touch has no mouse-leave)
  useEffect(() => {
    if (!active) return
    const away = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setActive(null)
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [active])
  const base = baseline(summarize(views.last10, stat), summarize(views.season, stat))
  const miss = typicalMiss(stat, missBand(views))
  const height = layout.rows.length * ROW_HEIGHT
  const rowName = (key: string) => (key === 'opponent' ? (opp ? `vs ${opp}` : 'vs opponent') : (VIEWS.find((v) => v.key === key)?.label.replace('Last 10 games', 'Last 10').replace('This season', 'Season') ?? key))
  const summary = `${label}. Baseline ${fmtOutlook(base, digits)}, typical miss ${fmtOutlook(miss, digits)}. ${layout.rows
    .map((r) => {
      const s = summarize(views[r.key], stat)
      return s ? `${rowName(r.key)}: low ${fmtOutlook(s.min, digits)}, average ${fmtOutlook(s.avg, digits)}, high ${fmtOutlook(s.max, digits)} over ${r.games} games` : `${rowName(r.key)}: no games`
    })
    .join('. ')}.`
  return (
    <div className="flex flex-col gap-2 rounded-[14px] border border-(--border) p-4" data-chart={stat}>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="m-0 text-[16px] font-semibold">{label}</h3>
        <span className="text-xs text-(--muted)">
          Baseline {fmtOutlook(base, digits)} · typical miss ±{fmtOutlook(miss, digits)}
        </span>
      </div>
      <div className="flex gap-2">
        <div className="flex w-[72px] shrink-0 flex-col text-xs text-(--muted)" aria-hidden="true">
          {layout.rows.map((r) => (
            <div key={r.key} className="flex items-center" style={{ height: ROW_HEIGHT }}>
              {rowName(r.key)}
            </div>
          ))}
        </div>
        <div ref={box} className="relative min-w-0 flex-1">
        {(() => {
          if (!active) return null
          const r = layout.rows[active.row]
          const g = r && dotGroups(r.dots).find((x) => x.value === active.value)
          if (!g) return null
          return (
            <div
              role="tooltip"
              className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full rounded-lg px-3 py-1.5 text-xs whitespace-nowrap shadow-lg"
              style={{ left: `${Math.min(84, Math.max(16, g.x))}%`, top: active.row * ROW_HEIGHT + ROW_HEIGHT / 2 - 8, background: 'var(--pillOn)', color: 'var(--pillOnText)' }}
            >
              <div className="font-semibold">
                {fmtOutlook(g.value, digits)} {label.toLowerCase()} · {rowName(r.key)}
              </div>
              {tipGames(g.games).map((t) => (
                <div key={t} className="opacity-80">{t}</div>
              ))}
            </div>
          )
        })()}
        <svg role="group" aria-label={summary} className="block w-full overflow-visible" style={{ height }}>
          {layout.baselineX !== null && <line x1={`${layout.baselineX}%`} x2={`${layout.baselineX}%`} y1={0} y2={height} stroke="var(--accent)" strokeWidth={1.5} strokeDasharray="4 3" data-baseline />}
          {layout.rows.map((r, i) => {
            const cy = i * ROW_HEIGHT + ROW_HEIGHT / 2
            const muted = r.key === 'opponent' ? 0.7 : 1
            return (
              <g key={r.key} opacity={muted}>
                <line x1={`${CHART_PAD}%`} x2={`${100 - CHART_PAD}%`} y1={cy} y2={cy} stroke="var(--track)" strokeWidth={1} />
                {r.minX !== null && r.maxX !== null && <line x1={`${r.minX}%`} x2={`${r.maxX}%`} y1={cy} y2={cy} stroke="var(--whisker)" strokeWidth={3} strokeLinecap="round" data-range />}
                {r.dots.map((d, j) => (
                  <circle key={j} cx={`${d.x}%`} cy={cy} r={active?.row === i && active.value === d.value ? 5 : 3.5} fill="var(--accent)" fillOpacity={active?.row === i && active.value === d.value ? 1 : 0.55} data-dot />
                ))}
                {dotGroups(r.dots).map((g) => {
                  const on = () => setActive({ row: i, value: g.value })
                  const off = () => setActive((cur) => (cur?.row === i && cur.value === g.value ? null : cur))
                  return (
                    <circle
                      key={g.value}
                      cx={`${g.x}%`}
                      cy={cy}
                      r={9}
                      fill="transparent"
                      role="button"
                      tabIndex={0}
                      aria-label={`${fmtOutlook(g.value, digits)} ${label.toLowerCase()}, ${rowName(r.key)}: ${g.games.join('; ')}`}
                      className="cursor-help outline-none focus-visible:stroke-(--accent)"
                      data-hit
                      onMouseEnter={on}
                      onMouseLeave={off}
                      onFocus={on}
                      onBlur={off}
                      onClick={on}
                      onKeyDown={(e) => e.key === 'Escape' && setActive(null)}
                    />
                  )
                })}
                {r.avgX !== null && <line x1={`${r.avgX}%`} x2={`${r.avgX}%`} y1={cy - 9} y2={cy + 9} stroke="var(--text)" strokeWidth={2.5} data-avg />}
              </g>
            )
          })}
        </svg>
        </div>
      </div>
      <div className="flex justify-between pl-[80px] text-[11px] text-(--muted) tabular-nums" aria-hidden="true">
        <span>{fmtOutlook(layout.lo, digits)}</span>
        <span>{fmtOutlook(layout.hi, digits)}</span>
      </div>
    </div>
  )
}

/**
 * The same numbers as the table, drawn: for each stat, three rows (his last 10 games, this season, his last 10 against the next
 * opponent) on one shared scale, so how much the views agree is visible at a glance. A dot is one game (hover, tap or tab to it for the date and
 * the number), the thick line runs from his lowest to his highest, the white tick is the average, and the dashed line is the baseline.
 */
export function OutlookCharts({ views, opp }: { views: Views; opp: string | null }) {
  return (
    <section className="flex flex-col gap-3 rounded-[18px] border border-(--border) bg-(--panel) p-5" style={panelStyle}>
      <h2 className="m-0 text-[20px] font-semibold tracking-tight" style={{ fontFamily: 'var(--display)' }}>
        The same games, drawn
      </h2>
      <div className="text-[13px] text-(--muted)">
        Each dot is one game. The thick line runs from his lowest to his highest, the white tick is his average, and the dashed line is the baseline. All three rows share one scale
        per stat. The typical miss is for {missBandText(missBand(views))}.
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {OUTLOOK_STATS.map((s) => (
          <StatChart key={s.key} views={views} stat={s.key} label={s.label} digits={s.digits} opp={opp} />
        ))}
      </div>
    </section>
  )
}
