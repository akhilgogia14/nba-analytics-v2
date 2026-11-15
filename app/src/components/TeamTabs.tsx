import { hashFor, type View } from '../lib/pages.ts'
import { pillClass, pillStyle } from '../lib/styles.ts'

/** The two tabs of the Teams page. Plain links that carry the chosen team ("#/teams/advanced?team=BOS"), so the team stays chosen and the back button works. */
export function TeamTabs({ view, team }: { view: View; team: string }) {
  const link = (key: View, label: string) => (
    <a
      href={hashFor('teams', team, key)}
      aria-current={view === key ? 'page' : undefined}
      className={`${pillClass} inline-flex items-center no-underline`}
      style={pillStyle(view === key)}
    >
      {label}
    </a>
  )
  return (
    <nav aria-label="Teams view" className="flex items-center gap-2">
      {link('overview', 'Overview')}
      {link('advanced', 'Advanced stats')}
    </nav>
  )
}
