import { useEffect, useState, type CSSProperties } from 'react'
import { CourtBackground } from './components/CourtBackground.tsx'
import { DocsArchitecture } from './components/docs/DocsArchitecture.tsx'
import { DocsDictionary } from './components/docs/DocsDictionary.tsx'
import { DocsHome } from './components/docs/DocsHome.tsx'
import { DocsModel } from './components/docs/DocsModel.tsx'
import { DocsWorkflow } from './components/docs/DocsWorkflow.tsx'
import { PageSwitch } from './components/PageSwitch.tsx'
import { chartPalette } from './lib/hex.ts'
import { DOCS_TOPICS, docsTopicFromHash } from './lib/docs.ts'
import { parseHash } from './lib/pages.ts'
import { pillClass, pillStyle } from './lib/styles.ts'
import { readableOn } from './lib/teams.ts'
import { teamLook } from './lib/teamTheme.ts'
import { THEME } from './lib/themes.ts'

/**
 * Documentation: plain-language pages about the data behind the app. "Start here" has the short version and the common questions; Data model,
 * Data dictionary and Data workflow are the sub-pages (#/docs/model, #/docs/dictionary, #/docs/workflow). It reads nothing from the database:
 * the words live in lib/docs.ts.
 */
export default function DocsPage() {
  const [hash, setHash] = useState(() => window.location.hash)
  useEffect(() => {
    const onChange = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  const topic = docsTopicFromHash(hash)
  const current = DOCS_TOPICS.find((t) => t.key === topic) ?? DOCS_TOPICS[0]
  useEffect(() => {
    window.scrollTo(0, 0)
    document.title = topic === 'home' ? 'Documentation' : `${current.label} · Documentation`
  }, [topic, current.label])

  const team = parseHash(hash).team
  const look = teamLook(team)
  const bright = chartPalette(team).top
  const rootStyle = {
    ...THEME,
    ...look.vars,
    '--pillOn': bright,
    '--pillOnText': readableOn(bright),
    background: 'var(--bg)',
    color: 'var(--text)',
    fontFamily: 'Inter, system-ui, sans-serif',
  } as CSSProperties

  return (
    <div className="relative isolate min-h-screen px-6 pt-8 pb-14" style={rootStyle}>
      {look.wash !== 'none' && <div aria-hidden className="pointer-events-none fixed inset-0 -z-10" style={{ backgroundImage: look.wash }} />}
      <CourtBackground key={team} />
      <div className="mx-auto flex max-w-[1200px] flex-col gap-[26px]">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <div className="text-[22px] font-semibold tracking-tight" style={{ fontFamily: 'var(--display)' }}>
              Documentation
            </div>
            <div className="text-[13px] text-(--muted)">How the data behind this app is built, in plain words.</div>
          </div>
          <PageSwitch page="docs" team={team} />
        </header>

        <nav aria-label="Documentation sections" className="flex flex-wrap items-center gap-2">
          {DOCS_TOPICS.map((t) => (
            <a key={t.key} href={t.path} aria-current={t.key === topic ? 'page' : undefined} className={`${pillClass} inline-flex items-center no-underline`} style={pillStyle(t.key === topic)}>
              {t.label}
            </a>
          ))}
        </nav>

        {topic === 'home' && <DocsHome />}
        {topic === 'model' && <DocsModel />}
        {topic === 'dictionary' && <DocsDictionary hash={hash} />}
        {topic === 'workflow' && <DocsWorkflow />}
        {topic === 'architecture' && <DocsArchitecture />}
      </div>
    </div>
  )
}
