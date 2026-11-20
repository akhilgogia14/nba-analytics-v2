import { currentOpp, hashFor, type Page, type View } from '../lib/pages.ts'
import { pillClass, pillStyle } from '../lib/styles.ts'

/** The two tabs of the Teams page and of the Players page. Plain links that carry the chosen team (and player), so the choice stays and the back button works. */
export function TeamTabs({ view, team, page = 'teams', player = '', opp = currentOpp() }: { view: View; team: string; page?: Extract<Page, 'teams' | 'players'>; player?: string; opp?: string }) {
  const link = (key: View, label: string) => (
    <a
      href={hashFor(page, team, key, player, opp)}
      aria-current={view === key ? 'page' : undefined}
      className={`${pillClass} inline-flex items-center no-underline`}
      style={pillStyle(view === key)}
    >
      {label}
    </a>
  )
  return (
    <nav aria-label={page === 'players' ? 'Players view' : 'Teams view'} className="flex items-center gap-2">
      {link('overview', 'Overview')}
      {link('advanced', 'Advanced stats')}
    </nav>
  )
}
