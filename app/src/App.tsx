import { useEffect, useState, type CSSProperties } from 'react'
import { fetchForm, fetchPlayers, fetchRecent, fetchSeason, fetchTeams } from './api.ts'
import { PlayerAvatar, TeamBadge } from './components/Avatar.tsx'
import { CombosTable } from './components/CombosTable.tsx'
import { Scorecard } from './components/Scorecard.tsx'
import { SeasonGrid } from './components/SeasonGrid.tsx'
import { CARD_STATS, LABELS, shortDate, teamLabel } from './lib/format.ts'
import { GAME_TYPE_OPTIONS, formNotices, gamesWord } from './lib/gameType.ts'
import { chartPalette } from './lib/hex.ts'
import { CourtBackground } from './components/CourtBackground.tsx'
import { panelStyle, pillClass, pillStyle } from './lib/styles.ts'
import { readableOn } from './lib/teams.ts'
import { teamLook } from './lib/teamTheme.ts'
import { THEME } from './lib/themes.ts'
import type { FormResult, GameType, PlayerOption, Recent, Season, Team } from './types.ts'

const selectClass =
  'h-12 rounded-xl border border-(--pillBorder) bg-(--inputBg) px-3.5 text-[15px] font-semibold text-(--text) disabled:opacity-50'
const labelClass = 'text-xs font-semibold tracking-wider text-(--muted) uppercase'

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong.'
}

export default function App() {
  const [teams, setTeams] = useState<Team[] | null>(null)
  const [team, setTeam] = useState('')
  const [players, setPlayers] = useState<PlayerOption[] | null>(null)
  const [playerId, setPlayerId] = useState('')
  const [form, setForm] = useState<FormResult | null>(null)
  const [gameType, setGameType] = useState<GameType>('regular-season') // the page's one toggle
  const [season, setSeason] = useState<Season | null>(null)
  const [recent, setRecent] = useState<Recent | null>(null) // the games behind the lines under the scorecards
  const [seasonError, setSeasonError] = useState('')
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0) // bumped by "Try again"

  // Choosing from a dropdown clears whatever depended on the old choice, right there in the click handler.
  function chooseTeam(code: string) {
    setTeam(code)
    setPlayers(null)
    setPlayerId('')
    setForm(null)
    setRecent(null)
    setSeason(null)
    setSeasonError('')
    setError('')
  }
  function choosePlayer(id: string) {
    setPlayerId(id)
    setForm(null)
    setRecent(null)
    setSeason(null)
    setSeasonError('')
    setError('')
  }
  // The toggle changes which teams and players are listed (all 30 teams and this season's rosters, or the teams and players
  // of the latest playoffs). The current team and player stay selected when they are still in the new lists.
  function chooseGameType(t: GameType) {
    if (t === gameType) return
    setGameType(t)
    setTeams(null)
    setPlayers(null)
    setForm(null)
    setRecent(null)
    setError('')
  }
  function tryAgain() {
    setError('')
    setSeasonError('')
    setAttempt((n) => n + 1)
  }

  // 1. The list of teams for the chosen game type. The current team stays if it is in the list; otherwise New York
  // (if it is there), otherwise the first team.
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

  // 2. The players on the chosen team, most minutes first. The current player stays if he is in the list; otherwise the
  // first one is picked. (Waits for the team list, so a team that is not in the new list is never asked for.)
  useEffect(() => {
    if (!team || !teams) return
    let cancelled = false
    fetchPlayers(team, gameType)
      .then((list) => {
        if (cancelled) return
        setPlayers(list)
        setPlayerId((current) => (list.some((pl) => pl.id === current) ? current : (list[0]?.id ?? '')))
      })
      .catch((e) => !cancelled && setError(errorText(e)))
    return () => {
      cancelled = true
    }
  }, [team, teams, gameType, attempt])

  // 3. The chosen player's form (only once the player list has arrived, so a player from the old list is never asked for).
  useEffect(() => {
    if (!playerId || !players?.some((pl) => pl.id === playerId)) return
    let cancelled = false
    fetchForm(playerId, gameType)
      .then((f) => !cancelled && setForm(f))
      .catch((e) => !cancelled && setError(errorText(e)))
    return () => {
      cancelled = true
    }
  }, [playerId, players, gameType, attempt])

  // 3b. The games behind the lines under the scorecards. The lines are an extra: if this fails the cards still show.
  useEffect(() => {
    if (!playerId || !players?.some((pl) => pl.id === playerId)) return
    let cancelled = false
    fetchRecent(playerId, gameType)
      .then((r) => !cancelled && setRecent(r))
      .catch(() => !cancelled && setRecent({ games: [] }))
    return () => {
      cancelled = true
    }
  }, [playerId, players, gameType, attempt])

  // 4. The chosen player's season grid. A failure here only affects the season panel, not the rest of the page.
  useEffect(() => {
    if (!playerId) return
    let cancelled = false
    fetchSeason(playerId)
      .then((s) => !cancelled && setSeason(s))
      .catch((e) => !cancelled && setSeasonError(errorText(e)))
    return () => {
      cancelled = true
    }
  }, [playerId, attempt])

  const data = form && !('none' in form) ? form : null
  const noGames = form !== null && 'none' in form
  const p = data?.player
  const notices = p ? formNotices(p, gameType) : []
  const words = gamesWord(gameType)
  const chosenName = players?.find((pl) => pl.id === playerId)?.name ?? 'This player'

  // The chosen team lights the page like a spotlight and sets the accent colours; the theme owns everything else.
  const look = teamLook(team)
  // Selected buttons (the toggle, the chart's pickers) and tooltip bubbles take the team's bright colour.
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
      {/* The spotlight: fixed to the screen so it stays put while the page scrolls, behind everything else. */}
      {look.wash !== 'none' && (
        <div aria-hidden className="pointer-events-none fixed inset-0 -z-10" style={{ backgroundImage: look.wash }} />
      )}
      <CourtBackground key={team} />
      <div className="mx-auto flex max-w-[1200px] flex-col gap-[26px]">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <div className="text-[22px] font-semibold tracking-tight" style={{ fontFamily: 'var(--display)' }}>
              Player form
            </div>
            <div className="text-[13px] text-(--muted)">Recent games as a range, not a single number</div>
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
          <div className="flex flex-col gap-1.5">
            <span className={labelClass}>3. Games</span>
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

        {noGames && (
          <section className={`flex flex-col gap-2 rounded-[18px] border border-(--border) bg-(--panel) p-5`} style={panelStyle}>
            <div className="text-xs font-semibold tracking-widest text-(--accent) uppercase">Player level · playoffs</div>
            <h1 className="m-0 text-[32px] leading-[1.1] font-semibold tracking-tight" style={{ fontFamily: 'var(--display)' }}>
              {chosenName}
            </h1>
            <div className="text-[15px] text-(--muted)">
              {chosenName} has no playoff games on record. Switch back to Regular season to see this player's form.
            </div>
          </section>
        )}

        {p && data && (
          <div key={`${playerId}-${gameType}`} className="stagger contents">
            <section className="flex flex-col gap-2">
              <div className="text-xs font-semibold tracking-widest text-(--accent) uppercase">
                Player level · last {p.l10Games} {words}
              </div>
              <div className="flex flex-wrap items-center gap-5">
                <PlayerAvatar name={p.name} playerId={playerId} />
                <div className="flex min-w-0 flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-3.5">
                    <h1 className="m-0 text-[44px] leading-[1.1] font-semibold tracking-tight" style={{ fontFamily: 'var(--display)' }}>
                      {p.name}
                    </h1>
                    <span className="inline-flex items-center gap-2 text-[15px] font-semibold text-(--accent)">
                      <TeamBadge abbrev={p.team} size={36} />
                      {p.team}
                    </span>
                  </div>
                  <div className="text-[15px] text-(--muted)">
                    Last {p.l10Games} {words} played · {shortDate(p.l10FirstDate)} to {shortDate(p.lastGameDate)} ·{' '}
                    {p.totalGames} {words} in the data
                  </div>
                </div>
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

            <div className="cards grid grid-cols-[repeat(auto-fit,minmax(min(340px,100%),1fr))] gap-4">
              {CARD_STATS.map((key) => (
                <Scorecard key={key} label={LABELS[key]} stat={data.stats[key]} statKey={key} games={p.l10Games} seasonLabel={p.seasonLabel} recent={recent?.games ?? null} />
              ))}
            </div>

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

            {seasonError ? (
              <div className="rounded-xl border border-(--warnBorder) bg-(--warnBg) px-4 py-3 text-sm text-(--warnText)" role="alert">
                The season chart could not load: {seasonError}
              </div>
            ) : (
              <SeasonGrid key={playerId} season={season} team={team} gameType={gameType} />
            )}

            <CombosTable stats={data.stats} />
          </div>
        )}

        <p className="max-w-3xl text-xs leading-normal text-(--muted)">
          Each figure describes the player's own recent games as a distribution. It is not a prediction. Data
          through {p ? shortDate(p.lastGameDate) : 'the latest games'}. Source: sportsdataverse (MIT, CC BY 4.0).
        </p>
      </div>
    </div>
  )
}
