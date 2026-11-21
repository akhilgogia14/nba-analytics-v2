import { useEffect, useRef, useState } from 'react'
import { fetchGameDetail } from '../api.ts'
import { shortDate } from '../lib/format.ts'
import { f1 } from '../lib/geom.ts'
import { seasonTotalNote } from '../lib/gameType.ts'
import { againstAverage, detailTiles, resultText } from '../lib/gameDetail.ts'
import { hashFor } from '../lib/pages.ts'
import {
  BINS, GRID_STATS, MISSED, STAT_NAMES, UPCOMING, buildCells, chartPalette, hexLayout, hexPoints, hexTip,
  isVsOpp, playedSummary, seasonMean, type Cell,
} from '../lib/hex.ts'
import { panelStyle, pillClass, pillStyle } from '../lib/styles.ts'
import { clampAnchor } from '../lib/tips.ts'
import type { GameDetail as GameDetailData, GameType, GridStat, Season } from '../types.ts'
import { KpiTiles } from './KpiTiles.tsx'

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

/** What a click on a hexagon opens: the game, the result, his full line, and a way to see all his games against that opponent. */
function GameDetailPanel({ cell, stat, mean, playerId, team, onClose }: { cell: Cell; stat: GridStat; mean: number | null; playerId: string; team: string; onClose: () => void }) {
  const gameId = cell.game?.id ?? null
  const [loaded, setLoaded] = useState<{ id: string; data: GameDetailData | null; error: string } | null>(null)
  useEffect(() => {
    if (!gameId) return
    let cancelled = false
    fetchGameDetail(playerId, gameId)
      .then((data) => !cancelled && setLoaded({ id: gameId, data, error: '' }))
      .catch(() => !cancelled && setLoaded({ id: gameId, data: null, error: 'Could not load this game. Try clicking it again.' }))
    return () => {
      cancelled = true
    }
  }, [playerId, gameId])
  const here = loaded && loaded.id === gameId ? loaded : null
  const opp = cell.game?.opp ?? cell.next?.opp ?? ''
  const isHome = cell.game?.isHome ?? cell.next?.isHome ?? false
  const date = cell.game?.date ?? cell.next?.date ?? ''
  const result = resultText(here?.data?.result ?? null)
  const played = cell.kind === 'played' || cell.kind === 'gap'
  const vsLine = againstAverage(cell.value, mean, stat)
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-(--border) p-4" role="region" aria-label="Game detail">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <div className="text-[15px] font-semibold">
            {date && shortDate(date)} · {isHome ? 'vs' : '@'} {opp}
            {result && <span className="ml-2 text-(--muted)">{result}</span>}
          </div>
          <div className="text-xs text-(--muted)">
            {cell.kind === 'upcoming'
              ? `Not played yet · ${isHome ? 'home' : 'away'}`
              : cell.kind === 'missed'
                ? 'Did not play'
                : here?.data?.game.box.started === null || !here?.data
                  ? ''
                  : here.data.game.box.started
                    ? 'Started'
                    : 'Came off the bench'}
          </div>
        </div>
        <button type="button" onClick={onClose} className="min-h-9 cursor-pointer rounded-full border border-(--pillBorder) px-3.5 text-[13px] font-semibold">
          Close
        </button>
      </div>
      {played && here?.error && <div className="text-sm text-(--warnText)" role="alert">{here.error}</div>}
      {played && !here && <div className="text-sm text-(--muted)">Loading the box score...</div>}
      {played && here?.data && <KpiTiles tiles={detailTiles(here.data.game)} caption={vsLine} minWidth={76} />}
      {opp && (
        <a href={hashFor('players', team, 'overview', playerId, opp)} className="text-[14px] font-semibold text-(--accent) no-underline hover:underline">
          See all his games against {opp}
        </a>
      )}
    </div>
  )
}

/**
 * The season chart: one hexagon per team game, in date order, for the game type the page's toggle has chosen (regular
 * season or playoffs, never both). Played games are coloured by the chosen stat (five steps from his lowest to his highest
 * game, in the team's colours), a game where he reached his season average has a ring around it, a game he missed is dark
 * grey, and (regular season) games not played yet are empty outlines up to 82. A traded player has one grid per team.
 */
export function SeasonGrid({ season, team, gameType, playerId, opp = '' }: { season: Season | null; team: string; gameType: GameType; playerId: string; opp?: string }) {
  const palette = chartPalette(team)
  const oppPalette = chartPalette(opp)
  const [stat, setStat] = useState<GridStat>('pts')
  const [teamChoice, setTeamChoice] = useState('')
  const [tip, setTip] = useState<number | null>(null)
  const [sel, setSel] = useState<number | null>(null) // the clicked hexagon: its game opens under the chart
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

  // With an opponent chosen, his games against them take the opponent's colors; the scheduled ones are outlines in them.
  const vs = (c: Cell) => gameType === 'regular-season' && isVsOpp(c, opp)
  const hasVs = cells.some(vs)
  const hasVsPlayed = cells.some((c) => vs(c) && c.kind === 'played')
  const hasVsFuture = cells.some((c) => vs(c) && c.kind === 'upcoming')
  const fillFor = (c: Cell) => (c.kind === 'played' ? (vs(c) ? oppPalette : palette).ramp[c.bin] : c.kind === 'upcoming' ? 'none' : MISSED.fill)
  const strokeFor = (c: Cell) =>
    vs(c) ? oppPalette.top : c.kind === 'upcoming' ? UPCOMING.stroke : c.kind === 'played' ? 'none' : MISSED.stroke

  return (
    <section className={shell} style={panelStyle}>
      <div className="flex flex-col gap-0.5">
        <div className="text-sm font-semibold">
          Season · {TYPE_NAMES[gameType]} {grid.seasonLabel}
        </div>
        <div className="text-xs text-(--muted)">
          {grid.team}: played {played} of {total} team games{total < 82 && gameType === 'regular-season' ? ' so far' : ''}
          {seasonTotalNote(total, gameType) && <> · {seasonTotalNote(total, gameType)}</>}
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
            <button key={g.teamId} type="button" aria-pressed={g === grid} className={pillClass} style={pillStyle(g === grid)} onClick={() => { setTeamChoice(g.teamId); setTip(null); setSel(null) }}>
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
                    stroke={vs(c) ? oppPalette.ring : palette.ring}
                    strokeWidth={1.6}
                    strokeLinejoin="round"
                  />
                )}
                {sel === i && <polygon data-selected points={hexPoints(cx, cy, layout.radius - 0.4)} fill="none" stroke="var(--text)" strokeWidth={1.6} strokeLinejoin="round" />}
                <polygon
                  points={hexPoints(cx, cy, layout.radius - 4.6)}
                  fill={fillFor(c)}
                  stroke={strokeFor(c)}
                  strokeWidth={vs(c) ? 1.8 : 1}
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
                className="cursor-pointer outline-none focus-visible:[&>polygon]:stroke-(--accent)"
                onMouseEnter={() => setTip(i)}
                onMouseLeave={() => setTip((cur) => (cur === i ? null : cur))}
                onFocus={() => setTip(i)}
                onBlur={() => setTip((cur) => (cur === i ? null : cur))}
                onClick={() => { setTip(null); setSel(i) }} // the panel shows everything the bubble does
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setTip(null)
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSel(i) }
                }}
              >
                {poly}
              </g>
            )
          })}
        </svg>
      </div>

      {sel !== null && cells[sel] && (
        <GameDetailPanel key={sel} cell={cells[sel]} stat={stat} mean={mean} playerId={playerId} team={team} onClose={() => setSel(null)} />
      )}

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
        {hasVsPlayed && (
          <span className="inline-flex items-center gap-1.5">
            <Swatch fill={oppPalette.ramp[BINS - 1]} stroke={oppPalette.top} />
            games vs {opp}
          </span>
        )}
        {hasVsFuture && (
          <span className="inline-flex items-center gap-1.5">
            <Swatch fill="none" stroke={oppPalette.top} dashed />
            games vs {opp} still to come
          </span>
        )}
        {hasUpcoming && (
          <span className="inline-flex items-center gap-1.5">
            <Swatch fill="none" stroke={UPCOMING.stroke} dashed />
            not played yet
          </span>
        )}
        <span>Click a game for its box score.</span>
        {opp && gameType === 'regular-season' && !hasVs && (
          <span>No games against {opp} on this chart yet.</span>
        )}
      </div>
    </section>
  )
}
