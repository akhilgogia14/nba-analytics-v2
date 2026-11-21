import type { ReactNode } from 'react'
import { panelStyle } from '../../lib/styles.ts'

/** A titled panel used by every Documentation page. */
export function Section({ title, children, lead }: { title: string; children: ReactNode; lead?: string }) {
  return (
    <section className="flex flex-col gap-3 rounded-[18px] border border-(--border) bg-(--panel) p-5" style={panelStyle}>
      <h2 className="m-0 text-[20px] font-semibold tracking-tight" style={{ fontFamily: 'var(--display)' }}>
        {title}
      </h2>
      {lead && <p className="m-0 max-w-3xl text-[14px] leading-relaxed text-(--muted)">{lead}</p>}
      {children}
    </section>
  )
}
