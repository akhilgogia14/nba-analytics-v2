import { useEffect, useState } from 'react'
import App from './App.tsx'
import { isAdvancedHash, pageFromHash } from './lib/pages.ts'
import TeamsAdvancedPage from './TeamsAdvancedPage.tsx'
import TeamsPage from './TeamsPage.tsx'
import TodayPage from './TodayPage.tsx'

/** Shows Today's games (the default), the Teams page ("#/teams") or the Player page ("#/players"), by the address. */
export default function Root() {
  const read = () => ({ page: pageFromHash(window.location.hash), advanced: isAdvancedHash(window.location.hash) })
  const [route, setRoute] = useState(read)
  useEffect(() => {
    const onChange = () => setRoute(read())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  if (route.page === 'today') return <TodayPage />
  if (route.page === 'teams') return route.advanced ? <TeamsAdvancedPage /> : <TeamsPage />
  return <App />
}
