import { useEffect, useRef, useState } from 'react'
import { complete, f1, geometry, shareSegments } from '../lib/geom.ts'
import { panelStyle } from '../lib/styles.ts'
import { markTips, shareTips, type Tip } from '../lib/tips.ts'
import type { ApiStat } from '../types.ts'

const pct = (n: number) => `${n}%`

/**
 * The small bubble: just the name and the number. It sits above the mark it describes; the colours come from the
 * theme's button pair. The longer explanation stays in the hit area's aria-label, for screen readers only.
 */
function Bubble({ tip }: { tip: Tip }) {
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute bottom-full z-20 mb-2 -translate-x-1/2 rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap shadow-lg"
      style={{ left: `${tip.left}%`, background: 'var(--pillOn)', color: 'var(--pillOnText)' }}
    >
      {tip.title}
    </div>
  )
}

const hitClass = 'absolute block cursor-help rounded-sm bg-transparent p-0 focus-visible:outline-2 focus-visible:outline-(--accent)'

export function Scorecard({ label, stat, games }: { label: string; stat: ApiStat | undefined; games: number | null }) {
  const d = complete(stat)
  const season = stat?.seasonMean ?? null
  const [tip, setTip] = useState<Tip | null>(null)
  const box = useRef<HTMLDivElement>(null)

  // A tap or click anywhere else closes the bubble (phones have no "mouse leave").
  useEffect(() => {
    if (!tip) return
    const away = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setTip(null)
    }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [tip])

  // Every hit area shows its bubble on hover, focus (keyboard) and tap, and hides it on leave, blur and Escape.
  const hit = (t: Tip) => ({
    onMouseEnter: () => setTip(t),
    onMouseLeave: () => setTip((cur) => (cur?.key === t.key ? null : cur)),
    onFocus: () => setTip(t),
    onBlur: () => setTip((cur) => (cur?.key === t.key ? null : cur)),
    onClick: () => setTip(t),
    onKeyDown: (e: React.KeyboardEvent) => e.key === 'Escape' && setTip(null),
    'aria-label': `${t.title}. ${t.text}`,
  })

  if (!d) {
    return (
      <div className="rounded-[18px] border border-(--border) bg-(--panel) p-5" style={panelStyle}>
        <div className="text-sm font-semibold">{label}</div>
        <div className="mt-3 text-sm text-(--muted)">No data for this stat.</div>
      </div>
    )
  }

  const g = geometry(d)
  const segments = shareSegments(stat?.shares ?? null)
  const [mean, median, band, range] = markTips(d, g, games)
  const shares = shareTips(segments)

  return (
    <div className="flex flex-col gap-3.5 rounded-[18px] border border-(--border) bg-(--panel) p-5" style={panelStyle}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold">{label}</span>
        {season !== null && <span className="text-xs text-(--muted)">Season avg {f1(season)}</span>}
      </div>

      <div className="flex items-baseline gap-2.5">
        <span
          className="text-[44px] leading-none font-semibold tracking-tight text-(--num)"
          style={{ fontFamily: 'var(--display)' }}
        >
          {f1(d.mean)}
        </span>
        <span className="text-[13px] text-(--muted)">average · median {f1(d.median)}</span>
      </div>

      <div ref={box} className="relative flex flex-col gap-1.5">
        {tip && <Bubble tip={tip} />}
        <div className="relative h-7">
          <div className="absolute inset-x-0 top-3 h-1 rounded-sm bg-(--track)" />
          <div
            className="absolute top-[13px] h-0.5 bg-(--whisker)"
            style={{ left: pct(g.minLeft), width: pct(g.minWidth) }}
          />
          <div
            className="absolute top-2 h-3 min-w-1.5 rounded-md bg-(--band)"
            style={{ left: pct(g.bandLeft), width: pct(g.bandWidth) }}
          />
          <div
            className="absolute top-[3px] -ml-px h-[22px] w-[3px] rounded-[1px] bg-(--median)"
            style={{ left: pct(g.medianLeft) }}
          />
          <div
            className="absolute top-[7px] -ml-[7px] box-border size-3.5 rounded-full border-2 border-(--ring) bg-(--dot)"
            style={{ left: pct(g.meanLeft) }}
          />
          {/* Invisible hit areas, lowest layer first so the small marks win where they overlap. */}
          <button type="button" className={`${hitClass} top-0 h-7 z-[1]`} style={{ left: pct(g.minLeft), width: pct(g.minWidth) }} {...hit(range)} />
          <button type="button" className={`${hitClass} top-0 h-7 z-[2]`} style={{ left: pct(g.bandLeft), width: pct(g.bandWidth), minWidth: 8 }} {...hit(band)} />
          <button type="button" className={`${hitClass} top-0 h-7 z-[3] -ml-2 w-4`} style={{ left: pct(g.medianLeft) }} {...hit(median)} />
          <button type="button" className={`${hitClass} top-0 h-7 z-[4] -ml-2 w-4`} style={{ left: pct(g.meanLeft) }} {...hit(mean)} />
        </div>
        <div className="flex justify-between gap-2 text-xs text-(--muted)">
          <span>low {f1(d.min)}</span>
          <span>
            middle 80%: {f1(d.p10)} to {f1(d.p90)}
          </span>
          <span>high {f1(d.max)}</span>
        </div>
      </div>

      {segments.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="text-xs text-(--muted)">Share of games with 0, 1, 2 or 3+</div>
          <div className="relative flex h-[26px] overflow-hidden rounded-lg">
            {segments.map((s, i) => (
              <button
                type="button"
                key={s.key}
                className="flex cursor-help items-center justify-center overflow-hidden border-0 p-0 text-xs font-semibold whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-(--accent)"
                style={{ width: pct(s.share * 100), background: `var(--s${s.index}b)`, color: `var(--s${s.index}t)` }}
                {...hit(shares[i])}
              >
                {s.text}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
