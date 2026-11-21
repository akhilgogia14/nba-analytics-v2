import { LOGOS, type LogoKey } from '../../lib/logos.ts'

/** A tool's logo in one colour (the page's text colour), decorative: the name always sits next to it. */
export function Logo({ name, size = 28 }: { name: LogoKey; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true" focusable="false" className="shrink-0 text-(--text) opacity-90">
      <path d={LOGOS[name]} />
    </svg>
  )
}
