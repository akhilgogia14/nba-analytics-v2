import { complete, f1, geometry, shareSegments } from '../lib/geom.ts'
import { panelStyle } from '../lib/styles.ts'
import type { ApiStat } from '../types.ts'

const pct = (n: number) => `${n}%`

export function Scorecard({ label, stat }: { label: string; stat: ApiStat | undefined }) {
  const d = complete(stat)
  const season = stat?.seasonMean ?? null

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

      <div className="flex flex-col gap-1.5">
        <div className="relative h-7" role="img" aria-label={`${label}: middle 80% of games from ${f1(d.p10)} to ${f1(d.p90)}`}>
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
          <div className="flex h-[26px] overflow-hidden rounded-lg">
            {segments.map((s) => (
              <div
                key={s.key}
                title={s.title}
                className="flex items-center justify-center overflow-hidden text-xs font-semibold whitespace-nowrap"
                style={{ width: pct(s.share * 100), background: `var(--s${s.index}b)`, color: `var(--s${s.index}t)` }}
              >
                {s.text}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
