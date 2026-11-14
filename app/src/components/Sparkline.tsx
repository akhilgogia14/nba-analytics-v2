import { useEffect, useRef, useState } from 'react'
import { SPARK_H, SPARK_W, sparkLayout, sparkTip, type SparkNames } from '../lib/spark.ts'
import { clampAnchor } from '../lib/tips.ts'
import type { SparkGame } from '../types.ts'

/**
 * The line under a scorecard's big number: one point per game of the window (oldest on the left), a soft fill under the
 * line, a dashed line at the season average and a dot on the latest game. Hover, focus (keyboard) or tap a point for its
 * value, opponent and date. Drawn in the team's accent colour.
 */
export function Sparkline({
  games, stat, seasonAvg, leagueAvg = null, names, fmt,
}: {
  games: SparkGame[]
  stat: string
  seasonAvg: number | null
  /** The league average of this stat (the team page): drawn as a dotted line. */
  leagueAvg?: number | null
  /** Short and long name of the stat for the bubble; players' six stats have defaults. */
  names?: SparkNames
  /** How a value is written in the bubble (default: as is). */
  fmt?: (n: number) => string
}) {
  const [tip, setTip] = useState<number | null>(null)
  const box = useRef<HTMLDivElement>(null)

  // A tap or click anywhere else closes the bubble (phones have no "mouse leave").
  useEffect(() => {
    if (tip === null) return
    const away = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setTip(null)
    }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [tip])

  const L = sparkLayout(games, stat, seasonAvg, leagueAvg)
  if (L.points.length < 2) return null // one game is not a line
  const active = tip === null ? null : L.points[tip]
  const activeTip = active ? sparkTip(active.game, stat, active.value, names, fmt) : null
  const last = L.points[L.points.length - 1]
  const gradient = `spark-${stat}`

  return (
    <div ref={box} className="relative">
      {activeTip && active && (
        <div
          role="tooltip"
          className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full rounded-lg px-3 py-1.5 text-xs whitespace-nowrap shadow-lg"
          style={{
            left: `${clampAnchor((active.x / SPARK_W) * 100)}%`,
            top: `calc(${(active.y / SPARK_H) * 100}% - 8px)`,
            background: 'var(--pillOn)',
            color: 'var(--pillOnText)',
          }}
        >
          <div className="font-semibold">{activeTip.title}</div>
          <div className="opacity-80">{activeTip.detail}</div>
        </div>
      )}
      <svg viewBox={`0 0 ${SPARK_W} ${SPARK_H}`} className="block h-14 w-full overflow-visible" role="group" aria-label={`Last ${L.points.length} games of ${stat}, oldest to newest${L.leagueBaseline !== null ? ', with the league average as a dotted line' : ''}`}>
        <defs>
          <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {L.baseline !== null && (
          <line x1={0} x2={SPARK_W} y1={L.baseline} y2={L.baseline} stroke="var(--whisker)" strokeWidth={1} strokeDasharray="4 4" />
        )}
        {L.leagueBaseline !== null && (
          <line x1={0} x2={SPARK_W} y1={L.leagueBaseline} y2={L.leagueBaseline} stroke="var(--muted)" strokeWidth={1.5} strokeDasharray="1.5 4" strokeLinecap="round" />
        )}
        <path className="spark-area" d={L.area} fill={`url(#${gradient})`} />
        <path className="spark-line" pathLength={1} d={L.line} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" style={{ filter: 'drop-shadow(0 0 4px var(--accent))' }} />
        <circle cx={last.x} cy={last.y} r={3.5} fill="var(--dot)" stroke="var(--accent)" strokeWidth={1.5} />
        {L.points.map((p, i) => (
          <g
            key={p.game.id}
            role="button"
            tabIndex={0}
            aria-label={sparkTip(p.game, stat, p.value, names, fmt).label}
            className="cursor-help outline-none focus-visible:[&>circle]:stroke-(--accent)"
            onMouseEnter={() => setTip(i)}
            onMouseLeave={() => setTip((cur) => (cur === i ? null : cur))}
            onFocus={() => setTip(i)}
            onBlur={() => setTip((cur) => (cur === i ? null : cur))}
            onClick={() => setTip(i)}
            onKeyDown={(e) => e.key === 'Escape' && setTip(null)}
          >
            {/* a wide invisible target, and a dot that shows while the point is active */}
            <rect x={p.x - SPARK_W / (2 * L.points.length)} y={0} width={SPARK_W / L.points.length} height={SPARK_H} fill="transparent" />
            {tip === i && <circle cx={p.x} cy={p.y} r={4} fill="var(--dot)" stroke="var(--accent)" strokeWidth={2} />}
          </g>
        ))}
      </svg>
    </div>
  )
}
