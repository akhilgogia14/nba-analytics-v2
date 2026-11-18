import { useEffect, useState, type CSSProperties } from 'react'
import { fetchMeetings, fetchPlayerContext, fetchPlayers, fetchRecent, fetchSeason, fetchTeams } from './api.ts'
import { CourtBackground } from './components/CourtBackground.tsx'
import { OutlookTable } from './components/OutlookTable.tsx'
import { PageSwitch } from './components/PageSwitch.tsx'
import { nextGameFacts } from './lib/context.ts'
import { shortDate, teamLabel } from './lib/format.ts'
import { chartPalette } from './lib/hex.ts'
import { fromMeeting, fromRecent, seasonGames, type Views } from './lib/outlook.ts'
import { parseHash, playerFromHash, rememberTeam } from './lib/pages.ts'
import { panelStyle } from './lib/styles.ts'
import { readableOn } from './lib/teams.ts'
import { teamLook } from './lib/teamTheme.ts'
import { THEME } from './lib/themes.ts'
import type { NextGame, PlayerOption, Team } from './types.ts'

const selectClass =
  'h-12 rounded-xl border border-(--pillBorder) bg-(--inputBg) px-3.5 text-[15px] font-semibold text-(--text) disabled:opacity-50'
const labelClass = 'text-xs font-semibold tracking-wider text-(--muted) uppercase'
const GAME_TYPE = 'regular-season' as const

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong.'
}

/**
 * Predictions (first version, no model yet): for the chosen player's NEXT game, what his past games say about each stat: the lowest,
 * average and highest over three views (his last 10 games, this season, and his last 10 against that opponent). Regular season only
 * for now. The numbers describe what has happened; they are not a forecast from a fitted model.
 */
export default function PredictionsPage() {
  const [teams, setTeams] = useState<Team[] | null>(null)
  const [team, setTeam] = useState(() => parseHash(window.location.hash).team)
  const [players, setPlayers] = useState<PlayerOption[] | null>(null)
  const [playerId, setPlayerId] = useState(() => playerFromHash(window.location.hash))
  const [next, setNext] = useState<NextGame | null | undefined>(undefined) // undefined = still loading, null = no game scheduled
  const [views, setViews] = useState<Views | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  function chooseTeam(code: string) {
    setTeam(code)
    setPlayers(null)
    setPlayerId('')
    setNext(undefined)
    setViews(null)
    setError('')
  }
  function choosePlayer(id: string) {
    setPlayerId(id)
    setNext(undefined)
    setViews(null)
    setError('')
  }

  useEffect(() => {
    let cancelled = false
    fetchTeams(GAME_TYPE)
      .then((list) => {
        if (cancelled) return
        setTeams(list)
        setTeam((current) => (list.some((t) => t.team === current) ? current : list.some((t) => t.team === 'NYK') ? 'NYK' : (list[0]?.team ?? '')))
      })
      .catch((e) => !cancelled && setError(errorText(e)))
    return () => {
      cancelled = true
    }
  }, [attempt])

  useEffect(() => {
    if (!team || !teams) return
    let cancelled = false
    fetchPlayers(team, GAME_TYPE)
      .then((list) => {
        if (cancelled) return
        setPlayers(list)
        setPlayerId((current) => (list.some((pl) => pl.id === current) ? current : (list[0]?.id ?? '')))
      })
      .catch((e) => !cancelled && setError(errorText(e)))
    return () => {
      cancelled = true
    }
  }, [team, teams, attempt])

  useEffect(() => rememberTeam('predictions', team, 'overview', playerId), [team, playerId])

  // The player's next game (which names the opponent), then his three sets of past games.
  const listed = !!playerId && !!players?.some((pl) => pl.id === playerId)
  useEffect(() => {
    if (!listed) return
    let cancelled = false
    ;(async () => {
      const ctx = await fetchPlayerContext(playerId, GAME_TYPE)
      if (cancelled) return
      setNext(ctx.next)
      const [recent, season, meetings] = await Promise.all([
        fetchRecent(playerId, GAME_TYPE),
        fetchSeason(playerId),
        ctx.next ? fetchMeetings(playerId, GAME_TYPE, ctx.next.opp) : Promise.resolve(null),
      ])
      if (cancelled) return
      setViews({
        last10: [...recent.games].reverse().map(fromRecent), // the route gives oldest first; the page keeps newest first
        season: seasonGames(season, GAME_TYPE),
        opponent: meetings ? meetings.games.map(fromMeeting) : [],
      })
    })().catch((e) => !cancelled && setError(errorText(e)))
    return () => {
      cancelled = true
    }
  }, [playerId, listed, attempt])

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

  const playerName = players?.find((pl) => pl.id === playerId)?.name ?? ''

  return (
    <div className="relative isolate min-h-screen px-6 pt-8 pb-14" style={rootStyle}>
      {look.wash !== 'none' && <div aria-hidden className="pointer-events-none fixed inset-0 -z-10" style={{ backgroundImage: look.wash }} />}
      <CourtBackground key={team} />
      <div className="mx-auto flex max-w-[1200px] flex-col gap-[26px]">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <div className="text-[22px] font-semibold tracking-tight" style={{ fontFamily: 'var(--display)' }}>
              Predictions
            </div>
            <div className="text-[13px] text-(--muted)">
              What a player's past games say about his next game. Ranges from past games for now, not a fitted model.
            </div>
          </div>
          <PageSwitch page="predictions" team={team} />
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
          <label className="flex max-w-80 min-w-56 flex-1 flex-col gap-1.5">
            <span className={labelClass}>2. Player</span>
            <select className={selectClass} value={playerId} disabled={!players} onChange={(e) => choosePlayer(e.target.value)}>
              {!players && <option value="">Loading players...</option>}
              {players?.map((pl) => (
                <option key={pl.id} value={pl.id}>
                  {pl.name}
                </option>
              ))}
            </select>
          </label>
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
          {!error && !views && <div className="text-sm text-(--muted)">Loading... the database may be waking up, which can take up to a minute.</div>}
        </div>

        {views && (
          <div key={playerId} className="stagger contents">
            <section className="flex flex-col gap-2 rounded-[18px] border border-(--border) bg-(--panel) p-5" style={panelStyle}>
              <div className="text-xs font-semibold tracking-widest text-(--accent) uppercase">Next game</div>
              <h1 className="m-0 text-[32px] leading-[1.1] font-semibold tracking-tight" style={{ fontFamily: 'var(--display)' }}>
                {playerName}
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
                <div className="text-[15px] text-(--muted)">No game on the schedule yet for this team, so there is no next matchup to look at.</div>
              )}
            </section>
            <OutlookTable views={views} opp={next?.opp ?? null} />
          </div>
        )}
      </div>
    </div>
  )
}
