import { useState } from 'react'

/** `detail`, when given, makes the tile clickable: the text opens under the tiles (what the number is made of). */
export type KpiTile = { label: string; value: string; detail?: string }

/** A row of small tiles for quick reference: a label and one number each. Tiles with a `detail` open it when clicked. */
export function KpiTiles({ tiles, caption, minWidth = 116 }: { tiles: KpiTile[]; caption: string; minWidth?: number }) {
  const [open, setOpen] = useState<string | null>(null)
  const shown = tiles.find((t) => t.label === open && t.detail)
  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs font-semibold tracking-wider text-(--muted) uppercase">{caption}</div>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(min(${minWidth}px, 100%), 1fr))` }}>
        {tiles.map((t) => {
          const inner = (
            <>
              <div className="text-xs text-(--muted)">{t.label}</div>
              <div className={`${minWidth < 100 ? 'text-[17px]' : 'text-[20px]'} leading-tight font-semibold whitespace-nowrap tabular-nums text-(--num)`} style={{ fontFamily: 'var(--display)' }}>
                {t.value}
              </div>
            </>
          )
          const box = 'flex flex-col gap-0.5 rounded-xl border border-(--border) px-3 py-2'
          return t.detail ? (
            <button
              key={t.label}
              type="button"
              aria-expanded={open === t.label}
              onClick={() => setOpen((k) => (k === t.label ? null : t.label))}
              className={`${box} cursor-pointer bg-transparent text-left text-(--text)`}
              style={open === t.label ? { borderColor: 'var(--accent)' } : undefined}
            >
              {inner}
            </button>
          ) : (
            <div key={t.label} className={box}>
              {inner}
            </div>
          )
        })}
      </div>
      {shown && (
        <div className="rounded-xl border border-(--border) px-3 py-2 text-[14px] leading-relaxed" role="note">
          {shown.detail}
        </div>
      )}
    </div>
  )
}
