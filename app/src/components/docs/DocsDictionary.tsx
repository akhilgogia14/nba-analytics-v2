import { useState } from 'react'
import { ScrollX } from '../ScrollX.tsx'
import { LAYER_TEXT, searchTables, type DocTable, type Layer } from '../../lib/docs.ts'
import { Section } from './Section.tsx'
import { chip, inputStyleClass } from './shared.ts'

const queryFromHash = (hash: string): string => new URLSearchParams(hash.replace(/^#/, '').split('?')[1] ?? '').get('q') ?? ''

function TableCard({ table, columns, open }: { table: DocTable; columns: DocTable['columns']; open: boolean }) {
  return (
    <details open={open} className="rounded-xl border border-(--border) px-4 py-3">
      <summary className="cursor-pointer">
        <span className="text-[15px] font-semibold">{table.name}</span>
        <span className="ml-2 text-[13px] text-(--muted)">{table.grain}</span>
      </summary>
      <div className="mt-3 flex flex-col gap-3">
        <p className="m-0 max-w-3xl text-[14px] leading-relaxed">{table.purpose}</p>
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {table.key.length > 0 && <span className={chip}>Key: {table.key.join(', ')}</span>}
          {table.from.length > 0 && <span className={chip}>Built from: {table.from.join(', ')}</span>}
          <span className={chip}>Used by: {table.usedBy}</span>
        </div>
        {table.notes && (
          <ul className="m-0 flex max-w-3xl list-disc flex-col gap-1 pl-5 text-[13px] leading-relaxed text-(--muted)">
            {table.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        )}
        {columns.length > 0 && (
          <ScrollX>
            <table className="w-full min-w-[560px] border-collapse text-left text-[13px]">
              <thead>
                <tr className="text-xs tracking-wider text-(--muted) uppercase">
                  <th className="py-1.5 pr-3 font-semibold">Column</th>
                  <th className="py-1.5 pr-3 font-semibold">Type</th>
                  <th className="py-1.5 font-semibold">Meaning</th>
                </tr>
              </thead>
              <tbody>
                {columns.map((c) => (
                  <tr key={c.name} className="border-t border-(--rowLine) align-top">
                    <td className="py-1.5 pr-3 font-semibold whitespace-nowrap"><code>{c.name}</code></td>
                    <td className="py-1.5 pr-3 whitespace-nowrap text-(--muted)">{c.type}</td>
                    <td className="py-1.5">{c.meaning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollX>
        )}
      </div>
    </details>
  )
}

/** Data dictionary: every table and (for gold) every column, with a search box. A link such as #/docs/dictionary?q=game_slate opens it filtered. */
export function DocsDictionary({ hash }: { hash: string }) {
  const [typed, setTyped] = useState<string | null>(null)
  const query = typed ?? queryFromHash(hash)
  const found = searchTables(query)
  const searching = query.trim() !== ''
  const layers: Layer[] = ['gold', 'silver', 'bronze']
  return (
    <>
      <Section
        title="Data dictionary"
        lead="Gold tables list every column with its type and a plain meaning. Silver and bronze list the tables, what one row is and the rules applied. Type a word to search table names, columns and meanings."
      >
        <label className="flex flex-wrap items-center gap-2 text-[13px] text-(--muted)">
          Search
          <input
            type="search"
            value={query}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="for example: rest, minutes, game_id"
            aria-label="Search the data dictionary"
            className={inputStyleClass}
          />
        </label>
        {searching && <div className="text-[13px] text-(--muted)">{found.length} {found.length === 1 ? 'table matches' : 'tables match'}.</div>}
      </Section>

      {layers.map((layer) => {
        const rows = found.filter((f) => f.table.layer === layer)
        if (rows.length === 0) return null
        return (
          <Section key={layer} title={`${LAYER_TEXT[layer].title} · ${LAYER_TEXT[layer].schema}`} lead={LAYER_TEXT[layer].line}>
            <div className="flex flex-col gap-2">
              {rows.map((f) => (
                <TableCard key={`${f.table.name}-${searching}`} table={f.table} columns={f.columns} open={searching} />
              ))}
            </div>
          </Section>
        )
      })}
      {found.length === 0 && <p className="m-0 text-[14px] text-(--muted)">Nothing matches "{query}". Try a shorter word.</p>}
    </>
  )
}
