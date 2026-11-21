import { COMPONENTS, DECISIONS, PATHS, REQUEST_STEPS, SECURITY_LINES } from '../../lib/docs.ts'
import { Section } from './Section.tsx'

/** Architecture: the three paths through the system (data, request, release), what each component does and why, and the design decisions. */
export function DocsArchitecture() {
  return (
    <>
      <Section title="The big picture" lead="Three things happen in this system, and each has its own path. Read each row left to right (top to bottom on a phone).">
        <div className="flex flex-col gap-5">
          {PATHS.map((p) => (
            <div key={p.name} className="flex flex-col gap-2">
              <div className="flex flex-wrap items-baseline gap-x-3">
                <span className="text-[15px] font-semibold" style={{ fontFamily: 'var(--display)' }}>{p.name}</span>
                <span className="text-xs text-(--muted)">{p.when}</span>
              </div>
              <ol className="m-0 flex list-none flex-col gap-1 p-0 md:flex-row md:items-stretch md:gap-0">
                {p.nodes.map((n, i) => (
                  <li key={n.title} className="flex flex-col items-stretch gap-1 md:flex-1 md:flex-row md:items-center md:gap-0">
                    <div className="flex flex-1 flex-col gap-0.5 rounded-xl border border-(--border) px-3 py-2.5">
                      <span className="text-[14px] font-semibold">{n.title}</span>
                      <span className="text-xs leading-snug text-(--muted)">{n.sub}</span>
                    </div>
                    {i < p.nodes.length - 1 && (
                      <span aria-hidden className="self-center px-2 text-[18px] text-(--accent)">
                        <span className="md:hidden">↓</span>
                        <span className="hidden md:inline">→</span>
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </Section>

      <Section title="The pieces and why each one is here">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-[13px]">
            <thead>
              <tr className="text-xs tracking-wider text-(--muted) uppercase">
                <th className="py-2 pr-3 font-semibold">Piece</th>
                <th className="py-2 pr-3 font-semibold">What it does</th>
                <th className="py-2 font-semibold">Why this one</th>
              </tr>
            </thead>
            <tbody>
              {COMPONENTS.map((c) => (
                <tr key={c.name} className="border-t border-(--rowLine) align-top">
                  <td className="py-2 pr-3 font-semibold">{c.name}</td>
                  <td className="py-2 pr-3">{c.role}</td>
                  <td className="py-2 text-(--muted)">{c.why}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="What happens when you click" lead="The request path, in five steps. Most clicks never reach the database, because the server remembers recent answers.">
        <ol className="m-0 flex list-none flex-col gap-3 p-0">
          {REQUEST_STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-3">
              <span className="grid size-7 shrink-0 place-items-center rounded-full text-[13px] font-semibold" style={{ background: 'var(--pillOn)', color: 'var(--pillOnText)' }}>{i + 1}</span>
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-[15px] font-semibold">{s.title}</span>
                <span className="max-w-3xl text-[14px] leading-relaxed text-(--muted)">{s.text}</span>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Design decisions and trade-offs" lead="The choices that shape everything else, and what each one costs.">
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))' }}>
          {DECISIONS.map((d) => (
            <div key={d.title} className="flex flex-col gap-1 rounded-xl border border-(--border) px-4 py-3">
              <span className="text-[15px] font-semibold">{d.title}</span>
              <span className="text-[13px] leading-relaxed text-(--muted)">{d.text}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Access and secrets">
        <ul className="m-0 flex max-w-3xl list-disc flex-col gap-1.5 pl-5 text-[14px] leading-relaxed">
          {SECURITY_LINES.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </Section>
    </>
  )
}
