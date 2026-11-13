import type { FormResult, GameType, Meetings, PlayerOption, Recent, Season, Team } from './types.ts'

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new Error(body?.error ?? `Request failed (HTTP ${res.status})`)
  return body as T
}

export const fetchTeams = (type: GameType) => getJson<Team[]>(`/api/teams?type=${type}`)
export const fetchPlayers = (team: string, type: GameType) =>
  getJson<PlayerOption[]>(`/api/teams/${encodeURIComponent(team)}/players?type=${type}`)
export const fetchForm = (id: string, type: GameType) =>
  getJson<FormResult>(`/api/players/${encodeURIComponent(id)}/form?type=${type}`)
export const fetchSeason = (id: string) => getJson<Season>(`/api/players/${encodeURIComponent(id)}/season`)
export const fetchRecent = (id: string, type: GameType) =>
  getJson<Recent>(`/api/players/${encodeURIComponent(id)}/games?type=${type}`)
export const fetchMeetings = (id: string, type: GameType, opp: string) =>
  getJson<Meetings>(`/api/players/${encodeURIComponent(id)}/meetings?type=${type}&opp=${encodeURIComponent(opp)}`)
