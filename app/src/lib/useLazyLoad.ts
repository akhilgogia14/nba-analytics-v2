import { useEffect, useRef, useState } from 'react'

/**
 * Load something only once it is asked for (`request()`), and again when `key` changes after that (a different team or player).
 * `data` is null while loading or after a failure; `error` holds the failure text. Asking again after a failure retries.
 */
export function useLazyLoad<T>(key: string, load: () => Promise<T>): { data: T | null; error: string; request: () => void } {
  const [asked, setAsked] = useState(0) // 0 = never asked; each retry adds one
  const [state, setState] = useState<{ key: string; asked: number; data: T | null; error: string } | null>(null)
  const loader = useRef(load)
  useEffect(() => {
    loader.current = load
  })
  useEffect(() => {
    if (asked === 0) return
    let cancelled = false
    loader.current()
      .then((data) => !cancelled && setState({ key, asked, data, error: '' }))
      .catch(() => !cancelled && setState({ key, asked, data: null, error: 'Could not load the games. Close this and open it again.' }))
    return () => {
      cancelled = true
    }
  }, [key, asked])
  const here = state && state.key === key ? state : null
  return {
    data: here?.data ?? null,
    error: here?.error ?? '',
    request: () => setAsked((n) => (n === 0 || here?.error ? n + 1 : n)),
  }
}
