import { useEffect, useRef, useState, type ReactNode } from 'react'
import { dateWithYear, shortDate } from '../lib/format.ts'
import { behindTile, fmtGame, fmtOutlook, headlineTiles, missBand, missBandText, typicalMiss, type Behind, type BehindRow, type OutlookStat, type Views } from '../lib/outlook.ts'
import { panelStyle } from '../lib/styles.ts'

/** The games behind one stat: one line each with a bar scaled to his highest figure, and whether it counts in the last 10, the season, or both. */
function GameRows({ rows, newestSeason, showWindows }: { rows: BehindRow[]; newestSeason: string; showWindows: boolean }) {
  const top = Math.max(0, ...rows.map((r) => r.value ?? 0))
  return (
    <ul className="m-0 flex list-none flex-col p-0">
      {rows.map((r) => (
        <li key={r.game.id} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-0.5 border-t border-(--border) py-1.5 first:border-t-0">
          <div className="text-[14px]">
            <span className="font-semibold">{r.game.seasonLabel === newestSeason ? shortDate(r.game.date) : dateWithYear(r.game.date)}</span>
            <span className="text-(--muted)"> · {r.game.isHome ? 'vs' : '@'} {r.game.opp}</span>
            {showWindows && (
              <span className="ml-2 text-xs text-(--muted)">{[r.inLast10 && 'last 10', r.inSeason && 'season'].filter(Boolean).join(' + ')}</span>
            )}
          </div>
          <div className="text-right text-[15px] font-semibold tabular-nums">{fmtGame(r.value)}</div>
          <div className="col-span-2 h-1.5 rounded-sm bg-(--track)" aria-hidden="true">
            <div className="h-full rounded-sm" style={{ width: `${top > 0 && r.value !== null ? (r.value / top) * 100 : 0}%`, background: 'var(--accent)', opacity: r.inLast10 || !showWindows ? 1 : 0.45 }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

/** What opens when a tile is clicked: where the big number comes from, the typical miss in words, and every game behind it. */
function BehindPanel({ b, band, opp, onClose, pick }: { b: Behind; band: ReturnType<typeof missBand>; opp: string | null; onClose: () => void; pick?: ReactNode }) {
  const d = b.digits
  const newestSeason = b.rows[0]?.game.seasonLabel ?? ''
  const miss = typicalMiss(b.stat, band)
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-(--border) p-4" role="region" aria-label={`${b.label}: the games behind the figure`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="m-0 text-[17px] font-semibold tracking-tight" style={{ fontFamily: 'var(--display)' }}>
          {b.label}: where {fmtOutlook(b.base, d)} comes from
        </h3>
        <button type="button" onClick={onClose} className="min-h-9 cursor-pointer rounded-full border border-(--pillBorder) px-3.5 text-[13px] font-semibold">
          Close
        </button>
      </div>
      {pick}
      <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[14px] leading-relaxed">
        <li>
          <strong>Last 10 games:</strong> average {fmtOutlook(b.last10?.avg ?? null, d)}
          {b.last10 && <span className="text-(--muted)"> (low {fmtGame(b.last10.min)}, high {fmtGame(b.last10.max)})</span>}
        </li>
        <li>
          <strong>This season:</strong> average {fmtOutlook(b.season?.avg ?? null, d)}
          {b.season && <span className="text-(--muted)"> over {b.season.n} {b.season.n === 1 ? 'game' : 'games'}</span>}
        </li>
        <li>
          <strong>Baseline:</strong> half of each, {fmtOutlook(b.base, d)}.
        </li>
        <li className="text-(--muted)">
          Typical miss ±{fmtOutlook(miss, d)}: how far this baseline was from what happened, on average, in a back-test of every game in 2025-26 and 2026-27, for {missBandText(band)}.
        </li>
      </ul>
      {b.rows.length === 0 ? (
        <div className="text-[14px] text-(--muted)">No games to show yet.</div>
      ) : (
        <div className="flex flex-col gap-1">
          <div className="text-xs font-semibold tracking-wider text-(--muted) uppercase">The games, newest first (faded ones count in the season only)</div>
          <GameRows rows={b.rows} newestSeason={newestSeason} showWindows />
        </div>
      )}
      {opp && (
        <details className="text-[14px] text-(--muted)">
          <summary className="min-h-11 cursor-pointer font-semibold text-(--text)">
            Against {opp}: {b.opponentRows.length === 0 ? 'no earlier games' : `${b.opponentRows.length} ${b.opponentRows.length === 1 ? 'game' : 'games'}, average ${fmtOutlook(b.opponent?.avg ?? null, d)}`}
          </summary>
          {b.opponentRows.length > 0 && (
            <div className="mt-1 flex flex-col gap-1">
              <div className="text-xs">Not part of the baseline. Shown for reference.</div>
              <GameRows rows={b.opponentRows} newestSeason={newestSeason} showWindows={false} />
            </div>
          )}
        </details>
      )}
    </div>
  )
}

/**
 * The answer first: one tile per stat with the baseline as the big number, how far off it typically was in the back-test, and the
 * lowest to highest of his last 10 games. The figures are the same ones the full table and the charts show further down. Click a
 * tile to see the games behind it.
 */
export function OutlookHeadline({ views, opp = null, pickFor }: { views: Views; opp?: string | null; pickFor?: (stat: OutlookStat, base: number | null) => ReactNode }) {
  const tiles = headlineTiles(views)
  const [open, setOpen] = useState<OutlookStat | null>(null)
  const band = missBand(views)
  const panel = useRef<HTMLDivElement>(null)
  // On a phone the panel sits below all seven tiles; bring it into view when a tile is opened.
  useEffect(() => {
    if (open) panel.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
  }, [open])
  return (
    <section className="flex flex-col gap-3 rounded-[18px] border border-(--border) bg-(--panel) p-5" style={panelStyle}>
      <h2 className="m-0 text-[20px] font-semibold tracking-tight" style={{ fontFamily: 'var(--display)' }}>
        What to expect
      </h2>
      <p className="m-0 max-w-3xl text-[14px] leading-relaxed text-(--muted)">
        Baseline: half his last-10 average, half his season average. It is a plain starting point, not a model, and it uses past games only (injuries and
        minutes changes are not in it). Typical miss is for {missBandText(band)}. Click a tile to see the games behind it.
      </p>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(128px,100%),1fr))] gap-3">
        {tiles.map((t) => (
          <button
            key={t.key}
            type="button"
            aria-expanded={open === t.key}
            onClick={() => setOpen((k) => (k === t.key ? null : t.key))}
            className="flex cursor-pointer flex-col gap-1 rounded-2xl border border-(--border) bg-transparent px-4 py-3 text-left text-(--text)"
            style={open === t.key ? { borderColor: 'var(--accent)' } : undefined}
          >
            <div className="text-xs font-semibold tracking-wider text-(--muted) uppercase">{t.label}</div>
            <div className="text-[34px] leading-none font-semibold tracking-tight text-(--num)" style={{ fontFamily: 'var(--display)' }}>
              {fmtOutlook(t.base, t.digits)}
            </div>
            <div className="text-[13px] text-(--muted)">typical miss ±{fmtOutlook(t.miss, t.digits)}</div>
            <div className="text-[13px] text-(--muted)">
              {t.lo === null || t.hi === null ? 'no recent games' : `last ${t.games}: ${fmtGame(t.lo)} to ${fmtGame(t.hi)}`}
            </div>
          </button>
        ))}
      </div>
      {open && (
        <div ref={panel} className="scroll-mt-4">
          <BehindPanel b={behindTile(views, open)} band={band} opp={opp} onClose={() => setOpen(null)} pick={pickFor?.(open, tiles.find((t) => t.key === open)?.base ?? null)} />
        </div>
      )}
    </section>
  )
}
