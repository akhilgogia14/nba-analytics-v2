import { complete, f1 } from '../lib/geom.ts'
import { LABELS, TABLE_STATS } from '../lib/format.ts'
import { panelStyle } from '../lib/styles.ts'
import type { ApiStat } from '../types.ts'

const COLUMNS = '2fr repeat(5, 1fr)'

export function CombosTable({ stats }: { stats: Record<string, ApiStat> }) {
  return (
    <div className="overflow-x-auto rounded-[18px] border border-(--border) bg-(--panel) p-5" style={panelStyle}>
      <div className="mb-2 text-sm font-semibold">Combined stats and minutes</div>
      <div className="min-w-[560px]">
        <div
          className="grid gap-2 border-b border-(--border) pb-1.5 text-xs text-(--muted)"
          style={{ gridTemplateColumns: COLUMNS }}
        >
          <span>Stat</span>
          <span>Last-10 average</span>
          <span>Median</span>
          <span>Middle 80%</span>
          <span>Low to high</span>
          <span>Season average</span>
        </div>
        {TABLE_STATS.map((key) => {
          const d = complete(stats[key])
          const season = stats[key]?.seasonMean ?? null
          return (
            <div
              key={key}
              className="grid gap-2 border-b border-(--rowLine) py-2.5 text-[15px]"
              style={{ gridTemplateColumns: COLUMNS }}
            >
              <span className="font-semibold">{LABELS[key]}</span>
              <span>{d ? f1(d.mean) : '–'}</span>
              <span>{d ? f1(d.median) : '–'}</span>
              <span>{d ? `${f1(d.p10)} to ${f1(d.p90)}` : '–'}</span>
              <span>{d ? `${f1(d.min)} to ${f1(d.max)}` : '–'}</span>
              <span>{season !== null ? f1(season) : '–'}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
