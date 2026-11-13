import type { CSSProperties } from 'react'

/** Shadow and frosted-glass blur come from the theme; some themes set them to "none". */
export const panelStyle: CSSProperties = { boxShadow: 'var(--shadow)', backdropFilter: 'var(--blur)' }

/** The round buttons used for the page's toggle and the chart's pickers. The selected one takes the team colour (--pillOn). */
export const pillClass = 'min-h-9 cursor-pointer rounded-full border border-(--pillBorder) px-3.5 text-[13px] font-semibold'
export const pillStyle = (on: boolean): CSSProperties => ({
  background: on ? 'var(--pillOn)' : 'var(--pill)',
  color: on ? 'var(--pillOnText)' : 'var(--pillText)',
})
