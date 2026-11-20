import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * A box that scrolls sideways when its content is wider than the screen, and says so: a soft fade on the right edge and a small
 * "Swipe for more" note show only while there is more to the right, and go away at the end (or when everything fits).
 */
export function ScrollX({ children, className = '' }: { children: ReactNode; className?: string }) {
  const box = useRef<HTMLDivElement>(null)
  const [more, setMore] = useState(false)
  const check = useCallback(() => {
    const el = box.current
    if (el) setMore(el.scrollWidth - el.clientWidth - el.scrollLeft > 4)
  }, [])
  useEffect(() => {
    const el = box.current
    if (!el) return
    check()
    const watch = new ResizeObserver(check)
    watch.observe(el)
    if (el.firstElementChild) watch.observe(el.firstElementChild)
    return () => watch.disconnect()
  }, [check])
  return (
    <div className={`relative ${className}`}>
      <div ref={box} onScroll={check} className="overflow-x-auto">
        {children}
      </div>
      {more && (
        <>
          <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-linear-to-l from-(--panel) to-transparent" />
          <div aria-hidden="true" className="pointer-events-none absolute right-1 bottom-1 rounded-full bg-(--pillOn) px-2 py-0.5 text-[11px] text-(--pillOnText) opacity-90">
            Swipe for more →
          </div>
        </>
      )}
    </div>
  )
}
