import { useEffect, useState, type CSSProperties } from 'react'
import { fetchForm, fetchPlayers, fetchTeams } from './api.ts'
import { CombosTable } from './components/CombosTable.tsx'
import { Scorecard } from './components/Scorecard.tsx'
import { CARD_STATS, LABELS, daysSince, shortDate, teamLabel } from './lib/format.ts'
import { THEMES, THEME_ORDER, loadTheme, saveTheme, type ThemeKey } from './lib/themes.ts'
import type { Form, PlayerOption, Team } from './types.ts'

const selectClass =
  'h-12 rounded-xl border border-(--pillBorder) bg-(--inputBg) px-3.5 text-[15px] font-semibold text-(--text) disabled:opacity-50'
const labelClass = 'text-xs font-semibold tracking-wider text-(--muted) uppercase'

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong.'
}

export default function App() {
  const [themeKey, setThemeKey] = useState<ThemeKey>(loadTheme)
  const [teams, setTeams] = useState<Team[] | null>(null)
  const [team, setTeam] = useState('')
  const [players, setPlayers] = useState<PlayerOption[] | null>(null)
  const [playerId, setPlayerId] = useState('')
  const [form, setForm] = useState<Form | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0) // bumped by "Try again"

  // Choosing from a dropdown clears whatever depended on the old choice, right there in the click handler.
  function chooseTeam(code: string) {
    setTeam(code)
    setPlayers(null)
    setPlayerId('')
    setForm(null)
    setError('')
  }
  function choosePlayer(id: string) {
    setPlayerId(id)
    setForm(null)
    setError('')
  }
  function tryAgain() {
    setError('')
    setAttempt((n) => n + 1)
  }

  // 1. The list of teams, once. New York is the default if it is there.
  useEffect(() => {
    let cancelled = false
    fetchTeams()
      .then((list) => {
        if (cancelled) return
        setTeams(list)
        setTeam((current) => current || (list.some((t) => t.team === 'NYK') ? 'NYK' : (list[0]?.team ?? '')))
      })
      .catch((e) => !cancelled && setError(errorText(e)))
    return () => {
      cancelled = true
    }
  }, [attempt])

  // 2. The players on the chosen team; the one with the most minutes is picked first.
  useEffect(() => {
    if (!team) return
    let cancelled = false
    fetchPlayers(team)
      .then((list) => {
        if (cancelled) return
        setPlayers(list)
        setPlayerId(list[0]?.id ?? '')
      })
      .catch((e) => !cancelled && setError(errorText(e)))
    return () => {
      cancelled = true
    }
  }, [team, attempt])

  // 3. The chosen player's form.
  useEffect(() => {
    if (!playerId) return
    let cancelled = false
    fetchForm(playerId)
      .then((f) => !cancelled && setForm(f))
      .catch((e) => !cancelled && setError(errorText(e)))
    return () => {
      cancelled = true
    }
  }, [playerId, attempt])

  function pickTheme(key: ThemeKey) {
    setThemeKey(key)
    saveTheme(key)
  }

  const p = form?.player
  const notices: string[] = []
  if (p) {
    if (p.l10Games < 10) {
      notices.push(`Only ${p.l10Games} games on record so far. These ranges are rough and will move a lot with each new game.`)
    }
    if (p.l10GamesBeforeCurrentSeason > 0) {
      notices.push(`${p.l10GamesBeforeCurrentSeason} of these ${p.l10Games} games are from before this season, because the new season is young.`)
    }
    if (p.l10GamesNotRegular > 0) {
      notices.push(`${p.l10GamesNotRegular} of these ${p.l10Games} games are not regular-season games.`)
    }
    const idle = daysSince(p.lastGameDate)
    if (idle > 7) notices.push(`${p.name} last played on ${shortDate(p.lastGameDate)}, ${idle} days ago.`)
  }

  const rootStyle = {
    ...THEMES[themeKey].vars,
    background: 'var(--bg)',
    color: 'var(--text)',
    fontFamily: 'Inter, system-ui, sans-serif',
  } as CSSProperties

  return (
    <div className="min-h-screen px-6 pt-8 pb-14" style={rootStyle}>
      <div className="mx-auto flex max-w-[1200px] flex-col gap-[26px]">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <div className="text-[22px] font-semibold tracking-tight" style={{ fontFamily: 'var(--display)' }}>
              Player form
            </div>
            <div className="text-[13px] text-(--muted)">Recent games as a range, not a single number</div>
          </div>
          <div role="group" aria-label="Colour theme" className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-xs text-(--muted)">Theme</span>
            {THEME_ORDER.map((key) => {
              const on = key === themeKey
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => pickTheme(key)}
                  className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm font-semibold"
                  style={{
                    borderColor: on ? 'var(--pillOn)' : 'var(--pillBorder)',
                    background: on ? 'var(--pillOn)' : 'var(--pill)',
                    color: on ? 'var(--pillOnText)' : 'var(--pillText)',
                  }}
                >
                  <span className="inline-block size-2.5 rounded-full" style={{ background: THEMES[key].swatch }} />
                  {THEMES[key].name}
                </button>
              )
            })}
          </div>
        </header>

        <div className="flex flex-wrap items-end gap-4">
          <label className="flex max-w-80 min-w-56 flex-1 flex-col gap-1.5">
            <span className={labelClass}>1. Team</span>
            <select className={selectClass} value={team} disabled={!teams} onChange={(e) => chooseTeam(e.target.value)}>
              {!teams && <option value="">Loading teams...</option>}
              {teams?.map((t) => (
                <option key={t.team} value={t.team}>
                  {teamLabel(t.team)}
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
            <div
              className="flex max-w-3xl flex-wrap items-center gap-3 rounded-xl border border-(--warnBorder) bg-(--warnBg) px-4 py-3 text-sm text-(--warnText)"
              role="alert"
            >
              <span>{error}</span>
              <button
                type="button"
                onClick={tryAgain}
                className="min-h-11 cursor-pointer rounded-full border border-(--warnBorder) px-4 font-semibold"
              >
                Try again
              </button>
            </div>
          )}
          {!error && !form && (
            <div className="text-sm text-(--muted)">Loading... the database may be waking up, which can take up to a minute.</div>
          )}
        </div>

        {p && form && (
          <>
            <section className="flex flex-col gap-2">
              <div className="text-xs font-semibold tracking-widest text-(--accent) uppercase">
                Player level · last {p.l10Games} games
              </div>
              <div className="flex flex-wrap items-baseline gap-3.5">
                <h1 className="m-0 text-[44px] leading-[1.1] font-semibold tracking-tight" style={{ fontFamily: 'var(--display)' }}>
                  {p.name}
                </h1>
                <span className="text-[15px] font-semibold text-(--accent)">{p.team}</span>
              </div>
              <div className="text-[15px] text-(--muted)">
                Last {p.l10Games} games played · {shortDate(p.l10FirstDate)} to {shortDate(p.lastGameDate)} ·{' '}
                {p.totalGames} games in the data
              </div>
              {notices.map((n) => (
                <div
                  key={n}
                  className="mt-1.5 max-w-3xl rounded-xl border border-(--warnBorder) bg-(--warnBg) px-4 py-3 text-sm text-(--warnText)"
                >
                  {n}
                </div>
              ))}
            </section>

            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(340px,100%),1fr))] gap-4">
              {CARD_STATS.map((key) => (
                <Scorecard key={key} label={LABELS[key]} stat={form.stats[key]} />
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-5 text-[13px] text-(--muted)">
              <span className="inline-flex items-center gap-2">
                <span className="inline-block size-3.5 rounded-full bg-(--dot)" />
                average
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

            <CombosTable stats={form.stats} />
          </>
        )}

        <p className="max-w-3xl text-xs leading-normal text-(--muted)">
          Each figure describes the player's own recent games as a distribution. It is not a prediction. Data
          through {p ? shortDate(p.lastGameDate) : 'the latest games'}. Source: sportsdataverse (MIT, CC BY 4.0).
        </p>
      </div>
    </div>
  )
}
