import { Fragment, useState } from 'react'
import {
  DEFENSE_STAT_LIST, barShare, defenseRows, defenseTotals, defendedGames, fmtDelta, fmtFigure, fmtRange, listRows, roleLabel, seasonSpan, THIN_PLAYER_GAMES, type DefenseRow,
} from '../lib/defense.ts'
import { KpiTiles } from './KpiTiles.tsx'
import { panelStyle, pillClass, pillStyle } from '../lib/styles.ts'
import type { DefenseStat, TeamDefense } from '../types.ts'

const cell = 'px-3 py-2 text-right text-[14px] tabular-nums whitespace-nowrap'
const head = 'px-3 py-2 text-right text-xs font-semibold tracking-wider text-(--muted) uppercase whitespace-nowrap'

/** One line of the list: the group, its per-game figure, and a bar from the league level (the centre line) to the right when the team gives up more, to the left when less. */
function ListRow({ r, digits, scale }: { r: DefenseRow; digits: number; scale: number }) {
  const w = barShare(r.diffPerGame, scale)
  const more = (r.diffPerGame ?? 0) > 0
  return (
    <li className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 border-t border-(--border) py-2 first:border-t-0 md:grid-cols-[170px_160px_1fr_72px]">
      <div className="text-[14px] font-semibold md:col-start-1 md:row-start-1">
        {roleLabel(r.role)} · {r.label}
      </div>
      <div className="order-3 col-span-2 text-[13px] text-(--muted) tabular-nums md:order-none md:col-span-1 md:col-start-2 md:row-start-1">
        {fmtFigure(r.perGame, digits)} <span className="text-xs">(league {fmtFigure(r.leaguePerGame, digits)})</span>
      </div>
      <div className="relative order-2 col-span-2 h-3 rounded-sm bg-(--track) md:order-none md:col-span-1 md:col-start-3 md:row-start-1" aria-hidden="true">
        <div className="absolute inset-y-0 left-1/2 w-px bg-(--muted)" />
        <div
          className="absolute inset-y-0 rounded-sm"
          style={{ width: `${w}%`, [more ? 'left' : 'right']: '50%', background: more ? 'var(--accent)' : 'var(--muted)', opacity: more ? 1 : 0.55 }}
        />
      </div>
      <div className="text-right text-[14px] font-semibold tabular-nums md:col-start-4 md:row-start-1">{fmtDelta(r.diffPerGame, digits)}</div>
    </li>
  )
}

function Row({ r, digits }: { r: DefenseRow; digits: number }) {
  const muted = r.thin ? ' text-(--muted)' : ''
  return (
    <tr className="border-t border-(--border)">
      <th scope="row" className={`px-3 py-2 text-left text-[14px] font-semibold whitespace-nowrap${muted}`}>
        {r.label}
        {r.thin && <span className="ml-2 text-xs font-normal">few</span>}
      </th>
      <td className={`${cell} text-(--muted)`}>{r.playerGames}</td>
      <td className={`${cell}${muted} font-semibold`}>{fmtFigure(r.perGame, digits)}</td>
      <td className={`${cell} text-(--muted)`}>{fmtFigure(r.leaguePerGame, digits)}</td>
      <td className={`${cell}${muted} font-semibold`}>{fmtDelta(r.diffPerGame, digits)}</td>
      <td className={`${cell} text-(--muted)`}>{fmtRange(r.low, r.high, digits)}</td>
      <td className={`${cell}${muted}`}>{fmtFigure(r.per36, 1)}</td>
      <td className={`${cell} text-(--muted)`}>{fmtFigure(r.leaguePer36, 1)}</td>
      <td className={`${cell}${muted}`}>{fmtDelta(r.diffPer36, 1)}</td>
    </tr>
  )
}

/**
 * Teams > Advanced stats: what the opposing players put up against this team, as starters and bench by the position the roster
 * lists for them. One stat at a time (the switch). The team's figures are its newest season; the league's are every team over every
 * season on record. Groups with only a few opposing player-games are tucked into a fold-out.
 */
export function DefenseGrid({ defense, error, onRetry }: { defense: TeamDefense | null; error: string; onRetry: () => void }) {
  const [stat, setStat] = useState<DefenseStat>('pts')
  const spec = DEFENSE_STAT_LIST.find((s) => s.key === stat) ?? DEFENSE_STAT_LIST[0]
  const rows = defense ? defenseRows(defense, stat) : []
  const n = defense ? defendedGames(defense) : 0
  const totals = defense ? defenseTotals(defense, stat) : { team: null, league: null, diff: null }
  const list = listRows(rows)
  return (
    <section className="flex flex-col gap-3 rounded-[18px] border border-(--border) bg-(--panel) p-5" style={panelStyle}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="m-0 text-[20px] font-semibold tracking-tight" style={{ fontFamily: 'var(--display)' }}>
          Defense by position
        </h2>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Defense stat">
          {DEFENSE_STAT_LIST.map((s) => (
            <button key={s.key} type="button" aria-pressed={s.key === stat} className={pillClass} style={pillStyle(s.key === stat)} onClick={() => setStat(s.key)}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="flex flex-wrap items-center gap-3 text-sm text-(--warnText)" role="alert">
          <span>{error}</span>
          <button type="button" onClick={onRetry} className="min-h-11 cursor-pointer rounded-full border border-(--warnBorder) px-4 font-semibold">
            Try again
          </button>
        </div>
      )}
      {!error && !defense && <div className="text-sm text-(--muted)">Loading defense by position...</div>}

      {defense && (
        <>
          <KpiTiles
            tiles={[
              { label: `Opposing ${spec.label.toLowerCase()} per game`, value: fmtFigure(totals.team, spec.digits) },
              { label: 'League average', value: fmtFigure(totals.league, spec.digits) },
              { label: 'Difference', value: fmtDelta(totals.diff, spec.digits) },
            ]}
            caption={`All opposing players together against this team in ${n} ${n === 1 ? 'game' : 'games'} (${seasonSpan(defense.team.firstSeason, defense.team.lastSeason) || 'this season'}), against the league (${seasonSpan(defense.league.firstSeason, defense.league.lastSeason)})`}
          />
          <p className="m-0 max-w-3xl text-[14px] leading-relaxed text-(--muted)">
            In five seasons of data, a team that gives up more than the league overall tends to keep doing so. What is specific to one position mostly does not repeat, so read the
            positions below as what has happened so far.
          </p>
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-xs font-semibold tracking-wider text-(--muted) uppercase">
              <span>Holds below the league</span>
              <span>Gives up more than the league</span>
            </div>
            {list.main.length === 0 ? (
              <div className="text-[14px] text-(--muted)">No group has {THIN_PLAYER_GAMES} or more opposing player-games yet.</div>
            ) : (
              <ul className="m-0 flex list-none flex-col p-0">
                {list.main.map((r) => (
                  <ListRow key={r.key} r={r} digits={spec.digits} scale={list.scale} />
                ))}
              </ul>
            )}
          </div>
          {list.small.length > 0 && (
            <details className="text-[14px] text-(--muted)">
              <summary className="min-h-11 cursor-pointer font-semibold text-(--text)">
                Show {list.small.length} small {list.small.length === 1 ? 'group' : 'groups'} (under {THIN_PLAYER_GAMES} opposing player-games)
              </summary>
              <ul className="m-0 mt-1 flex list-none flex-col gap-1 p-0">
                {list.small.map((r) => (
                  <li key={r.key} className="flex flex-wrap justify-between gap-2 tabular-nums">
                    <span>
                      {roleLabel(r.role)} · {r.label}
                    </span>
                    <span>{r.playerGames === 0 ? 'no player-games' : `${r.playerGames} player-games · ${fmtFigure(r.perGame, spec.digits)} per game (league ${fmtFigure(r.leaguePerGame, spec.digits)})`}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
          <details className="group text-[14px] leading-relaxed text-(--muted)">
            <summary className="min-h-11 cursor-pointer font-semibold text-(--text)">All the numbers</summary>
            <section className="mt-2 flex max-w-3xl flex-col gap-2">
              <strong className="text-(--text)">How to read this</strong>
              <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5">
                <li>
                  <strong className="text-(--text)">Rows:</strong> the opponent's players who started the game, and those who came off the bench, by the position the roster lists
                  (as written, so G-F is its own row). "Not listed" is a player the roster has no position for.
                </li>
                <li>
                  <strong className="text-(--text)">Per game:</strong> the group's combined total in one game against this team, averaged over all {n} games. A game where the group had nobody
                  counts as 0. The range is the 10th to 90th percentile of that total across games.
                </li>
                <li>
                  <strong className="text-(--text)">Per 36:</strong> the group's total per 36 minutes it played, which takes out how many minutes the group got.
                </li>
                <li>
                  <strong className="text-(--text)">Difference:</strong> this team minus the league for the same group. Positive means this team gives up more to that group.
                </li>
                <li>
                  <strong className="text-(--text)">Few:</strong> fewer than {THIN_PLAYER_GAMES} opposing player-games, so the row is a handful of games.
                </li>
              </ul>
            </section>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[860px] border-collapse">
                <thead>
                  <tr>
                    <th className={`${head} text-left`}>Group</th>
                    <th className={head}>Player-games</th>
                    <th className={head}>{spec.label} per game</th>
                    <th className={head}>League</th>
                    <th className={head}>Difference</th>
                    <th className={head}>Range</th>
                    <th className={head}>Per 36</th>
                    <th className={head}>League per 36</th>
                    <th className={head}>Difference</th>
                  </tr>
                </thead>
                <tbody>
                  {(['starter', 'bench'] as const).map((role) => (
                    <Fragment key={role}>
                      <tr className="border-t border-(--border)">
                        <th colSpan={9} scope="colgroup" className="px-3 pt-3 pb-1 text-left text-xs font-semibold tracking-wider text-(--accent) uppercase">
                          {roleLabel(role)}
                        </th>
                      </tr>
                      {rows.filter((r) => r.role === role).map((r) => (
                        <Row key={r.key} r={r} digits={spec.digits} />
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </section>
  )
}
