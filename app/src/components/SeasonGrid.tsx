import { useEffect, useRef, useState } from 'react'
import { f1 } from '../lib/geom.ts'
import {
  BINS, GRID_STATS, MISSED, STAT_NAMES, UPCOMING, buildCells, chartPalette, hexLayout, hexPoints, hexTip,
  playedSummary, seasonMean, type Cell,
} from '../lib/hex.ts'
import { panelStyle, pillClass, pillStyle } from '../lib/styles.ts'
import { clampAnchor } from '../lib/tips.ts'
import type { GameType, GridStat, Season } from '../types.ts'

const TYPE_NAMES: Record<GameType, string> = { 'regular-season': 'Regular season', playoffs: 'Playoffs' }

/** One small hexagon-shaped swatch for the key under the chart. */
function Swatch({ fill, stroke, dashed, ring, size = 18 }: { fill: string; stroke: string; dashed?: boolean; ring?: string; size?: number }) {
  const r = ring ? size / 2 - 5 : size / 2 - 1.5
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden className="shrink-0">
      {ring && <polygon points={hexPoints(size / 2, size / 2, size / 2 - 1.2)} fill="none" stroke={ring} strokeWidth={1.4} strokeLinejoin="round" />}
      <polygon
        points={hexPoints(size / 2, size / 2, r)}
        fill={fill}
        stroke={stroke}
        strokeWidth={1}
        strokeDasharray={dashed ? '3 2' : undefined}
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * The season chart: one hexagon per team game, in date order, for the game type the page's toggle has chosen (regular
 * season or playoffs, never both). Played games are coloured by the chosen stat (five steps from his lowest to his highest
 * game, in the team's colours), a game where he reached his season average has a ring around it, a game he missed is dark
 * grey, and (regular season) games not played yet are empty outlines up to 82. A traded player has one grid per team.
 */
export function SeasonGrid({ season, team, gameType }: { season: Season | null; team: string; gameType: GameType }) {
  const palette = chartPalette(team)
  const [stat, setStat] = useState<GridStat>('pts')
  const [teamChoice, setTeamChoice] = useState('')
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

  const shell = 'flex flex-col gap-4 rounded-[18px] border border-(--border) bg-(--panel) p-5'
  if (!season) {
    return (
      <section className={shell} style={panelStyle}>
        <div className="text-sm font-semibold">Season</div>
        <div className="text-sm text-(--muted)">Loading the season...</div>
      </section>
    )
  }
  const grids = season.grids.filter((g) => g.gameType === gameType)
  if (grids.length === 0) {
    return (
      <section className={shell} style={panelStyle}>
        <div className="text-sm font-semibold">Season · {TYPE_NAMES[gameType]}</div>
        <div className="text-sm text-(--muted)">No {TYPE_NAMES[gameType].toLowerCase()} games on record for this player yet.</div>
      </section>
    )
  }

  const grid = grids.find((g) => g.teamId === teamChoice) ?? grids[0]
  const cells = buildCells(grid, stat, grids)
  const mean = seasonMean(grids, stat)
  const layout = hexLayout(cells.length)
  const { played, total } = playedSummary(grid)
  const hasUpcoming = cells.some((c) => c.kind === 'upcoming')
  const active: Cell | null = tip === null ? null : cells[tip]
  const activeTip = active ? hexTip(active, stat, mean) : null
  const anchor = tip === null ? null : layout.cells[tip]

  const fillFor = (c: Cell) => (c.kind === 'played' ? palette.ramp[c.bin] : c.kind === 'upcoming' ? 'none' : MISSED.fill)
  const strokeFor = (c: Cell) => (c.kind === 'upcoming' ? UPCOMING.stroke : c.kind === 'played' ? 'none' : MISSED.stroke)

  return (
    <section className={shell} style={panelStyle}>
      <div className="flex flex-col gap-0.5">
        <div className="text-sm font-semibold">
          Season · {TYPE_NAMES[gameType]} {grid.seasonLabel}
        </div>
        <div className="text-xs text-(--muted)">
          {grid.team}: played {played} of {total} team games{total < 82 && gameType === 'regular-season' ? ' so far' : ''}
          {mean !== null && <> · season average {f1(mean)} {STAT_NAMES[stat].toLowerCase()}</>}
        </div>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Stat">
        {GRID_STATS.map((s) => (
          <button key={s} type="button" aria-pressed={s === stat} className={pillClass} style={pillStyle(s === stat)} onClick={() => { setStat(s); setTip(null) }}>
            {STAT_NAMES[s]}
          </button>
        ))}
      </div>

      {grids.length > 1 && (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Team">
          {grids.map((g) => (
            <button key={g.teamId} type="button" aria-pressed={g === grid} className={pillClass} style={pillStyle(g === grid)} onClick={() => { setTeamChoice(g.teamId); setTip(null) }}>
              {g.team}
            </button>
          ))}
          <span className="text-xs text-(--muted)">
            Also played for {grid.otherTeams?.split(',').join(', ')} this season: his games for the other team show as grey here.
          </span>
        </div>
      )}

      <div ref={box} className="relative mx-auto w-full max-w-[760px]">
        {activeTip && anchor && (
          <div
            role="tooltip"
            className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full rounded-lg px-3 py-1.5 text-xs whitespace-nowrap shadow-lg"
            style={{
              left: `${clampAnchor((anchor.cx / layout.width) * 100)}%`,
              top: `calc(${((anchor.cy - layout.radius) / layout.height) * 100}% - 6px)`,
              background: 'var(--pillOn)',
              color: 'var(--pillOnText)',
            }}
          >
            <div className="font-semibold">{activeTip.title}</div>
            <div className="opacity-80">{activeTip.detail}</div>
          </div>
        )}
        <svg viewBox={`0 0 ${layout.width} ${layout.height}`} className="block w-full" role="group" aria-label={`${STAT_NAMES[stat]} in each game of the ${grid.seasonLabel} ${TYPE_NAMES[gameType].toLowerCase()}`}>
          {cells.map((c, i) => {
            const { cx, cy } = layout.cells[i]
            const t = hexTip(c, stat, mean)
            // A game that reached the season average gets a ring just outside its hexagon, with a dark gap between the
            // two, so the ring shows whatever the fill colour is.
            const poly = (
              <>
                {c.hit && (
                  <polygon
                    data-ring
                    points={hexPoints(cx, cy, layout.radius - 1.4)}
                    fill="none"
                    stroke={palette.ring}
                    strokeWidth={1.6}
                    strokeLinejoin="round"
                  />
                )}
                <polygon
                  points={hexPoints(cx, cy, layout.radius - 4.6)}
                  fill={fillFor(c)}
                  stroke={strokeFor(c)}
                  strokeWidth={1}
                  strokeDasharray={c.kind === 'upcoming' ? '3 3' : undefined}
                  strokeLinejoin="round"
                />
              </>
            )
            if (!t) return <g key={i} aria-hidden>{poly}</g>
            return (
              <g
                key={i}
                role="button"
                tabIndex={0}
                aria-label={t.label}
                className="cursor-help outline-none focus-visible:[&>polygon]:stroke-(--accent)"
                onMouseEnter={() => setTip(i)}
                onMouseLeave={() => setTip((cur) => (cur === i ? null : cur))}
                onFocus={() => setTip(i)}
                onBlur={() => setTip((cur) => (cur === i ? null : cur))}
                onClick={() => setTip(i)}
                onKeyDown={(e) => e.key === 'Escape' && setTip(null)}
              >
                {poly}
              </g>
            )
          })}
        </svg>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-(--muted)">
        <span className="inline-flex items-center gap-1.5">
          Less
          {Array.from({ length: BINS }, (_, b) => (
            <Swatch key={b} fill={palette.ramp[b]} stroke="none" />
          ))}
          More
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Swatch fill={palette.ramp[BINS - 1]} stroke="none" ring={palette.ring} size={22} />
          reached his season average
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Swatch fill={MISSED.fill} stroke={MISSED.stroke} />
          did not play
        </span>
        {hasUpcoming && (
          <span className="inline-flex items-center gap-1.5">
            <Swatch fill="none" stroke={UPCOMING.stroke} dashed />
            not played yet
          </span>
        )}
      </div>
    </section>
  )
}
