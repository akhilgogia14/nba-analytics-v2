import { fmtOutlook, headlineTiles, missBand, missBandText, type Views } from '../lib/outlook.ts'
import { panelStyle } from '../lib/styles.ts'

/**
 * The answer first: one tile per stat with the baseline as the big number, how far off it typically was in the back-test, and the
 * lowest to highest of his last 10 games. The figures are the same ones the full table and the charts show further down.
 */
export function OutlookHeadline({ views }: { views: Views }) {
  const tiles = headlineTiles(views)
  return (
    <section className="flex flex-col gap-3 rounded-[18px] border border-(--border) bg-(--panel) p-5" style={panelStyle}>
      <h2 className="m-0 text-[20px] font-semibold tracking-tight" style={{ fontFamily: 'var(--display)' }}>
        What to expect
      </h2>
      <p className="m-0 max-w-3xl text-[14px] leading-relaxed text-(--muted)">
        Baseline: half his last-10 average, half his season average. It is a plain starting point, not a model, and it uses past games only (injuries and
        minutes changes are not in it). Typical miss is for {missBandText(missBand(views))}.
      </p>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(128px,100%),1fr))] gap-3">
        {tiles.map((t) => (
          <div key={t.key} className="flex flex-col gap-1 rounded-2xl border border-(--border) px-4 py-3">
            <div className="text-xs font-semibold tracking-wider text-(--muted) uppercase">{t.label}</div>
            <div className="text-[34px] leading-none font-semibold tracking-tight text-(--num)" style={{ fontFamily: 'var(--display)' }}>
              {fmtOutlook(t.base, t.digits)}
            </div>
            <div className="text-[13px] text-(--muted)">typical miss ±{fmtOutlook(t.miss, t.digits)}</div>
            <div className="text-[13px] text-(--muted)">
              {t.lo === null || t.hi === null ? 'no recent games' : `last ${t.games}: ${fmtOutlook(t.lo, t.digits)} to ${fmtOutlook(t.hi, t.digits)}`}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
