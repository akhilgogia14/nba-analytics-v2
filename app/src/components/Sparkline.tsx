import { useEffect, useRef, useState } from 'react'
import { SPARK_H, SPARK_W, lineTip, sparkLayout, sparkTip, type LineKind, type SparkNames } from '../lib/spark.ts'
import { f1 } from '../lib/geom.ts'
import { clampAnchor } from '../lib/tips.ts'
import type { SparkGame } from '../types.ts'

/** What the bubble is describing: one game's point, or one of the two average lines (x = where on the line, in % of the width). */
type Active = { kind: 'point'; i: number } | { kind: 'line'; which: LineKind; x: number } | null

/**
 * The line under a scorecard's big number: one point per game of the window (oldest on the left), a soft fill under the
 * line, a dashed line at the season average, a dotted line at the league average (team page) and a dot on the latest game.
 * Hover, focus (keyboard) or tap a point for its value, opponent and date, or an average line for its value. Drawn in the
 * team's accent colour.
 */
export function Sparkline({
  games, stat, seasonAvg, leagueAvg = null, names, fmt, avgFmt = f1,
}: {
  games: SparkGame[]
  stat: string
  seasonAvg: number | null
  /** The league average of this stat (the team page): drawn as a dotted line. */
  leagueAvg?: number | null
  /** Short and long name of the stat for the bubble; players' six stats have defaults. */
  names?: SparkNames
  /** How a game's value is written in its bubble (default: as is, so a whole number stays whole). */
  fmt?: (n: number) => string
  /** How an average is written in its bubble (default: one decimal). */
  avgFmt?: (n: number) => string
}) {
  const [active, setActive] = useState<Active>(null)
  const box = useRef<HTMLDivElement>(null)

  // A tap or click anywhere else closes the bubble (phones have no "mouse leave").
  useEffect(() => {
    if (active === null) return
    const away = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setActive(null)
    }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [active])

  const L = sparkLayout(games, stat, seasonAvg, leagueAvg)
  if (L.points.length < 2) return null // one game is not a line
  const last = L.points[L.points.length - 1]
  const gradient = `spark-${stat}`

  // the bubble: where it sits and what it says
  let bubble: { left: number; top: number; title: string; detail: string } | null = null
  if (active?.kind === 'point') {
    const p = L.points[active.i]
    const t = sparkTip(p.game, stat, p.value, names, fmt)
    bubble = { left: (p.x / SPARK_W) * 100, top: (p.y / SPARK_H) * 100, title: t.title, detail: t.detail }
  } else if (active?.kind === 'line') {
    const [value, y] = active.which === 'league' ? [leagueAvg, L.leagueBaseline] : [seasonAvg, L.baseline]
    if (value !== null && y !== null) {
      const t = lineTip(active.which, value, avgFmt)
      bubble = { left: active.x, top: (y / SPARK_H) * 100, title: t.title, detail: t.detail }
    }
  }

  // a thin, invisible strip over an average line that shows its bubble on hover (following the pointer), focus and tap
  const lineHit = (which: LineKind, value: number | null, y: number | null) => {
    if (value === null || y === null) return null
    const t = lineTip(which, value, avgFmt)
    const at = (e: React.MouseEvent<SVGGElement>) => {
      const svg = e.currentTarget.ownerSVGElement?.getBoundingClientRect()
      return svg && svg.width > 0 ? ((e.clientX - svg.left) / svg.width) * 100 : 50
    }
    const same = (cur: Active) => cur?.kind === 'line' && cur.which === which
    return (
      <g
        key={`${which}-hit`}
        role="button"
        tabIndex={0}
        aria-label={t.label}
        className="cursor-help outline-none"
        onMouseEnter={(e) => setActive({ kind: 'line', which, x: at(e) })}
        onMouseMove={(e) => setActive({ kind: 'line', which, x: at(e) })}
        onMouseLeave={() => setActive((cur) => (same(cur) ? null : cur))}
        onFocus={() => setActive({ kind: 'line', which, x: 50 })}
        onBlur={() => setActive((cur) => (same(cur) ? null : cur))}
        onClick={(e) => setActive({ kind: 'line', which, x: at(e) })}
        onKeyDown={(e) => e.key === 'Escape' && setActive(null)}
      >
        <rect x={0} y={y - 5} width={SPARK_W} height={10} fill="transparent" />
      </g>
    )
  }

  return (
    <div ref={box} className="relative">
      {bubble && (
        <div
          role="tooltip"
          className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full rounded-lg px-3 py-1.5 text-xs whitespace-nowrap shadow-lg"
          style={{
            left: `${clampAnchor(bubble.left)}%`,
            top: `calc(${bubble.top}% - 8px)`,
            background: 'var(--pillOn)',
            color: 'var(--pillOnText)',
          }}
        >
          <div className="font-semibold">{bubble.title}</div>
          <div className="opacity-80">{bubble.detail}</div>
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
            onMouseEnter={() => setActive({ kind: 'point', i })}
            onMouseLeave={() => setActive((cur) => (cur?.kind === 'point' && cur.i === i ? null : cur))}
            onFocus={() => setActive({ kind: 'point', i })}
            onBlur={() => setActive((cur) => (cur?.kind === 'point' && cur.i === i ? null : cur))}
            onClick={() => setActive({ kind: 'point', i })}
            onKeyDown={(e) => e.key === 'Escape' && setActive(null)}
          >
            {/* a wide invisible target, and a dot that shows while the point is active */}
            <rect x={p.x - SPARK_W / (2 * L.points.length)} y={0} width={SPARK_W / L.points.length} height={SPARK_H} fill="transparent" />
            {active?.kind === 'point' && active.i === i && <circle cx={p.x} cy={p.y} r={4} fill="var(--dot)" stroke="var(--accent)" strokeWidth={2} />}
          </g>
        ))}
        {/* the average lines' strips go on top of the game columns, so the line itself answers where it is */}
        {lineHit('season', seasonAvg, L.baseline)}
        {lineHit('league', leagueAvg, L.leagueBaseline)}
      </svg>
    </div>
  )
}
