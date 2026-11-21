import { ARCH_SUMMARY, COMPONENTS, CROSS, DECISIONS, METRICS, REQUEST_STEPS, SECURITY_LINES, STAGES, type Tile } from '../../lib/docs.ts'
import { Logo } from './Logo.tsx'
import { Section } from './Section.tsx'

const eyebrow = 'text-[11px] font-semibold tracking-[0.18em] text-(--muted) uppercase'
const CHEVRON = 'polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%, 14px 50%)'

function TileBox({ t }: { t: Tile }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-(--border) px-3.5 py-3">
      <Logo name={t.logo} />
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[14px] leading-tight font-semibold">{t.title}</span>
        <span className="text-xs leading-snug text-(--muted)">{t.sub}</span>
      </div>
    </div>
  )
}

/** Architecture, laid out like a consulting deck: a headline, key numbers, the system on one page, then the evidence under each claim. */
export function DocsArchitecture() {
  return (
    <>
      <section className="flex flex-col gap-5 rounded-[18px] border border-(--border) bg-(--panel) p-6 md:p-8">
        <div className={eyebrow}>System architecture</div>
        <h2 className="m-0 max-w-3xl text-[26px] leading-tight font-semibold tracking-tight md:text-[32px]" style={{ fontFamily: 'var(--display)' }}>
          {ARCH_SUMMARY}
        </h2>
        <dl className="m-0 grid gap-x-6 gap-y-4 border-t border-(--rowLine) pt-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(150px, 100%), 1fr))' }}>
          {METRICS.map((m) => (
            <div key={m.label} className="flex flex-col gap-1">
              <dt className="text-[24px] leading-none font-semibold text-(--num) tabular-nums" style={{ fontFamily: 'var(--display)' }}>{m.value}</dt>
              <dd className="m-0 text-xs leading-snug text-(--muted)">{m.label}</dd>
            </div>
          ))}
        </dl>
      </section>

      <Section title="Data flows through five stages, with four safeguards underneath" lead="Read left to right (top to bottom on a phone). Each stage hands a cleaner, smaller thing to the next.">
        <div className="grid gap-4 md:grid-cols-5 md:gap-2">
          {STAGES.map((s) => (
            <div key={s.n} className="flex flex-col gap-2">
              <div
                className="flex items-center gap-2 px-5 py-2 text-[12px] font-semibold tracking-[0.14em] uppercase md:px-4"
                style={{ clipPath: CHEVRON, background: 'color-mix(in srgb, var(--pillOn) 22%, transparent)' }}
              >
                <span className="text-(--accent)">{s.n}</span>
                <span>{s.name}</span>
              </div>
              {s.tiles.map((t) => (
                <TileBox key={t.title} t={t} />
              ))}
            </div>
          ))}
        </div>
        <div className="mt-2 flex flex-col gap-2 border-t border-(--rowLine) pt-4">
          <div className={eyebrow}>Underneath all five</div>
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))' }}>
            {CROSS.map((t) => (
              <TileBox key={t.title} t={t} />
            ))}
          </div>
        </div>
      </Section>

      <Section title="Nine pieces, each chosen for a reason" lead="What each one does, and why it is the one we use.">
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))' }}>
          {COMPONENTS.map((c) => (
            <div key={c.name} className="flex flex-col gap-2 rounded-xl border border-(--border) px-4 py-3.5">
              <div className="flex items-center gap-2.5">
                <Logo name={c.logo} size={24} />
                <span className="text-[15px] leading-tight font-semibold">{c.name}</span>
              </div>
              <p className="m-0 text-[13px] leading-relaxed">{c.role}</p>
              <p className="m-0 border-t border-(--rowLine) pt-2 text-[13px] leading-relaxed text-(--muted)">
                <span className="font-semibold text-(--text)">Why: </span>
                {c.why}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Most clicks never reach the database" lead="One click, five steps. The server remembers recent answers, so only the first asker in five minutes waits for Databricks.">
        <ol className="m-0 grid list-none gap-3 p-0" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(190px, 100%), 1fr))' }}>
          {REQUEST_STEPS.map((s, i) => (
            <li key={s.title} className="flex flex-col gap-1.5 border-t-2 border-(--accent) pt-3">
              <span className="text-[12px] font-semibold tracking-[0.14em] text-(--accent) uppercase">Step {i + 1}</span>
              <span className="text-[15px] leading-tight font-semibold">{s.title}</span>
              <span className="text-[13px] leading-relaxed text-(--muted)">{s.text}</span>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Eight design decisions, and what each one costs" lead="Every choice trades something. The cost is stated next to it.">
        <div className="flex flex-col">
          {DECISIONS.map((d, i) => (
            <div key={d.title} className="grid gap-x-6 gap-y-1.5 border-t border-(--rowLine) py-4 first:border-t-0 md:grid-cols-[minmax(0,1.1fr)_minmax(0,2fr)_minmax(0,1.2fr)]">
              <div className="flex items-baseline gap-2.5">
                <span className="text-[13px] font-semibold text-(--accent) tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                <span className="text-[15px] leading-tight font-semibold">{d.title}</span>
              </div>
              <p className="m-0 text-[13px] leading-relaxed">
                <span className={`${eyebrow} mr-2 md:hidden`}>We chose</span>
                {d.choice}
              </p>
              <p className="m-0 text-[13px] leading-relaxed text-(--muted)">
                <span className={`${eyebrow} mr-2`}>Cost</span>
                {d.cost}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="The app can read, and nothing more" lead="Access is narrow on purpose.">
        <ul className="m-0 grid list-none gap-3 p-0" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(250px, 100%), 1fr))' }}>
          {SECURITY_LINES.map((l) => (
            <li key={l} className="rounded-xl border border-(--border) px-4 py-3 text-[13px] leading-relaxed">
              {l}
            </li>
          ))}
        </ul>
        <p className="m-0 max-w-3xl text-[11px] leading-relaxed text-(--muted)">
          Logos are trademarks of their owners and appear only to say which tool is which. Icons from Simple Icons (CC0). Slack, Quality and Access use plain icons, not brand marks.
        </p>
      </Section>
    </>
  )
}
