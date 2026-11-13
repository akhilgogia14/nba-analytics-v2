import type { FormResult, GameType, PlayerOption, Season, Team } from './types.ts'

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new Error(body?.error ?? `Request failed (HTTP ${res.status})`)
  return body as T
}

export const fetchTeams = () => getJson<Team[]>('/api/teams')
export const fetchPlayers = (team: string) => getJson<PlayerOption[]>(`/api/teams/${encodeURIComponent(team)}/players`)
export const fetchForm = (id: string, type: GameType) =>
  getJson<FormResult>(`/api/players/${encodeURIComponent(id)}/form?type=${type}`)
export const fetchSeason = (id: string) => getJson<Season>(`/api/players/${encodeURIComponent(id)}/season`)
