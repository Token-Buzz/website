import type { TogglEntry } from './time-tracking.js'

const BASE_URL = 'https://api.track.toggl.com/api/v9'

function authHeader(token: string): string {
  return 'Basic ' + Buffer.from(`${token}:api_token`).toString('base64')
}

async function togglFetch(token: string, path: string, init?: RequestInit): Promise<unknown> {
  const url = `${BASE_URL}${path}`
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: authHeader(token),
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Toggl API error ${res.status} ${res.statusText}: ${body}`)
  }

  const text = await res.text()
  if (!text) return null
  return JSON.parse(text)
}

export async function getCurrentEntry(token: string): Promise<TogglEntry | null> {
  const data = await togglFetch(token, '/me/time_entries/current')
  if (!data || typeof data !== 'object') return null
  return mapEntry(data as Record<string, unknown>)
}

export async function startEntry(opts: {
  token: string
  workspaceId: string
  description: string
  tags: string[]
}): Promise<TogglEntry> {
  const { token, workspaceId, description, tags } = opts
  const data = await togglFetch(token, `/workspaces/${workspaceId}/time_entries`, {
    method: 'POST',
    body: JSON.stringify({
      created_with: 'track-cli',
      description,
      tags,
      workspace_id: Number(workspaceId),
      duration: -1,
      start: new Date().toISOString(),
    }),
  })
  return mapEntry(data as Record<string, unknown>)
}

export async function stopEntry(opts: {
  token: string
  workspaceId: string
  entryId: number
}): Promise<TogglEntry> {
  const { token, workspaceId, entryId } = opts
  const data = await togglFetch(token, `/workspaces/${workspaceId}/time_entries/${entryId}/stop`, {
    method: 'PATCH',
  })
  return mapEntry(data as Record<string, unknown>)
}

export async function listEntries(opts: {
  token: string
  since: Date
  until: Date
}): Promise<TogglEntry[]> {
  const { token, since, until } = opts
  const startDate = encodeURIComponent(since.toISOString())
  const endDate = encodeURIComponent(until.toISOString())
  const data = await togglFetch(token, `/me/time_entries?start_date=${startDate}&end_date=${endDate}`)
  if (!Array.isArray(data)) return []
  return data.map(e => mapEntry(e as Record<string, unknown>))
}

function mapEntry(raw: Record<string, unknown>): TogglEntry {
  return {
    id: raw['id'] as number,
    description: (raw['description'] as string | null | undefined) ?? null,
    duration: raw['duration'] as number,
    tags: Array.isArray(raw['tags']) ? (raw['tags'] as string[]) : [],
    start: raw['start'] as string,
    stop: (raw['stop'] as string | null | undefined) ?? null,
  }
}
