import { currentOpp, hashFor, type Page } from '../lib/pages.ts'
import { pillClass, pillStyle } from '../lib/styles.ts'

/** The page buttons in the header. They are plain links that carry the chosen team ("#/players?team=BOS"), so the team stays chosen on the other page; being plain links, the back button and a bookmark work. */
export function PageSwitch({ page, team, opp = currentOpp() }: { page: Page; team: string; opp?: string }) {
  const link = (key: Page, label: string) => (
    <a
      href={hashFor(key, team, 'overview', '', opp)}
      aria-current={page === key ? 'page' : undefined}
      className={`${pillClass} inline-flex items-center no-underline`}
      style={pillStyle(page === key)}
    >
      {label}
    </a>
  )
  return (
    <nav aria-label="Page" className="flex flex-wrap items-center gap-2">
      {link('today', "Today's games")}
      {link('teams', 'Teams')}
      {link('players', 'Players')}
      {link('predictions', 'Predictions')}
      {link('picks', 'Picks')}
      <a href="#/docs" aria-current={page === 'docs' ? 'page' : undefined} className={`${pillClass} inline-flex items-center no-underline`} style={pillStyle(page === 'docs')}>
        Documentation
      </a>
    </nav>
  )
}
