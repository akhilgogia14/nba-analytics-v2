import { useState } from 'react'
import { avatarView, badgeView } from '../lib/images.ts'

/** Player headshot from the NBA's public image address; initials if it does not load. */
export function PlayerAvatar({ name, playerId, size = 88 }: { name: string; playerId: string; size?: number }) {
  // Remember "failed" per player, so a new player gets a fresh try.
  const [failedFor, setFailedFor] = useState('')
  const v = avatarView(name, playerId, failedFor === playerId)
  return (
    <span
      role="img"
      aria-label={`${name}`}
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-(--border) bg-(--panel) font-semibold text-(--muted)"
      style={{ width: size, height: size, fontSize: size * 0.34 }}
    >
      {v.src ? (
        <img
          src={v.src}
          alt=""
          loading="lazy"
          onError={() => setFailedFor(playerId)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 12%' }}
        />
      ) : (
        v.initials
      )}
    </span>
  )
}

/** Team logo from the NBA's public image address; a coloured badge with the letters if it does not load. */
export function TeamBadge({ abbrev, size = 40 }: { abbrev: string; size?: number }) {
  const [failedFor, setFailedFor] = useState('')
  const v = badgeView(abbrev, failedFor === abbrev)
  return (
    <span
      role="img"
      aria-label={`${abbrev} team logo`}
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold"
      style={{
        width: size,
        height: size,
        background: v.src ? '#ffffff' : v.bg,
        color: v.fg,
        boxShadow: `0 0 0 2px ${v.ring}`,
        fontSize: Math.max(size * 0.34, 11),
        letterSpacing: '0.02em',
      }}
    >
      {v.src ? (
        <img
          src={v.src}
          alt=""
          loading="lazy"
          onError={() => setFailedFor(abbrev)}
          style={{ width: '78%', height: '78%', objectFit: 'contain' }}
        />
      ) : (
        v.label
      )}
    </span>
  )
}
