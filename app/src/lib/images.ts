import { headshotUrl, initials, readableOn, teamLogoUrl, teamStyle } from './teams.ts'

/** What to draw for a player: the headshot address, or null to draw the initials instead. */
export type AvatarView = { src: string | null; initials: string }

export function avatarView(name: string, playerId: string | number | null | undefined, failed: boolean): AvatarView {
  const url = headshotUrl(playerId)
  return { src: failed ? null : url, initials: initials(name) }
}

/** What to draw for a team: the logo address, or null to draw a coloured badge with the letters instead. */
export type BadgeView = { src: string | null; label: string; bg: string; fg: string; ring: string }

export function badgeView(abbrev: string | null | undefined, failed: boolean): BadgeView {
  const s = teamStyle(abbrev)
  const url = teamLogoUrl(abbrev)
  return {
    src: failed ? null : url,
    label: (abbrev ?? '?').toUpperCase().slice(0, 3),
    bg: s.primary,
    fg: readableOn(s.primary),
    ring: s.secondary,
  }
}
