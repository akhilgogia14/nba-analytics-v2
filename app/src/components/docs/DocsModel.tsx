import { LAYER_TEXT, tablesIn, type Layer } from '../../lib/docs.ts'
import { Section } from './Section.tsx'
import { chip, dictLink } from './shared.ts'

const LAYERS: Layer[] = ['bronze', 'silver', 'gold']
const ENTITIES = [
  { name: 'Player', key: 'person_id', tables: ['player_form', 'player_season_games', 'player_season_position', 'player_game_log'], line: 'One id per player, the same in every table.' },
  { name: 'Team', key: 'team_id', tables: ['team_form', 'team_game_log', 'team_vs_opponent', 'game_context', 'game_slate'], line: 'One id per team. A game has two: home_team_id and away_team_id (or team_id and opponent_team_id).' },
  { name: 'Game', key: 'game_id', tables: ['game_slate', 'game_context', 'team_game_log', 'player_season_games', 'player_game_log'], line: 'A 10-digit id from the league. It joins a player\'s line, a team\'s line and the schedule row for the same game.' },
]

/** Data model: the three layers, what every table is about (player, team, game), and how the gold tables are keyed and built. */
export function DocsModel() {
  return (
    <>
      <Section
        title="Three layers"
        lead="Data moves left to right. Each layer is cleaner and more specific than the one before, and each table says which one it came from, so you can always trace a number back to the source file."
      >
        <div className="grid items-start gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))' }}>
          {LAYERS.map((layer, i) => (
            <div key={layer} className="flex flex-col gap-2 rounded-xl border border-(--border) px-4 py-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[16px] font-semibold" style={{ fontFamily: 'var(--display)' }}>
                  {i + 1}. {LAYER_TEXT[layer].title}
                </span>
                <span className="text-xs text-(--muted)">{LAYER_TEXT[layer].schema}</span>
              </div>
              <p className="m-0 text-[13px] leading-relaxed text-(--muted)">{LAYER_TEXT[layer].line}</p>
              <div className="flex flex-wrap gap-1.5">
                {tablesIn(layer).map((t) => (
                  <a key={t.name} href={dictLink(t.name)} className={`${chip} no-underline`}>
                    {t.name}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="m-0 text-[13px] text-(--muted)">Click any table name to see its columns in the data dictionary.</p>
      </Section>

      <Section title="Three things everything is about" lead="Every gold table is about a player, a team or a game, and carries the matching id. That id is how tables line up.">
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))' }}>
          {ENTITIES.map((e) => (
            <div key={e.name} className="flex flex-col gap-2 rounded-xl border border-(--border) px-4 py-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[16px] font-semibold" style={{ fontFamily: 'var(--display)' }}>
                  {e.name}
                </span>
                <code className="text-xs text-(--accent)">{e.key}</code>
              </div>
              <p className="m-0 text-[13px] leading-relaxed text-(--muted)">{e.line}</p>
              <div className="flex flex-wrap gap-1.5">
                {e.tables.map((t) => (
                  <a key={t} href={dictLink(t)} className={`${chip} no-underline`}>
                    {t}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="m-0 max-w-3xl text-[13px] leading-relaxed text-(--muted)">
          Two labels appear everywhere. <code>season</code> is the season by its end year (2027 is 2026-27), with <code>season_label</code> for people. <code>game_type</code> is regular-season, play-in, playoffs or nba-cup, and a row or an average never mixes kinds.
        </p>
      </Section>

      <Section title="The gold tables at a glance" lead="One row of this table is one thing in that table. The key is the column or columns that make a row unique.">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-[13px]">
            <thead>
              <tr className="text-xs tracking-wider text-(--muted) uppercase">
                <th className="py-2 pr-3 font-semibold">Table</th>
                <th className="py-2 pr-3 font-semibold">One row is</th>
                <th className="py-2 pr-3 font-semibold">Unique key</th>
                <th className="py-2 pr-3 font-semibold">Built from</th>
                <th className="py-2 font-semibold">Read by</th>
              </tr>
            </thead>
            <tbody>
              {tablesIn('gold').map((t) => (
                <tr key={t.name} className="border-t border-(--rowLine) align-top">
                  <td className="py-2 pr-3 font-semibold">
                    <a href={dictLink(t.name)} className="text-(--accent)">{t.name}</a>
                  </td>
                  <td className="py-2 pr-3 text-(--muted)">{t.grain}</td>
                  <td className="py-2 pr-3"><code>{t.key.join(', ')}</code></td>
                  <td className="py-2 pr-3 text-(--muted)">{t.from.join(', ')}</td>
                  <td className="py-2 text-(--muted)">{t.usedBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  )
}
