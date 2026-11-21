import { DOCS_TOPICS, FAQ } from '../../lib/docs.ts'
import { Section } from './Section.tsx'
import { chip } from './shared.ts'

/** The start page: what this is, where to go next, and the common questions. */
export function DocsHome() {
  return (
    <>
      <Section
        title="The short version"
        lead="Every day the pipeline copies the league's published box scores and schedule into our own storage, cleans them in three steps, and shapes them into a small set of tables. The pages in this app read only the last, shaped layer. Nothing on a page is typed in by hand."
      >
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))' }}>
          {DOCS_TOPICS.filter((t) => t.key !== 'home').map((t) => (
            <a key={t.key} href={t.path} className="flex flex-col gap-1 rounded-xl border border-(--border) px-4 py-3 no-underline">
              <span className="text-[15px] font-semibold text-(--accent)">{t.label}</span>
              <span className="text-[13px] leading-relaxed text-(--muted)">{t.blurb}</span>
            </a>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-(--muted)">
          <span className={chip}>Source: sportsdataverse (MIT, CC BY 4.0)</span>
          <span className={chip}>Seasons 2021-22 onward</span>
          <span className={chip}>Updated daily, no live scoring</span>
        </div>
      </Section>

      <Section title="Common questions">
        <div className="flex flex-col">
          {FAQ.map((f) => (
            <details key={f.q} className="border-t border-(--rowLine) py-3 first:border-t-0">
              <summary className="cursor-pointer text-[15px] font-semibold">{f.q}</summary>
              <p className="m-0 mt-2 max-w-3xl text-[14px] leading-relaxed text-(--muted)">{f.a}</p>
            </details>
          ))}
        </div>
      </Section>
    </>
  )
}
