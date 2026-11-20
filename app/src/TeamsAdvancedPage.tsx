import { useEffect, useState, type CSSProperties } from 'react'
import { fetchTeamContext, fetchTeamDefense, fetchTeams } from './api.ts'
import { CourtBackground } from './components/CourtBackground.tsx'
import { DefenseGrid } from './components/DefenseGrid.tsx'
import { PageSwitch } from './components/PageSwitch.tsx'
import { TeamTabs } from './components/TeamTabs.tsx'
import { COMPARISONS, CONTEXT_STAT_LIST, MIN_TEAM_GAMES, applicableComparisons, difference, enoughGames, fmtDiff, fmtValue, nextGameFacts, orderComparisons, tooFewText } from './lib/context.ts'
import { KpiTiles } from './components/KpiTiles.tsx'
import { shortDate, teamLabel } from './lib/format.ts'
import { GAME_TYPE_OPTIONS } from './lib/gameType.ts'
import { chartPalette } from './lib/hex.ts'
import { parseHash, rememberTeam } from './lib/pages.ts'
import { panelStyle, pillClass, pillStyle } from './lib/styles.ts'
import { readableOn } from './lib/teams.ts'
import { teamLook } from './lib/teamTheme.ts'
import { THEME } from './lib/themes.ts'
import type { ContextSplit, GameType, Team, TeamContext, TeamDefense } from './types.ts'

const selectClass =
  'h-12 rounded-xl border border-(--pillBorder) bg-(--inputBg) px-3.5 text-[15px] font-semibold text-(--text) disabled:opacity-50'
const labelClass = 'text-xs font-semibold tracking-wider text-(--muted) uppercase'
const cell = 'px-1.5 py-2 text-right text-[13px] md:px-3 md:text-[14px] tabular-nums whitespace-nowrap'
const head = 'px-1.5 py-2 text-right text-[10px] font-semibold tracking-normal md:px-3 md:text-xs md:tracking-wider text-(--muted) uppercase whitespace-nowrap'

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong.'
}
const games = (n: number) => n.toLocaleString('en-US')
const seasons = (s: ContextSplit) => (s.firstSeason && s.lastSeason ? (s.firstSeason === s.lastSeason ? s.firstSeason : `${s.firstSeason} to ${s.lastSeason}`) : '')

/** One comparison: the league pattern as small tiles, then this team's own games this season (only when each side has enough games). */
function ComparisonPanel({ c, ctx, highlighted }: { c: (typeof COMPARISONS)[number]; ctx: TeamContext; highlighted: boolean }) {
  const leagueN = [ctx.league.buckets[c.a]?.n ?? 0, ctx.league.buckets[c.b]?.n ?? 0]
  const teamN = [ctx.team.buckets[c.a]?.n ?? 0, ctx.team.buckets[c.b]?.n ?? 0]
  const tiles = CONTEXT_STAT_LIST.map((s) => {
    const l = difference(ctx.league, c.a, c.b, s.key, 1)
    return { label: s.label, value: l ? fmtDiff(s.key, l.diff) : '-' }
  })
  const own = enoughGames(teamN[0], teamN[1])
  return (
    <section className="flex flex-col gap-3 rounded-[18px] border border-(--border) bg-(--panel) p-5" style={panelStyle}>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="m-0 text-[20px] font-semibold tracking-tight" style={{ fontFamily: 'var(--display)' }}>
          {c.title}
        </h2>
        {highlighted && (
          <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ background: 'var(--pillOn)', color: 'var(--pillOnText)' }}>
            Applies to the next game
          </span>
        )}
      </div>
      <KpiTiles
        tiles={tiles}
        caption={`League pattern: ${c.aLabel} minus ${c.bLabel} (${seasons(ctx.league)}; ${games(leagueN[0])} and ${games(leagueN[1])} games)`}
      />
      <div className="flex flex-col gap-2">
        <div className="text-xs font-semibold tracking-wider text-(--muted) uppercase">This team, {seasons(ctx.team) || 'this season'}</div>
        {own ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={`${head} text-left!`}>Stat</th>
                  <th className={head}>
                    {c.aLabel} ({teamN[0]})
                  </th>
                  <th className={head}>
                    {c.bLabel} ({teamN[1]})
                  </th>
                  <th className={head}>Diff</th>
                </tr>
              </thead>
              <tbody>
                {CONTEXT_STAT_LIST.map((s) => {
                  const t = difference(ctx.team, c.a, c.b, s.key, MIN_TEAM_GAMES)
                  return (
                    <tr key={s.key} className="border-t border-(--border)">
                      <th scope="row" className="px-1.5 py-2 text-left text-[13px] font-semibold md:px-3 md:text-[14px]">
                        {s.label}
                      </th>
                      <td className={cell}>{t ? fmtValue(s.key, t.a) : '-'}</td>
                      <td className={cell}>{t ? fmtValue(s.key, t.b) : '-'}</td>
                      <td className={`${cell} font-semibold`}>{t ? fmtDiff(s.key, t.diff) : '-'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-[14px] text-(--muted)">{tooFewText(c.aLabel, teamN[0], c.bLabel, teamN[1])}</div>
        )}
      </div>
    </section>
  )
}

/**
 * Teams > Advanced stats. The schedule tells us each team's situation before a game (home or away, days of rest,
 * back-to-back), so the page leads with the team's next game and then shows how games in that situation have gone: across
 * the whole league (a large, steady sample) and for this team this season (a small sample, shown muted). Nothing on the
 * Overview tab is changed. One game type at a time, never a mix.
 */
export default function TeamsAdvancedPage() {
  const [teams, setTeams] = useState<Team[] | null>(null)
  const [team, setTeam] = useState(() => parseHash(window.location.hash).team)
  const [gameType, setGameType] = useState<GameType>('regular-season')
  const [ctx, setCtx] = useState<TeamContext | null>(null)
  const [defense, setDefense] = useState<TeamDefense | null>(null)
  const [defError, setDefError] = useState('')
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [defAttempt, setDefAttempt] = useState(0)

  function chooseTeam(code: string) {
    setTeam(code)
    setCtx(null)
    setDefense(null)
    setDefError('')
    setError('')
  }
  function chooseGameType(t: GameType) {
    if (t === gameType) return
    setGameType(t)
    setTeams(null)
    setCtx(null)
    setDefense(null)
    setDefError('')
    setError('')
  }

  useEffect(() => {
    let cancelled = false
    fetchTeams(gameType)
      .then((list) => {
        if (cancelled) return
        setTeams(list)
        setTeam((current) => (list.some((t) => t.team === current) ? current : list.some((t) => t.team === 'NYK') ? 'NYK' : (list[0]?.team ?? '')))
      })
      .catch((e) => !cancelled && setError(errorText(e)))
    return () => {
      cancelled = true
    }
  }, [gameType, attempt])

  useEffect(() => rememberTeam('teams', team, 'advanced'), [team])

  const listed = !!team && !!teams?.some((t) => t.team === team)
  useEffect(() => {
    if (!listed) return
    let cancelled = false
    fetchTeamContext(team, gameType)
      .then((c) => !cancelled && setCtx(c))
      .catch((e) => !cancelled && setError(errorText(e)))
    return () => {
      cancelled = true
    }
  }, [team, listed, gameType, attempt])

  // Defense by position loads on its own, so a slow answer never holds up the rest of the page.
  useEffect(() => {
    if (!listed) return
    let cancelled = false
    fetchTeamDefense(team, gameType)
      .then((d) => !cancelled && setDefense(d))
      .catch((e) => !cancelled && setDefError(errorText(e)))
    return () => {
      cancelled = true
    }
  }, [team, listed, gameType, defAttempt])

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

  const next = ctx?.next ?? null
  const highlighted = applicableComparisons(next)
  const noGames = ctx !== null && Object.keys(ctx.team.buckets).length === 0

  return (
    <div className="relative isolate min-h-screen px-6 pt-8 pb-14" style={rootStyle}>
      {look.wash !== 'none' && <div aria-hidden className="pointer-events-none fixed inset-0 -z-10" style={{ backgroundImage: look.wash }} />}
      <CourtBackground key={team} />
      <div className="mx-auto flex max-w-[1200px] flex-col gap-[26px]">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <div className="text-[22px] font-semibold tracking-tight" style={{ fontFamily: 'var(--display)' }}>
              Advanced stats
            </div>
            <div className="text-[13px] text-(--muted)">How a team's games change with home or away, days of rest and back-to-backs</div>
          </div>
          <PageSwitch page="teams" team={team} />
        </header>

        <TeamTabs view="advanced" team={team} />

        <div className="flex flex-wrap items-end gap-4">
          <label className="flex max-w-80 min-w-56 flex-1 flex-col gap-1.5">
            <span className={labelClass}>1. Team</span>
            <select className={selectClass} value={team} disabled={!teams} onChange={(e) => chooseTeam(e.target.value)}>
              {!teams && <option value="">Loading teams...</option>}
              {teams?.map((x) => (
                <option key={x.team} value={x.team}>
                  {teamLabel(x.team)}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-col gap-1.5">
            <span className={labelClass}>2. Games</span>
            <div className="flex h-12 items-center gap-2" role="group" aria-label="Game type">
              {GAME_TYPE_OPTIONS.map((o) => (
                <button key={o.key} type="button" aria-pressed={o.key === gameType} className={pillClass} style={pillStyle(o.key === gameType)} onClick={() => chooseGameType(o.key)}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div aria-live="polite" className="flex flex-col gap-3">
          {error && (
            <div className="flex max-w-3xl flex-wrap items-center gap-3 rounded-xl border border-(--warnBorder) bg-(--warnBg) px-4 py-3 text-sm text-(--warnText)" role="alert">
              <span>{error}</span>
              <button type="button" onClick={() => { setError(''); setAttempt((n) => n + 1) }} className="min-h-11 cursor-pointer rounded-full border border-(--warnBorder) px-4 font-semibold">
                Try again
              </button>
            </div>
          )}
          {!error && !ctx && <div className="text-sm text-(--muted)">Loading... the database may be waking up, which can take up to a minute.</div>}
        </div>

        {ctx && (
          <div key={`${team}-${gameType}`} className="stagger contents">
            <section className="flex flex-col gap-2 rounded-[18px] border border-(--border) bg-(--panel) p-5" style={panelStyle}>
              <div className="text-xs font-semibold tracking-widest text-(--accent) uppercase">Next game</div>
              <h1 className="m-0 text-[32px] leading-[1.1] font-semibold tracking-tight" style={{ fontFamily: 'var(--display)' }}>
                {teamLabel(team).replace(/ \([A-Z]{3}\)$/, '')}
              </h1>
              {next ? (
                <>
                  <div className="text-[15px] font-semibold">{shortDate(next.date)}</div>
                  <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                    {nextGameFacts(next).map((f) => (
                      <li key={f} className="rounded-full border border-(--pillBorder) bg-(--pill) px-3 py-1 text-[13px] font-semibold text-(--pillText)">
                        {f}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <div className="text-[15px] text-(--muted)">No {gameType === 'playoffs' ? 'playoff ' : ''}game on the schedule yet for this team.</div>
              )}
            </section>

            {noGames ? (
              <div className="text-[15px] text-(--muted)">This team has no {gameType === 'playoffs' ? 'playoff ' : ''}games on record yet, so there is nothing to split.</div>
            ) : (
              <>
                <p className="m-0 max-w-3xl text-[14px] leading-relaxed text-(--muted)">
                  In five seasons of data, a team's own split in one half of a season did not predict the other half. Treat the team numbers as context, not a trait.
                </p>
                <details className="max-w-3xl text-[14px] leading-relaxed text-(--muted)">
                  <summary className="min-h-11 cursor-pointer font-semibold text-(--text)">How to read this</summary>
                  <ul className="m-0 mt-1 flex list-disc flex-col gap-1.5 pl-5">
                    <li>
                      <strong className="text-(--text)">League pattern (tiles):</strong> the first situation minus the second, over every team's games on record. The samples are large, so the pattern is steady.
                    </li>
                    <li>
                      <strong className="text-(--text)">This team (table):</strong> its own games this season in the same situations. The number in each heading is how many games. A comparison needs at
                      least {MIN_TEAM_GAMES} games on each side; below that it is a single result, not a pattern.
                    </li>
                    <li>Games are compared as played, so opponents and home or away mix in with rest.</li>
                  </ul>
                </details>
                {orderComparisons(highlighted).map((c) => (
                  <ComparisonPanel key={c.key} c={c} ctx={ctx} highlighted={highlighted.has(c.key)} />
                ))}
                <DefenseGrid defense={defense} error={defError} onRetry={() => { setDefError(''); setDefAttempt((n) => n + 1) }} />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
