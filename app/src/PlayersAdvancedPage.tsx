import { useEffect, useState, type CSSProperties } from 'react'
import { fetchPlayerContext, fetchPlayers, fetchTeams } from './api.ts'
import { CourtBackground } from './components/CourtBackground.tsx'
import { PageSwitch } from './components/PageSwitch.tsx'
import { TeamTabs } from './components/TeamTabs.tsx'
import { COMPARISONS, MIN_TEAM_GAMES, applicableComparisons, difference, enoughGames, fmtDiff, fmtValue, nextGameFacts, orderComparisons, tooFewText } from './lib/context.ts'
import { KpiTiles } from './components/KpiTiles.tsx'
import { shortDate, teamLabel } from './lib/format.ts'
import { GAME_TYPE_OPTIONS } from './lib/gameType.ts'
import { chartPalette } from './lib/hex.ts'
import { parseHash, playerFromHash, rememberTeam } from './lib/pages.ts'
import { PLAYER_STAT_LIST, availabilityText, b2bAvailabilityLine, fmtLeague, fmtShareDiff, playedShare } from './lib/playerContext.ts'
import { panelStyle, pillClass, pillStyle } from './lib/styles.ts'
import { readableOn } from './lib/teams.ts'
import { teamLook } from './lib/teamTheme.ts'
import { THEME } from './lib/themes.ts'
import type { GameType, PlayerContext, PlayerOption, PlayerSplit, Team } from './types.ts'

const selectClass =
  'h-12 rounded-xl border border-(--pillBorder) bg-(--inputBg) px-3.5 text-[15px] font-semibold text-(--text) disabled:opacity-50'
const labelClass = 'text-xs font-semibold tracking-wider text-(--muted) uppercase'
const cell = 'px-1.5 py-2 text-right text-[13px] md:px-3 md:text-[14px] tabular-nums whitespace-nowrap'
const head = 'px-1.5 py-2 text-right text-[10px] font-semibold tracking-normal md:px-3 md:text-xs md:tracking-wider text-(--muted) uppercase whitespace-nowrap'

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong.'
}
const games = (n: number) => n.toLocaleString('en-US')
const seasons = (s: PlayerSplit) => (s.firstSeason && s.lastSeason ? (s.firstSeason === s.lastSeason ? s.firstSeason : `${s.firstSeason} to ${s.lastSeason}`) : '')

/** One comparison: the league effect as small tiles, then how often he played in each situation, then his own averages (only when he played enough games on each side). */
function ComparisonPanel({ c, ctx, highlighted }: { c: (typeof COMPARISONS)[number]; ctx: PlayerContext; highlighted: boolean }) {
  const lA = ctx.league.buckets[c.a]
  const lB = ctx.league.buckets[c.b]
  const pA = ctx.player.buckets[c.a]
  const pB = ctx.player.buckets[c.b]
  const share = fmtShareDiff(playedShare(lA), playedShare(lB))
  const tiles = [
    ...PLAYER_STAT_LIST.map((s) => {
      const l = difference(ctx.league, c.a, c.b, s.key, 1)
      return { label: s.label, value: l ? fmtLeague(l.diff) : '-' }
    }),
    { label: 'Share of games played', value: share },
  ]
  const own = enoughGames(pA?.n ?? 0, pB?.n ?? 0)
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
        caption={`League pattern: ${c.aLabel} minus ${c.bLabel}, against a player's own season average (${seasons(ctx.league)}; ${games(lA?.n ?? 0)} and ${games(lB?.n ?? 0)} player games)`}
      />
      <div className="flex flex-col gap-2">
        <div className="text-xs font-semibold tracking-wider text-(--muted) uppercase">This player, {seasons(ctx.player) || 'this season'}</div>
        <div className="text-[14px] text-(--muted)">
          {c.aLabel}: {availabilityText(pA)} · {c.bLabel}: {availabilityText(pB)}
        </div>
        {own ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={`${head} text-left!`}>Stat</th>
                  <th className={head}>
                    {c.aLabel} ({pA?.n ?? 0})
                  </th>
                  <th className={head}>
                    {c.bLabel} ({pB?.n ?? 0})
                  </th>
                  <th className={head}>Diff</th>
                </tr>
              </thead>
              <tbody>
                {PLAYER_STAT_LIST.map((s) => {
                  const p = difference(ctx.player, c.a, c.b, s.key, MIN_TEAM_GAMES)
                  return (
                    <tr key={s.key} className="border-t border-(--border)">
                      <th scope="row" className="px-1.5 py-2 text-left text-[13px] font-semibold md:px-3 md:text-[14px]">
                        {s.label}
                      </th>
                      <td className={cell}>{p ? fmtValue('pts', p.a) : '-'}</td>
                      <td className={cell}>{p ? fmtValue('pts', p.b) : '-'}</td>
                      <td className={`${cell} font-semibold`}>{p ? fmtDiff('pts', p.diff) : '-'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-[14px] text-(--muted)">{tooFewText(c.aLabel, pA?.n ?? 0, c.bLabel, pB?.n ?? 0)}</div>
        )}
      </div>
    </section>
  )
}

/**
 * Players > Advanced stats. Like the Teams tab, the page leads with the player's next game (his team's), then shows how his games
 * went in each situation: the league effect over every season on record (each player measured against his own average, so it
 * does not depend on who tends to play) and this player's own games this season (a small sample, shown muted, with how many
 * team games he played in each situation). Nothing on the Overview tab is changed. One game type at a time, never a mix.
 */
export default function PlayersAdvancedPage() {
  const [teams, setTeams] = useState<Team[] | null>(null)
  const [team, setTeam] = useState(() => parseHash(window.location.hash).team)
  const [players, setPlayers] = useState<PlayerOption[] | null>(null)
  const [playerId, setPlayerId] = useState(() => playerFromHash(window.location.hash))
  const [gameType, setGameType] = useState<GameType>('regular-season')
  const [ctx, setCtx] = useState<PlayerContext | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  function chooseTeam(code: string) {
    setTeam(code)
    setPlayers(null)
    setPlayerId('')
    setCtx(null)
    setError('')
  }
  function choosePlayer(id: string) {
    setPlayerId(id)
    setCtx(null)
    setError('')
  }
  function chooseGameType(t: GameType) {
    if (t === gameType) return
    setGameType(t)
    setTeams(null)
    setPlayers(null)
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

  useEffect(() => rememberTeam('players', team, 'advanced', playerId), [team, playerId])

  const listed = !!playerId && !!players?.some((pl) => pl.id === playerId)
  useEffect(() => {
    if (!listed) return
    let cancelled = false
    fetchPlayerContext(playerId, gameType)
      .then((c) => !cancelled && setCtx(c))
      .catch((e) => !cancelled && setError(errorText(e)))
    return () => {
      cancelled = true
    }
  }, [playerId, listed, gameType, attempt])

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
  const next = ctx?.next ?? null
  const highlighted = applicableComparisons(next)
  const noGames = ctx !== null && Object.keys(ctx.player.buckets).length === 0
  const b2bLine = ctx ? b2bAvailabilityLine(ctx.player.buckets, gameType === 'playoffs') : null

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
            <div className="text-[13px] text-(--muted)">How a player's games change with home or away, days of rest and back-to-backs</div>
          </div>
          <PageSwitch page="players" team={team} />
        </header>

        <TeamTabs view="advanced" page="players" team={team} player={playerId} />

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
          <div className="flex flex-col gap-1.5">
            <span className={labelClass}>3. Games</span>
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
          <div key={`${playerId}-${gameType}`} className="stagger contents">
            <section className="flex flex-col gap-2 rounded-[18px] border border-(--border) bg-(--panel) p-5" style={panelStyle}>
              <div className="text-xs font-semibold tracking-widest text-(--accent) uppercase">Next game</div>
              <h1 className="m-0 text-[32px] leading-[1.1] font-semibold tracking-tight" style={{ fontFamily: 'var(--display)' }}>
                {playerName}
              </h1>
              {next ? (
                <>
                  <div className="text-[15px] font-semibold">
                    {ctx.team ? `${teamLabel(ctx.team)} · ` : ''}
                    {shortDate(next.date)}
                  </div>
                  <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                    {nextGameFacts(next).map((f) => (
                      <li key={f} className="rounded-full border border-(--pillBorder) bg-(--pill) px-3 py-1 text-[13px] font-semibold text-(--pillText)">
                        {f}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <div className="text-[15px] text-(--muted)">No {gameType === 'playoffs' ? 'playoff ' : ''}game on the schedule yet for this player's team.</div>
              )}
              {b2bLine && <div className="text-[13px] text-(--muted)">{b2bLine}</div>}
            </section>

            {noGames ? (
              <div className="text-[15px] text-(--muted)">This player has no {gameType === 'playoffs' ? 'playoff ' : ''}games on record this season, so there is nothing to split.</div>
            ) : (
              <>
                <p className="m-0 max-w-3xl text-[14px] leading-relaxed text-(--muted)">
                  In five seasons of data, a player's own split in one half of a season did not predict the other half. Treat his numbers as context, not a trait and not a forecast.
                </p>
                <details className="max-w-3xl text-[14px] leading-relaxed text-(--muted)">
                  <summary className="min-h-11 cursor-pointer font-semibold text-(--text)">How to read this</summary>
                  <ul className="m-0 mt-1 flex list-disc flex-col gap-1.5 pl-5">
                    <li>
                      <strong className="text-(--text)">League pattern (tiles):</strong> how far a stat moves from a player's own season average in that situation, across every player and
                      season on record (20+ games in a season). The effects are small, usually well under one point or one minute.
                    </li>
                    <li>
                      <strong className="text-(--text)">This player (line and table):</strong> how many of his team's games he played in each situation (games missed to injury, rest or a
                      trade count), then his own averages. A comparison needs at least {MIN_TEAM_GAMES} games he played on each side.
                    </li>
                    <li>Games are compared as played, so opponents and home or away mix in with rest.</li>
                  </ul>
                </details>
                {orderComparisons(highlighted).map((c) => (
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
