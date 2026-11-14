import { useEffect, useState, type CSSProperties } from 'react'
import { fetchTeamForm, fetchTeamGames, fetchTeamLog, fetchTeamMeetings, fetchTeams } from './api.ts'
import { TeamBadge } from './components/Avatar.tsx'
import { CourtBackground } from './components/CourtBackground.tsx'
import { PageSwitch } from './components/PageSwitch.tsx'
import { Scorecard } from './components/Scorecard.tsx'
import { TeamGameLog } from './components/TeamGameLog.tsx'
import { TeamMeetingsPanel } from './components/TeamMeetings.tsx'
import { shortDate, teamLabel } from './lib/format.ts'
import { DEFAULT_VIEW, LOG_VIEWS, type LogView } from './lib/gamelog.ts'
import { GAME_TYPE_OPTIONS, gamesWord } from './lib/gameType.ts'
import { chartPalette } from './lib/hex.ts'
import { panelStyle, pillClass, pillStyle } from './lib/styles.ts'
import { TEAM_IDS, readableOn } from './lib/teams.ts'
import { TEAM_CARDS, cardFormat, teamNotices } from './lib/teamPage.ts'
import { teamLook } from './lib/teamTheme.ts'
import { THEME } from './lib/themes.ts'
import type { GameType, Team, TeamFormResult, TeamGame, TeamMeetings } from './types.ts'

const ALL_TEAMS = Object.keys(TEAM_IDS).sort()

const selectClass =
  'h-12 rounded-xl border border-(--pillBorder) bg-(--inputBg) px-3.5 text-[15px] font-semibold text-(--text) disabled:opacity-50'
const labelClass = 'text-xs font-semibold tracking-wider text-(--muted) uppercase'

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong.'
}

/**
 * The Teams page: the Player page's structure at team level, offense first. A team picker, the Regular season / Playoffs toggle
 * (one game type at a time, never a mix), six scorecards with their lines (Averages) or the last 15 games (Box scores), and
 * the team's games against one opponent. The team's colours light the page exactly as on the Player page.
 */
export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[] | null>(null)
  const [team, setTeam] = useState('')
  const [gameType, setGameType] = useState<GameType>('regular-season')
  const [form, setForm] = useState<TeamFormResult | null>(null)
  const [recent, setRecent] = useState<TeamGame[] | null>(null) // the games behind the lines under the scorecards
  const [view, setView] = useState<LogView>(DEFAULT_VIEW)
  const [log, setLog] = useState<TeamGame[] | null>(null)
  const [logError, setLogError] = useState('')
  const [opp, setOpp] = useState('')
  const [meetings, setMeetings] = useState<TeamMeetings | null>(null)
  const [meetingsError, setMeetingsError] = useState('')
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0) // bumped by "Try again"

  // Choosing from a control clears whatever depended on the old choice, right there in the click handler.
  function clearTeamData() {
    setForm(null)
    setRecent(null)
    setLog(null)
    setLogError('')
    setMeetings(null)
    setMeetingsError('')
    setError('')
  }
  function chooseTeam(code: string) {
    setTeam(code)
    clearTeamData()
  }
  function chooseGameType(t: GameType) {
    if (t === gameType) return
    setGameType(t)
    setTeams(null)
    clearTeamData()
  }
  function chooseOpp(code: string) {
    setOpp(code)
    setMeetings(null)
    setMeetingsError('')
  }
  function tryAgain() {
    setError('')
    setAttempt((n) => n + 1)
  }

  // 1. The teams for the chosen game type. The current team stays if listed; otherwise New York, otherwise the first.
  useEffect(() => {
    let cancelled = false
    fetchTeams(gameType)
      .then((list) => {
        if (cancelled) return
        setTeams(list)
        setTeam((current) =>
          list.some((t) => t.team === current) ? current : list.some((t) => t.team === 'NYK') ? 'NYK' : (list[0]?.team ?? ''),
        )
      })
      .catch((e) => !cancelled && setError(errorText(e)))
    return () => {
      cancelled = true
    }
  }, [gameType, attempt])

  const listed = !!team && !!teams?.some((t) => t.team === team)

  // 2. The team's form (waits for the team list, so a team from the old list is never asked for).
  useEffect(() => {
    if (!listed) return
    let cancelled = false
    fetchTeamForm(team, gameType)
      .then((f) => !cancelled && setForm(f))
      .catch((e) => !cancelled && setError(errorText(e)))
    return () => {
      cancelled = true
    }
  }, [team, listed, gameType, attempt])

  // 2b. The games behind the lines under the scorecards. The lines are an extra: if this fails the cards still show.
  useEffect(() => {
    if (!listed) return
    let cancelled = false
    fetchTeamGames(team, gameType)
      .then((r) => !cancelled && setRecent(r.games))
      .catch(() => !cancelled && setRecent([]))
    return () => {
      cancelled = true
    }
  }, [team, listed, gameType, attempt])

  // 2c. The last 15 games for the box-score table. Only that table is affected if this fails.
  useEffect(() => {
    if (!listed) return
    let cancelled = false
    fetchTeamLog(team, gameType)
      .then((r) => !cancelled && setLog(r.games))
      .catch((e) => !cancelled && setLogError(errorText(e)))
    return () => {
      cancelled = true
    }
  }, [team, listed, gameType, attempt])

  // 3. The team's games against the chosen opponent. Only the opponent panel is affected if this fails.
  useEffect(() => {
    if (!opp || !listed || opp === team) return
    let cancelled = false
    fetchTeamMeetings(team, gameType, opp)
      .then((m) => !cancelled && setMeetings(m))
      .catch((e) => !cancelled && setMeetingsError(errorText(e)))
    return () => {
      cancelled = true
    }
  }, [opp, team, listed, gameType, attempt])

  const data = form && !('none' in form) ? form : null
  const noGames = form !== null && 'none' in form
  const t = data?.team
  const notices = t ? teamNotices(t, gameType) : []
  const words = gamesWord(gameType)

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

  return (
    <div className="relative isolate min-h-screen px-6 pt-8 pb-14" style={rootStyle}>
      {look.wash !== 'none' && (
        <div aria-hidden className="pointer-events-none fixed inset-0 -z-10" style={{ backgroundImage: look.wash }} />
      )}
      <CourtBackground key={team} />
      <div className="mx-auto flex max-w-[1200px] flex-col gap-[26px]">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <div className="text-[22px] font-semibold tracking-tight" style={{ fontFamily: 'var(--display)' }}>
              Team form
            </div>
            <div className="text-[13px] text-(--muted)">How a team's offense has looked over its recent games, as a range</div>
          </div>
          <PageSwitch page="teams" />
        </header>

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
                <button
                  key={o.key}
                  type="button"
                  aria-pressed={o.key === gameType}
                  className={pillClass}
                  style={pillStyle(o.key === gameType)}
                  onClick={() => chooseGameType(o.key)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div aria-live="polite" className="flex flex-col gap-3">
          {error && (
            <div
              className="flex max-w-3xl flex-wrap items-center gap-3 rounded-xl border border-(--warnBorder) bg-(--warnBg) px-4 py-3 text-sm text-(--warnText)"
              role="alert"
            >
              <span>{error}</span>
              <button type="button" onClick={tryAgain} className="min-h-11 cursor-pointer rounded-full border border-(--warnBorder) px-4 font-semibold">
                Try again
              </button>
            </div>
          )}
          {!error && !form && (
            <div className="text-sm text-(--muted)">Loading... the database may be waking up, which can take up to a minute.</div>
          )}
        </div>

        {noGames && (
          <section className="flex flex-col gap-2 rounded-[18px] border border-(--border) bg-(--panel) p-5" style={panelStyle}>
            <div className="text-xs font-semibold tracking-widest text-(--accent) uppercase">Team level · playoffs</div>
            <h1 className="m-0 text-[32px] leading-[1.1] font-semibold tracking-tight" style={{ fontFamily: 'var(--display)' }}>
              {teamLabel(team)}
            </h1>
            <div className="text-[15px] text-(--muted)">
              This team has no playoff games on record. Switch back to Regular season to see its form.
            </div>
          </section>
        )}

        {t && data && (
          <div key={`${team}-${gameType}`} className="stagger contents">
            <section className="flex flex-col gap-2">
              <div className="text-xs font-semibold tracking-widest text-(--accent) uppercase">
                Team level · last {t.l10Games} {words}
              </div>
              <div className="flex flex-wrap items-center gap-5">
                <TeamBadge abbrev={t.tricode} size={72} />
                <div className="flex min-w-0 flex-col gap-1.5">
                  <h1 className="m-0 text-[44px] leading-[1.1] font-semibold tracking-tight" style={{ fontFamily: 'var(--display)' }}>
                    {t.name}
                  </h1>
                  <div className="text-[15px] text-(--muted)">
                    Last {t.l10Games} {words} played · {shortDate(t.l10FirstDate)} to {shortDate(t.lastGameDate)} · {t.l10Wins} won,{' '}
                    {t.l10Games - t.l10Wins} lost · {t.totalGames} {words} in the data
                  </div>
                </div>
              </div>
              {notices.map((n) => (
                <div key={n} className="mt-1.5 max-w-3xl rounded-xl border border-(--warnBorder) bg-(--warnBg) px-4 py-3 text-sm text-(--warnText)">
                  {n}
                </div>
              ))}
            </section>

            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="View">
              {LOG_VIEWS.map((v) => (
                <button key={v.key} type="button" aria-pressed={v.key === view} className={pillClass} style={pillStyle(v.key === view)} onClick={() => setView(v.key)}>
                  {v.label}
                </button>
              ))}
            </div>

            {view === 'log' ? (
              <TeamGameLog games={log} error={logError} gamesWord={words} />
            ) : (
              <div className="cards grid grid-cols-[repeat(auto-fit,minmax(min(340px,100%),1fr))] gap-4">
                {TEAM_CARDS.map((c) => (
                  <Scorecard
                    key={c.key}
                    label={c.label}
                    stat={data.stats[c.key] ? { ...data.stats[c.key], shares: null } : undefined}
                    statKey={c.key}
                    games={t.l10Games}
                    seasonLabel={t.seasonLabel}
                    recent={recent}
                    fmt={cardFormat(c)}
                    names={{ short: c.short, name: c.label }}
                    lowerIsBetter={c.lowerIsBetter}
                  />
                ))}
              </div>
            )}

            {view === 'cards' && (
              <div className="flex flex-wrap items-center gap-5 text-[13px] text-(--muted)">
                <span className="inline-flex items-center gap-2">
                  <span className="inline-block size-3.5 rounded-full bg-(--dot)" />
                  average of these games
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="inline-block h-[18px] w-[3px] bg-(--median)" />
                  median (the middle game)
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="inline-block h-3 w-7 rounded-md bg-(--band)" />
                  middle 80% of games
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="inline-block h-0.5 w-7 bg-(--whisker)" />
                  lowest to highest game
                </span>
              </div>
            )}

            <TeamMeetingsPanel
              opponents={ALL_TEAMS.filter((x) => x !== t.tricode)}
              opp={opp === t.tricode ? '' : opp}
              onOpp={chooseOpp}
              meetings={meetings}
              error={meetingsError}
              gameType={gameType}
              gamesWord={words}
            />
          </div>
        )}

        <p className="max-w-3xl text-xs leading-normal text-(--muted)">
          Each figure describes the team's own recent games as a distribution. It is not a prediction. Shooting percentages are
          total made over total attempted across the games shown. Data through {t ? shortDate(t.lastGameDate) : 'the latest games'}.
          Source: sportsdataverse (MIT, CC BY 4.0).
        </p>
      </div>
    </div>
  )
}
