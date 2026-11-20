export type KpiTile = { label: string; value: string }

/** A row of small tiles for quick reference: a label and one number each (used for the league pattern above each table). */
export function KpiTiles({ tiles, caption, minWidth = 116 }: { tiles: KpiTile[]; caption: string; minWidth?: number }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs font-semibold tracking-wider text-(--muted) uppercase">{caption}</div>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(min(${minWidth}px, 100%), 1fr))` }}>
        {tiles.map((t) => (
          <div key={t.label} className="flex flex-col gap-0.5 rounded-xl border border-(--border) px-3 py-2">
            <div className="text-xs text-(--muted)">{t.label}</div>
            <div className={`${minWidth < 100 ? 'text-[17px]' : 'text-[20px]'} leading-tight font-semibold whitespace-nowrap tabular-nums text-(--num)`} style={{ fontFamily: 'var(--display)' }}>
              {t.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
