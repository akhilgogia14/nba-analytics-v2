import { useState } from 'react'
import { loadPicks, parseLine, pickId, pickText, savePicks, withPick, type Pick, type PickStat, type Side } from '../lib/picks.ts'
import { shortDate } from '../lib/format.ts'
import { pillClass, pillStyle } from '../lib/styles.ts'
import type { NextGame } from '../types.ts'

/** Half-point lines are the usual shape ("20.5"), so the baseline rounded to the nearest .5 is a starting point for the box. */
const startLine = (base: number | null): string => (base === null ? '' : String(Math.round(base - 0.5) + 0.5))

/**
 * "Save a pick" for the stat that is open on Predictions: over or under, the line you type, for his next game. It is a paper pick kept in
 * this browser (see lib/picks.ts); nothing is placed anywhere.
 */
export function AddPick({ stat, base, next, playerId, playerName, team }: { stat: PickStat; base: number | null; next: NextGame; playerId: string; playerName: string; team: string }) {
  const id = pickId(playerId, next.id, stat)
  const [side, setSide] = useState<Side>('over')
  const [text, setText] = useState(() => startLine(base))
  const [saved, setSaved] = useState<Pick | null>(() => loadPicks().find((p) => p.id === id) ?? null)
  const [note, setNote] = useState('')
  const line = parseLine(text)

  function save() {
    if (line === null) return
    const pick: Pick = {
      id, playerId, playerName, team, opp: next.opp, isHome: next.isHome, gameId: next.id, gameDate: next.date, stat, side, line, baseline: base, savedAt: new Date().toISOString(),
    }
    if (savePicks(withPick(loadPicks(), pick))) {
      setSaved(pick)
      setNote('')
    } else setNote('This browser would not save it (private window or blocked storage).')
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-(--border) px-4 py-3" role="group" aria-label="Save a paper pick">
      <div className="text-xs font-semibold tracking-wider text-(--muted) uppercase">Paper pick for {shortDate(next.date)} vs {next.opp}</div>
      <div className="flex flex-wrap items-center gap-2">
        {(['over', 'under'] as const).map((s) => (
          <button key={s} type="button" aria-pressed={side === s} onClick={() => setSide(s)} className={pillClass} style={pillStyle(side === s)}>
            {s === 'over' ? 'Over' : 'Under'}
          </button>
        ))}
        <label className="flex items-center gap-2 text-[13px] text-(--muted)">
          Line
          <input
            inputMode="decimal"
            value={text}
            onChange={(e) => setText(e.target.value)}
            aria-label="Line"
            aria-invalid={text !== '' && line === null}
            className="h-9 w-20 rounded-lg border border-(--pillBorder) bg-(--inputBg) px-2 text-[15px] font-semibold text-(--text)"
          />
        </label>
        <button type="button" disabled={line === null} onClick={save} className={`${pillClass} disabled:opacity-50`} style={pillStyle(true)}>
          {saved ? 'Replace pick' : 'Save pick'}
        </button>
      </div>
      {text !== '' && line === null && <div className="text-[13px] text-(--warnText)">Type the line as a number, like 20.5.</div>}
      {note && <div className="text-[13px] text-(--warnText)">{note}</div>}
      {saved && (
        <div className="text-[13px] text-(--muted)">
          Saved: {pickText(saved)}. <a href="#/picks" className="font-semibold text-(--accent)">See your picks</a>
        </div>
      )}
    </div>
  )
}
