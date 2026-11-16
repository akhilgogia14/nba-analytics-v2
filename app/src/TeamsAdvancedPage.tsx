import { useEffect, useState, type CSSProperties } from 'react'
import { fetchTeamContext, fetchTeams } from './api.ts'
import { CourtBackground } from './components/CourtBackground.tsx'
import { PageSwitch } from './components/PageSwitch.tsx'
import { TeamTabs } from './components/TeamTabs.tsx'
import { COMPARISONS, CONTEXT_STAT_LIST, MIN_TEAM_GAMES, applicableComparisons, difference, fmtDiff, fmtValue, nextGameFacts } from './lib/context.ts'
import { shortDate, teamLabel } from './lib/format.ts'
import { GAME_TYPE_OPTIONS } from './lib/gameType.ts'
import { chartPalette } from './lib/hex.ts'
import { parseHash, rememberTeam } from './lib/pages.ts'
import { panelStyle, pillClass, pillStyle } from './lib/styles.ts'
import { readableOn } from './lib/teams.ts'
import { teamLook } from './lib/teamTheme.ts'
import { THEME } from './lib/themes.ts'
import type { ContextSplit, GameType, Team, TeamContext } from './types.ts'

const selectClass =
  'h-12 rounded-xl border border-(--pillBorder) bg-(--inputBg) px-3.5 text-[15px] font-semibold text-(--text) disabled:opacity-50'
const labelClass = 'text-xs font-semibold tracking-wider text-(--muted) uppercase'
const cell = 'px-3 py-2 text-right text-[14px] tabular-nums whitespace-nowrap'
const head = 'px-3 py-2 text-right text-xs font-semibold tracking-wider text-(--muted) uppercase whitespace-nowrap'

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong.'
}
const games = (n: number) => n.toLocaleString('en-US')
const seasons = (s: ContextSplit) => (s.firstSeason && s.lastSeason ? (s.firstSeason === s.lastSeason ? s.firstSeason : `${s.firstSeason} to ${s.lastSeason}`) : '')

/** One comparison: the league-wide figures (every team, every season on record) beside this team's own figures this season. */
function ComparisonPanel({ c, ctx, highlighted }: { c: (typeof COMPARISONS)[number]; ctx: TeamContext; highlighted: boolean }) {
  const leagueN = [ctx.league.buckets[c.a]?.n ?? 0, ctx.league.buckets[c.b]?.n ?? 0]
  const teamN = [ctx.team.buckets[c.a]?.n ?? 0, ctx.team.buckets[c.b]?.n ?? 0]
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
      <div className="text-[13px] text-(--muted)">
        League ({seasons(ctx.league)}): {c.aLabel} {games(leagueN[0])} games, {c.bLabel} {games(leagueN[1])} games. This team ({seasons(ctx.team) || 'this season'}):{' '}
        {c.aLabel} {teamN[0]} games, {c.bLabel} {teamN[1]} games.
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse">
          <thead>
            <tr>
              <th className={`${head} text-left`}>Stat</th>
              <th className={head}>League {c.aLabel}</th>
              <th className={head}>League {c.bLabel}</th>
              <th className={head}>League difference</th>
              <th className={head}>Team {c.aLabel}</th>
              <th className={head}>Team {c.bLabel}</th>
              <th className={head}>Team difference</th>
            </tr>
          </thead>
          <tbody>
            {CONTEXT_STAT_LIST.map((s) => {
              const l = difference(ctx.league, c.a, c.b, s.key, 1)
              const t = difference(ctx.team, c.a, c.b, s.key, MIN_TEAM_GAMES)
              return (
                <tr key={s.key} className="border-t border-(--border)">
                  <th scope="row" className="px-3 py-2 text-left text-[14px] font-semibold whitespace-nowrap">
                    {s.label}
                  </th>
                  <td className={cell}>{l ? fmtValue(s.key, l.a) : '-'}</td>
                  <td className={cell}>{l ? fmtValue(s.key, l.b) : '-'}</td>
                  <td className={`${cell} font-semibold`}>{l ? fmtDiff(s.key, l.diff) : '-'}</td>
                  <td className={`${cell} text-(--muted)`}>{t ? fmtValue(s.key, t.a) : '-'}</td>
                  <td className={`${cell} text-(--muted)`}>{t ? fmtValue(s.key, t.b) : '-'}</td>
                  <td className={`${cell} text-(--muted)`}>{t ? fmtDiff(s.key, t.diff) : 'too few games'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
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
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  function chooseTeam(code: string) {
    setTeam(code)
    setCtx(null)
    setError('')
  }
  function chooseGameType(t: GameType) {
    if (t === gameType) return
    setGameType(t)
    setTeams(null)
    setCtx(null)
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
                <section className="flex max-w-3xl flex-col gap-1.5 text-[14px] leading-relaxed text-(--muted)">
                  <div>
                    <strong className="text-(--text)">How to read this.</strong> The league columns come from every team's games on record, so the pattern is steady: it is the real
                    effect of the situation. The team columns show this team's own games this season in the same situations. Those samples are small, and when we
                    tested seasons of past data a team's own split in one half of a season did not predict the other half. Treat them as context, not as a trait of the team.
                  </div>
                  <div>Games are compared as they were played, so a difference also reflects who the opponents were (for example, who played at home).</div>
                </section>
                {COMPARISONS.map((c) => (
                  <ComparisonPanel key={c.key} c={c} ctx={ctx} highlighted={highlighted.has(c.key)} />
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
