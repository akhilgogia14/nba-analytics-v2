import { useEffect, useState, type CSSProperties } from 'react'
import { fetchGameDetail } from './api.ts'
import { CourtBackground } from './components/CourtBackground.tsx'
import { KpiTiles } from './components/KpiTiles.tsx'
import { PageSwitch } from './components/PageSwitch.tsx'
import { shortDate } from './lib/format.ts'
import { chartPalette } from './lib/hex.ts'
import { loadPicks, orderPicks, pickText, recordOf, resultFrom, savePicks, type Pick, type Tally } from './lib/picks.ts'
import { parseHash } from './lib/pages.ts'
import { easternDate } from './lib/slate.ts'
import { panelStyle, pillClass, pillStyle } from './lib/styles.ts'
import { readableOn } from './lib/teams.ts'
import { teamLook } from './lib/teamTheme.ts'
import { THEME } from './lib/themes.ts'

const tallyText = (t: Tally & { pushes: number }): string => `${t.wins}-${t.losses}${t.pushes ? `-${t.pushes}` : ''}`
const pct = (v: number | null): string => (v === null ? '-' : `${Math.round(v * 100)}%`)

const OUTCOME_TEXT = { win: 'Won', loss: 'Lost', push: 'Push', void: 'Void (did not play)' } as const
const OUTCOME_COLOR = { win: '#4ADE80', loss: '#F87171', push: 'var(--muted)', void: 'var(--muted)' } as const

/**
 * Paper picks: the picks saved from Predictions (kept in this browser), graded from the real box score once each game is final, with the
 * record and how it compares with going the way the baseline pointed. Nothing is placed anywhere.
 */
export default function PicksPage() {
  const [picks, setPicks] = useState<Pick[]>(loadPicks)
  const [checking, setChecking] = useState(() => picks.some((p) => !p.result && p.gameDate.slice(0, 10) <= easternDate())) // games to look up
  const [confirm, setConfirm] = useState<string | null>(null)
  const team = parseHash(window.location.hash).team

  // Look up every pick whose game date has come and that has no result yet; a final result is kept so it is never looked up again.
  useEffect(() => {
    const today = easternDate()
    const due = loadPicks().filter((p) => !p.result && p.gameDate.slice(0, 10) <= today)
    if (due.length === 0) return
    let cancelled = false
    ;(async () => {
      const found = new Map<string, Pick['result']>()
      for (const p of due) {
        const detail = await fetchGameDetail(p.playerId, p.gameId).catch(() => null) // not found or a hiccup: still open, tried again next visit
        const r = resultFrom(p, detail)
        if (r) found.set(p.id, r)
      }
      if (cancelled) return
      if (found.size > 0) {
        const next = loadPicks().map((p) => (found.has(p.id) ? { ...p, result: found.get(p.id) } : p)) // read again: a pick may have been added or removed meanwhile
        savePicks(next)
        setPicks(next)
      }
    })().finally(() => !cancelled && setChecking(false))
    return () => {
      cancelled = true
    }
  }, [])

  function remove(id: string) {
    const next = picks.filter((p) => p.id !== id)
    savePicks(next)
    setPicks(next)
    setConfirm(null)
  }
  function download() {
    const blob = new Blob([JSON.stringify(picks, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `paper-picks-${easternDate()}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

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

  const rec = recordOf(picks)
  const list = orderPicks(picks)

  return (
    <div className="relative isolate min-h-screen px-6 pt-8 pb-14" style={rootStyle}>
      {look.wash !== 'none' && <div aria-hidden className="pointer-events-none fixed inset-0 -z-10" style={{ backgroundImage: look.wash }} />}
      <CourtBackground key={team} />
      <div className="mx-auto flex max-w-[1200px] flex-col gap-[26px]">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <div className="text-[22px] font-semibold tracking-tight" style={{ fontFamily: 'var(--display)' }}>
              Picks
            </div>
            <div className="text-[13px] text-(--muted)">Paper picks: your calls, graded from the real box score. Nothing here is placed anywhere.</div>
          </div>
          <PageSwitch page="picks" team={team} />
        </header>

        {picks.length === 0 ? (
          <section className="flex max-w-3xl flex-col gap-2 rounded-[18px] border border-(--border) bg-(--panel) p-5" style={panelStyle}>
            <h2 className="m-0 text-[20px] font-semibold tracking-tight" style={{ fontFamily: 'var(--display)' }}>
              No picks yet
            </h2>
            <p className="m-0 text-[14px] leading-relaxed text-(--muted)">
              Open Predictions, click a stat tile, choose over or under, type a line and save it. After the game is final it shows up here with the real number
              and a win, loss or push.
            </p>
            <a href="#/predictions" className="text-[14px] font-semibold text-(--accent)">Go to Predictions</a>
          </section>
        ) : (
          <>
            <section className="flex flex-col gap-3 rounded-[18px] border border-(--border) bg-(--panel) p-5" style={panelStyle}>
              <h2 className="m-0 text-[20px] font-semibold tracking-tight" style={{ fontFamily: 'var(--display)' }}>
                How the picks did
              </h2>
              <KpiTiles
                caption="All graded picks"
                tiles={[
                  { label: 'Record (W-L-P)', value: tallyText(rec) },
                  { label: 'Hit rate', value: pct(rec.hitRate), detail: 'Wins out of wins plus losses. Pushes (landed exactly on the line) and voids (he did not play) are left out.' },
                  { label: 'Open', value: String(rec.pending), detail: 'Picks whose game is not final yet.' },
                  { label: 'With the baseline', value: `${tallyText(rec.agreed)} · ${pct(rec.agreed.hitRate)}`, detail: 'Picks on the side the baseline pointed to (baseline above the line is Over, below is Under).' },
                  { label: 'Against it', value: `${tallyText(rec.against)} · ${pct(rec.against.hitRate)}`, detail: 'Picks on the other side from the baseline.' },
                ]}
                minWidth={150}
              />
              <p className="m-0 max-w-3xl text-[13px] leading-relaxed text-(--muted)">
                A short record says little. Treat the hit rate as meaningful only after many picks, and compare it with 50%, which is what a coin flip gives you before
                any cost of betting.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={download} className={pillClass} style={pillStyle(false)}>
                  Download my picks (backup)
                </button>
                {checking && <span className="text-[13px] text-(--muted)">Checking finished games...</span>}
              </div>
            </section>

            <section className="flex flex-col gap-1 rounded-[18px] border border-(--border) bg-(--panel) p-5" style={panelStyle}>
              <h2 className="m-0 mb-2 text-[20px] font-semibold tracking-tight" style={{ fontFamily: 'var(--display)' }}>
                Your picks
              </h2>
              <ul className="m-0 flex list-none flex-col p-0">
                {list.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-(--rowLine) py-3 text-[14px]">
                    <div className="flex min-w-0 flex-col">
                      <div className="font-semibold">
                        {p.playerName || 'Player'} · {pickText(p)}
                      </div>
                      <div className="text-[13px] text-(--muted)">
                        {shortDate(p.gameDate)} {p.isHome ? 'vs' : 'at'} {p.opp || '?'}
                        {p.baseline !== null && <> · baseline when saved {p.baseline.toFixed(1)}</>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {p.result ? (
                        <span className="font-semibold" style={{ color: OUTCOME_COLOR[p.result.outcome] }}>
                          {OUTCOME_TEXT[p.result.outcome]}
                          {p.result.actual !== null && <span className="text-(--text)"> · he had {p.result.actual}</span>}
                        </span>
                      ) : (
                        <span className="text-(--muted)">Open</span>
                      )}
                      {confirm === p.id ? (
                        <span className="flex items-center gap-2">
                          <button type="button" onClick={() => remove(p.id)} className={pillClass} style={pillStyle(true)}>
                            Remove it
                          </button>
                          <button type="button" onClick={() => setConfirm(null)} className={pillClass} style={pillStyle(false)}>
                            Keep
                          </button>
                        </span>
                      ) : (
                        <button type="button" onClick={() => setConfirm(p.id)} aria-label={`Remove ${pickText(p)} pick`} className={pillClass} style={pillStyle(false)}>
                          Remove
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              <p className="m-0 mt-2 text-[12px] text-(--muted)">Saved in this browser only. A different device or a cleared browser starts with an empty list, so download a backup now and then.</p>
            </section>
          </>
        )}
      </div>
    </div>
  )
}
