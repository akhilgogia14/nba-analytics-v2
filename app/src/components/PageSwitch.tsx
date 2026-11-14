import { hashFor, type Page } from '../lib/pages.ts'
import { pillClass, pillStyle } from '../lib/styles.ts'

/** The two page buttons in the header. They are plain links that carry the chosen team ("#/players?team=BOS"), so the team stays chosen on the other page; being plain links, the back button and a bookmark work. */
export function PageSwitch({ page, team }: { page: Page; team: string }) {
  const link = (key: Page, label: string) => (
    <a
      href={hashFor(key, team)}
      aria-current={page === key ? 'page' : undefined}
      className={`${pillClass} inline-flex items-center no-underline`}
      style={pillStyle(page === key)}
    >
      {label}
    </a>
  )
  return (
    <nav aria-label="Page" className="flex items-center gap-2">
      {link('players', 'Players')}
      {link('teams', 'Teams')}
    </nav>
  )
}
