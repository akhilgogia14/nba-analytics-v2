import { OUTLOOK_STATS, VIEWS, baseline, fmtGame, fmtOutlook, missBand, missBandText, summarize, typicalMiss, type ViewKey, type Views } from '../lib/outlook.ts'
import { panelStyle } from '../lib/styles.ts'

const cell = 'px-3 py-2 text-right text-[14px] tabular-nums whitespace-nowrap'
const head = 'px-3 py-2 text-right text-xs font-semibold tracking-wider text-(--muted) uppercase whitespace-nowrap'
const SUB = ['Min', 'Avg', 'Max'] as const

/**
 * The next-game table: one row per stat, the baseline figure first, then the lowest, average and highest of each of the three views
 * of his past games. The "vs opponent" columns are muted: in the v1 back-test opponent history added almost nothing to the plain blend.
 */
export function OutlookTable({ views, opp }: { views: Views; opp: string | null }) {
  const band = missBand(views)
  const label = (k: ViewKey) => (k === 'opponent' ? (opp ? `Last 10 vs ${opp}` : 'Last 10 vs opponent') : (VIEWS.find((v) => v.key === k)?.label ?? k))
  return (
    <details className="group rounded-[18px] border border-(--border) bg-(--panel) p-5" style={panelStyle}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3">
        <span className="text-[20px] font-semibold tracking-tight" style={{ fontFamily: 'var(--display)' }}>
          All the numbers
        </span>
        <span className="text-[13px] text-(--muted) group-open:hidden">Show the full table</span>
        <span className="hidden text-[13px] text-(--muted) group-open:inline">Hide</span>
      </summary>
      <div className="mt-3 flex flex-col gap-3">
      <section className="flex max-w-3xl flex-col gap-2 text-[14px] leading-relaxed text-(--muted)">
        <strong className="text-(--text)">How to read this</strong>
        <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5">
          <li>
            <strong className="text-(--text)">Baseline:</strong> half his last-10 average, half his season average, a plain 50/50 split. It is a starting point, not a model.
          </li>
          <li>
            <strong className="text-(--text)">Typical miss:</strong> how far the baseline was from what happened, on average, when tested on 2025-26 and 2026-27 games (for {missBandText(band)}). It is
            an average over those players, so for someone who scores very little the real miss is smaller. Some games miss by more, some by less.
          </li>
          <li>
            <strong className="text-(--text)">Min, Avg, Max:</strong> the lowest, average and highest he has had in each set of games he played. Min and max are single games, so with few games they
            are wide and lumpy. The last 10 games and this season overlap early in a season.
          </li>
          <li>
            <strong className="text-(--text)">Vs the opponent</strong> (muted): his last 10 meetings, from any season. In the back-test, opponent history added almost nothing over the plain
            blend, so read it as context.
          </li>
        </ul>
      </section>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] border-collapse">
          <thead>
            <tr>
              <th rowSpan={2} className={`${head} text-left align-bottom`}>Stat</th>
              <th rowSpan={2} className={`${head} align-bottom`}>Baseline</th>
              <th rowSpan={2} className={`${head} align-bottom`}>Typical miss</th>
              {VIEWS.map((v) => (
                <th key={v.key} colSpan={3} scope="colgroup" className={`${head} border-l border-(--border) text-center${v.key === 'opponent' ? ' opacity-70' : ''}`}>
                  {label(v.key)} ({views[v.key].length})
                </th>
              ))}
            </tr>
            <tr>
              {VIEWS.flatMap((v) =>
                SUB.map((s, i) => (
                  <th key={`${v.key}-${s}`} className={`${head}${i === 0 ? ' border-l border-(--border)' : ''}${v.key === 'opponent' ? ' opacity-70' : ''}`}>
                    {s}
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {OUTLOOK_STATS.map((s) => {
              const sums = Object.fromEntries(VIEWS.map((v) => [v.key, summarize(views[v.key], s.key)])) as Record<ViewKey, ReturnType<typeof summarize>>
              const base = baseline(sums.last10, sums.season)
              return (
                <tr key={s.key} className="border-t border-(--border)">
                  <th scope="row" className="px-3 py-2 text-left text-[14px] font-semibold whitespace-nowrap">
                    {s.label}
                  </th>
                  <td className={`${cell} font-semibold`}>{fmtOutlook(base, s.digits)}</td>
                  <td className={`${cell} text-(--muted)`}>±{fmtOutlook(typicalMiss(s.key, band), s.digits)}</td>
                  {VIEWS.map((v) => {
                    const sum = sums[v.key]
                    const muted = v.key === 'opponent' ? ' text-(--muted)' : ''
                    if (!sum) {
                      return (
                        <td key={v.key} colSpan={3} className={`${cell} border-l border-(--border) text-center text-(--muted)`}>
                          {views[v.key].length === 0 ? 'no games' : 'no data'}
                        </td>
                      )
                    }
                    return [sum.min, sum.avg, sum.max].map((x, i) => (
                      <td key={`${v.key}-${i}`} className={`${cell}${muted}${i === 1 ? ' font-semibold' : ''}${i === 0 ? ' border-l border-(--border)' : ''}`}>
                        {i === 1 ? fmtOutlook(x, s.digits) : fmtGame(x)}
                      </td>
                    ))
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      </div>
    </details>
  )
}
