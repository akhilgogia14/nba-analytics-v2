import { useState } from 'react'
import { TEAM_NAMES } from '../lib/format.ts'
import { ordinal } from '../lib/context.ts'
import { hashFor } from '../lib/pages.ts'
import { panelStyle } from '../lib/styles.ts'
import { defenseSummary, fmtRank, rankOf, recordText, standings, statByKey, strengthsAndWeaknesses, verdictLine, type TeamRank } from '../lib/teamSummary.ts'
import { roleLabel } from '../lib/defense.ts'
import type { GameType, TeamDefense, TeamRanking } from '../types.ts'

const FEW_GAMES = 20
/** The size of a gap without its sign (the words say above or below): 5.6. */
const fmtGap = (v: number | null): string => (v === null ? '-' : Math.abs(v).toFixed(1))

/** The full ranking of one stat: every team best first, this team highlighted, each linking to its own page. */
function RankingList({ ranking, team, statKey }: { ranking: TeamRanking; team: string; statKey: string }) {
  const stat = statByKey(statKey)
  const rows = standings(ranking.teams, stat)
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-(--border) p-3" role="region" aria-label={`${stat.label}: every team`}>
      <div className="text-xs font-semibold tracking-wider text-(--muted) uppercase">
        {stat.label} per game, best first{stat.lowerIsBetter ? ' (fewer is better)' : ''}
      </div>
      <ol className="m-0 flex max-h-80 list-none flex-col overflow-y-auto p-0">
        {rows.map((r) => (
          <li key={r.team} className="grid grid-cols-[2rem_1fr_auto] items-center gap-2 border-t border-(--border) py-1 text-[14px] first:border-t-0" style={r.team === team ? { color: 'var(--accent)', fontWeight: 600 } : undefined}>
            <span className="tabular-nums text-(--muted)">{r.rank}</span>
            <a href={hashFor('teams', r.team)} className="min-w-0 truncate text-inherit no-underline hover:underline">
              {TEAM_NAMES[r.team] ?? r.team}
            </a>
            <span className="tabular-nums">{fmtRank(stat, r.value)}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

/**
 * Teams overview: how the team stacks up this season, in plain words. The record, points scored, points allowed and scoring margin
 * with each one's rank among the teams (click one to see every team), a one-line verdict on offense and defense, the stats it is
 * strongest and weakest at, and the positions it gives up the most points to (the Defense grid's own ranked list). Ranks are per
 * game over the season so far, so early in the season they move a lot (the card says so).
 */
export function TeamSummary({ team, name, gameType, ranking, defense }: { team: string; name: string; gameType: GameType; ranking: TeamRanking | null; defense: TeamDefense | null }) {
  const [open, setOpen] = useState<string | null>(null)
  const mine = ranking?.teams.find((t) => t.team === team)
  if (!ranking || !mine) return null
  const off = rankOf(ranking.teams, team, statByKey('pts'))
  const def = rankOf(ranking.teams, team, statByKey('allowed'))
  const margin = rankOf(ranking.teams, team, statByKey('margin'))
  const { best, worst } = strengthsAndWeaknesses(ranking.teams, team)
  const d = defense ? defenseSummary(defense) : null
  const of = off?.of ?? ranking.teams.length
  const tile = (key: string, r: TeamRank | null) => {
    const stat = statByKey(key)
    return (
      <button
        key={key}
        type="button"
        aria-expanded={open === key}
        onClick={() => setOpen((k) => (k === key ? null : key))}
        disabled={!r}
        className="flex cursor-pointer flex-col gap-0.5 rounded-xl border border-(--border) bg-transparent px-3 py-2 text-left text-(--text)"
        style={open === key ? { borderColor: 'var(--accent)' } : undefined}
      >
        <span className="text-xs text-(--muted)">{stat.label}</span>
        <span className="text-[22px] leading-tight font-semibold tabular-nums text-(--num)" style={{ fontFamily: 'var(--display)' }}>
          {r ? fmtRank(stat, r.value) : '-'}
        </span>
        <span className="text-xs text-(--muted)">{r ? `${ordinal(r.rank)} of ${r.of}` : 'no figure'}</span>
      </button>
    )
  }
  const chip = (r: TeamRank) => (
    <button
      key={r.stat.key}
      type="button"
      aria-expanded={open === r.stat.key}
      onClick={() => setOpen((k) => (k === r.stat.key ? null : r.stat.key))}
      className="min-h-9 cursor-pointer rounded-full border border-(--pillBorder) bg-(--pill) px-3 text-[13px] font-semibold text-(--pillText)"
    >
      {r.stat.label} · {ordinal(r.rank)}
    </button>
  )
  return (
    <section className="flex flex-col gap-3 rounded-[18px] border border-(--border) bg-(--panel) p-5" style={panelStyle} aria-label={`How ${name} stacks up`}>
      <div className="flex flex-col gap-0.5">
        <h2 className="m-0 text-[20px] font-semibold tracking-tight" style={{ fontFamily: 'var(--display)' }}>
          How {name} stacks up
        </h2>
        <div className="text-xs text-(--muted)">
          {ranking.seasonLabel} {gameType === 'playoffs' ? 'playoffs' : 'regular season'}, per game, ranked among {of} teams · click a figure to see every team
        </div>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(130px,100%),1fr))] gap-2">
        <div className="flex flex-col gap-0.5 rounded-xl border border-(--border) px-3 py-2">
          <span className="text-xs text-(--muted)">Record</span>
          <span className="text-[22px] leading-tight font-semibold tabular-nums text-(--num)" style={{ fontFamily: 'var(--display)' }}>
            {recordText(mine)}
          </span>
          <span className="text-xs text-(--muted)">{mine.games} games</span>
        </div>
        {tile('pts', off)}
        {tile('allowed', def)}
        {tile('margin', margin)}
      </div>
      {open && <RankingList ranking={ranking} team={team} statKey={open} />}
      <p className="m-0 max-w-3xl text-[15px] leading-relaxed">{verdictLine(off, def)}</p>
      {(best.length > 0 || worst.length > 0) && (
        <div className="flex flex-col gap-2 text-[14px]">
          {best.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-(--muted)">Strongest at</span>
              {best.map(chip)}
            </div>
          )}
          {worst.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-(--muted)">Weakest at</span>
              {worst.map(chip)}
            </div>
          )}
        </div>
      )}
      {d && (d.gives.length > 0 || d.holds.length > 0) && (
        <p className="m-0 max-w-3xl text-[14px] leading-relaxed">
          {d.gives.length > 0 && (
            <>
              <strong>Gives up the most points to</strong>{' '}
              {d.gives.map((r) => `${roleLabel(r.role)} · ${r.label} (${fmtGap(r.diffPerGame)} points a game above the league)`).join(', ')}.{' '}
            </>
          )}
          {d.holds.length > 0 && (
            <>
              <strong>Holds below the league</strong> {d.holds.map((r) => `${roleLabel(r.role)} · ${r.label} (${fmtGap(r.diffPerGame)} points a game below the league)`).join(', ')}.{' '}
            </>
          )}
          <a href={hashFor('teams', team, 'advanced')} className="font-semibold text-(--accent) no-underline hover:underline">
            See Defense by position
          </a>
        </p>
      )}
      {mine.games < FEW_GAMES && (
        <div className="text-xs text-(--muted)">Based on {mine.games} {mine.games === 1 ? 'game' : 'games'} so far; ranks can move a lot this early in the season.</div>
      )}
    </section>
  )
}
