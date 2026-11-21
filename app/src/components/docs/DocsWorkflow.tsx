import { SCHEDULE_LINES, WORKFLOW } from '../../lib/docs.ts'
import { Section } from './Section.tsx'

/** Data workflow: the seven steps from the source to the page, when it runs, and what happens when something is wrong. */
export function DocsWorkflow() {
  return (
    <>
      <Section title="From a finished game to a number on a page" lead="Seven steps, run in order. Each one checks its own work and stops the line if something is wrong, so a bad file cannot quietly reach a page.">
        <ol className="m-0 flex list-none flex-col gap-0 p-0">
          {WORKFLOW.map((s, i) => (
            <li key={s.n} className="flex gap-4">
              <div className="flex flex-col items-center">
                <span className="grid size-8 shrink-0 place-items-center rounded-full text-[14px] font-semibold" style={{ background: 'var(--pillOn)', color: 'var(--pillOnText)' }}>
                  {s.n}
                </span>
                {i < WORKFLOW.length - 1 && <span aria-hidden className="my-1 w-px flex-1 bg-(--border)" />}
              </div>
              <div className="flex min-w-0 flex-col gap-1 pb-6">
                <div className="text-[16px] font-semibold" style={{ fontFamily: 'var(--display)' }}>{s.title}</div>
                <div className="text-xs text-(--muted)">{s.where}</div>
                <p className="m-0 max-w-3xl text-[14px] leading-relaxed">{s.what}</p>
                <p className="m-0 max-w-3xl text-[13px] leading-relaxed text-(--muted)">
                  <span className="font-semibold">The check: </span>
                  {s.check}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="When it runs">
        <ul className="m-0 flex max-w-3xl list-disc flex-col gap-1.5 pl-5 text-[14px] leading-relaxed">
          {SCHEDULE_LINES.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </Section>

      <Section title="When something looks wrong" lead="Two kinds of check run on every table, and both leave a trail.">
        <ul className="m-0 flex max-w-3xl list-disc flex-col gap-1.5 pl-5 text-[14px] leading-relaxed">
          <li>
            <span className="font-semibold">A gate</span> is a rule that must hold (a key is unique, a total adds up). If a gate fails the run stops, and the pages keep showing the last good data.
          </li>
          <li>
            <span className="font-semibold">A warning</span> is an oddity worth a look that does not stop anything (for example a game held back for an impossible minutes total). Warnings are written to a table named <code>_data_warnings</code>.
          </li>
          <li>
            Every table also writes a line to <code>_build_log</code> with how many rows were inserted, updated and deleted. A build that would delete more than 1% of a table stops unless a person allows it.
          </li>
        </ul>
      </Section>
    </>
  )
}
