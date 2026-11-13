import { useEffect, useState } from 'react'

type Health = { ok: boolean; table?: string; rows?: number; lastGameDate?: string; error?: string }

export default function App() {
  const [health, setHealth] = useState<Health | null>(null)

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then(setHealth)
      .catch((e) => setHealth({ ok: false, error: String(e) }))
  }, [])

  return (
    <main className="min-h-screen bg-stone-100 p-8 text-stone-900">
      <h1 className="text-3xl font-semibold tracking-tight">Player form</h1>
      <p className="mt-2 text-stone-600">Hello-world check: can the app read the gold table?</p>
      <p className="mt-6 text-lg">
        {health === null && 'Asking the database (a sleeping warehouse can take a minute)...'}
        {health?.ok && (
          <>
            {health.table}: {health.rows?.toLocaleString()} rows, latest game {health.lastGameDate}
          </>
        )}
        {health && !health.ok && <span className="text-red-700">Failed: {health.error}</span>}
      </p>
    </main>
  )
}
