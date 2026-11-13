import type { CSSProperties } from 'react'

/** Shadow and frosted-glass blur come from the theme; some themes set them to "none". */
export const panelStyle: CSSProperties = { boxShadow: 'var(--shadow)', backdropFilter: 'var(--blur)' }
