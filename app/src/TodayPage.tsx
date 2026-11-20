import { useEffect, useState, type CSSProperties } from 'react'
import { fetchSlate } from './api.ts'
import { TeamBadge } from './components/Avatar.tsx'
import { CourtBackground } from './components/CourtBackground.tsx'
import { PageSwitch } from './components/PageSwitch.tsx'
import { teamLabel } from './lib/format.ts'
import { GAME_TYPE_OPTIONS } from './lib/gameType.ts'
import { chartPalette } from './lib/hex.ts'
import { hashFor } from './lib/pages.ts'
import { averagesText, averagesTitle, chipsFor, dateHeading, easternDate, emptyText, gameStatus, shiftDate, winner } from './lib/slate.ts'
import { panelStyle, pillClass, pillStyle } from './lib/styles.ts'
import { readableOn } from './lib/teams.ts'
import { teamLook } from './lib/teamTheme.ts'
import { THEME } from './lib/themes.ts'
import type { GameType, SideContext, SlateAverage, SlateGame } from './types.ts'

const labelClass = 'text-xs font-semibold tracking-wider text-(--muted) uppercase'
const arrowClass =
  'flex h-12 w-12 cursor-pointer items-center justify-center rounded-full border border-(--pillBorder) bg-(--pill) text-lg font-semibold text-(--pillText)'
const smallLink = 'inline-flex min-h-9 items-center rounded-full border border-(--pillBorder) bg-(--pill) px-3 text-xs font-semibold text-(--pillText) no-underline'

const chipTone = {
  warn: 'border-(--warnBorder) bg-(--warnBg) text-(--warnText)',
  good: 'border-(--accent) bg-(--pill) text-(--accent)',
  info: 'border-(--pillBorder) bg-(--pill) text-(--pillText)',
} as const

/** The schedule chips under a team's row. Each opens that team's Advanced stats tab. Nothing is drawn when there are none. */
function Chips({ code, context, isHome }: { code: string; context: SideContext | null; isHome: boolean }) {
  const chips = chipsFor(context, isHome)
  if (chips.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5 pl-12" aria-label={`${teamLabel(code)} schedule notes`}>
      {chips.map((c) => (
        <a
          key={c.key}
          href={hashFor('teams', code, 'advanced')}
          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold no-underline ${chipTone[c.tone]}`}
          title={`Open ${teamLabel(code)} on the Advanced stats tab`}
        >
          {c.label}
        </a>
      ))}
    </div>
  )
}

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong.'
}

/** One side of a game: the logo and name (a link to that team's page), its season averages, the score, and a Players button. */
function Side({ code, name, pts, won, final, avg }: { code: string; name: string; pts: number | null; won: boolean; final: boolean; avg: SlateAverage | undefined }) {
  const avgLine = averagesText(avg)
  return (
    <div className="flex flex-wrap items-center gap-3">
      <a href={hashFor('teams', code)} className="flex min-w-0 flex-1 items-center gap-3 text-(--text) no-underline" aria-label={`Open the ${teamLabel(code)} page`}>
        <TeamBadge abbrev={code} size={36} />
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-[17px] leading-tight font-semibold" style={{ fontFamily: 'var(--display)' }}>
            {name}
          </span>
          <span className="text-xs text-(--muted)" title={averagesTitle(avg)}>
            {code}
            {avgLine && ` · ${avgLine}`}
          </span>
        </span>
      </a>
      {final && pts !== null && (
        <span className={`w-12 text-right text-[26px] font-semibold tabular-nums ${won ? '' : 'opacity-55'}`} style={{ fontFamily: 'var(--display)' }}>
          {pts}
        </span>
      )}
      <span className="flex gap-1.5">
        <a href={hashFor('players', code)} className={smallLink}>
          Players
        </a>
      </span>
    </div>
  )
}

function GameCard({ g, averages }: { g: SlateGame; averages: Record<string, SlateAverage> }) {
  const w = winner(g)
  return (
    <section className="flex flex-col gap-3 rounded-[18px] border border-(--border) bg-(--panel) p-5" style={panelStyle}>
      <Side code={g.away} name={g.awayName} pts={g.awayPts} won={w === 'away'} final={g.isFinal} avg={averages[g.away]} />
      <Chips code={g.away} context={g.awayContext} isHome={false} />
      <div className="flex items-center gap-3 text-xs font-semibold tracking-widest text-(--muted) uppercase">
        <span>at</span>
        <span className="h-px flex-1 bg-(--border)" />
        <span className={g.isFinal ? 'text-(--accent)' : ''}>{gameStatus(g)}</span>
      </div>
      <Side code={g.home} name={g.homeName} pts={g.homePts} won={w === 'home'} final={g.isFinal} avg={averages[g.home]} />
      <Chips code={g.home} context={g.homeContext} isHome />
    </section>
  )
}

/**
 * Today's games: the games on one date (today in US Eastern time to start), one game type at a time. Each game shows both
 * teams with their season scoring averages, the score once it is final, and a link to each team's page (the name) and player list. The arrows move one day at a time.
 */
export default function TodayPage() {
  const today = easternDate()
  const [date, setDate] = useState(today)
  const [gameType, setGameType] = useState<GameType>('regular-season')
  const [games, setGames] = useState<SlateGame[] | null>(null)
  const [averages, setAverages] = useState<Record<string, SlateAverage>>({})
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0) // bumped by "Try again"

  function chooseDate(d: string) {
    setDate(d)
    setGames(null)
    setError('')
  }
  function chooseGameType(t: GameType) {
    if (t === gameType) return
    setGameType(t)
    setGames(null)
    setError('')
  }
  function tryAgain() {
    setError('')
    setAttempt((n) => n + 1)
  }

  useEffect(() => {
    let cancelled = false
    fetchSlate(date, gameType)
      .then((s) => {
        if (cancelled) return
        setGames(s.games)
        setAverages(s.averages ?? {})
      })
      .catch((e) => !cancelled && setError(errorText(e)))
    return () => {
      cancelled = true
    }
  }, [date, gameType, attempt])

  const look = teamLook('')
  const bright = chartPalette('').top
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
      <CourtBackground key="today" />
      <div className="mx-auto flex max-w-[1200px] flex-col gap-[26px]">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <div className="text-[22px] font-semibold tracking-tight" style={{ fontFamily: 'var(--display)' }}>
              Today's games
            </div>
            <div className="text-[13px] text-(--muted)">Who plays on a day, and the score once it is final. Dates are US Eastern time.</div>
          </div>
          <PageSwitch page="today" team="" />
        </header>

        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1.5">
            <span className={labelClass}>1. Day</span>
            <div className="flex items-center gap-2">
              <button type="button" className={arrowClass} aria-label="Previous day" onClick={() => chooseDate(shiftDate(date, -1))}>
                ‹
              </button>
              <div className="min-w-48 text-center text-[17px] font-semibold" style={{ fontFamily: 'var(--display)' }} aria-live="polite">
                {dateHeading(date, today)}
              </div>
              <button type="button" className={arrowClass} aria-label="Next day" onClick={() => chooseDate(shiftDate(date, 1))}>
                ›
              </button>
              {date !== today && (
                <button type="button" className={pillClass} style={pillStyle(false)} onClick={() => chooseDate(today)}>
                  Back to today
                </button>
              )}
            </div>
          </div>
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
          {!error && !games && (
            <div className="text-sm text-(--muted)">Loading... the database may be waking up, which can take up to a minute.</div>
          )}
          {games && games.length === 0 && <div className="text-[15px] text-(--muted)">{emptyText(date, today, gameType === 'regular-season')}</div>}
        </div>

        {games && games.length > 0 && (
          <div key={`${date}-${gameType}`} className="stagger grid gap-4 md:grid-cols-2">
            {games.map((g) => (
              <GameCard key={g.id} g={g} averages={averages} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
