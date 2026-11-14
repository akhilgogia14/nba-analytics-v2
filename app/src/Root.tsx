import { useEffect, useState } from 'react'
import App from './App.tsx'
import { pageFromHash } from './lib/pages.ts'
import TeamsPage from './TeamsPage.tsx'

/** Shows the Player page or the Teams page, by the address ("#/teams" = Teams; anything else = Players). */
export default function Root() {
  const [page, setPage] = useState(() => pageFromHash(window.location.hash))
  useEffect(() => {
    const onChange = () => setPage(pageFromHash(window.location.hash))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return page === 'teams' ? <TeamsPage /> : <App />
}
