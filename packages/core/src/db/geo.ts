import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb'
import { Resource } from 'sst'
import { ddb } from './client'

// ── Junk-location pre-filter ─────────────────────────────────────────────────

const PRONOUN_DENYLIST = [
  'she/her', 'they/them', 'he/him',
  'she/they', 'he/they', 'any/all',
]

export function isJunkLocation(raw: string): boolean {
  const trimmed = raw.trim()
  // 1. Empty / whitespace-only
  if (!trimmed) return true
  // 2. Length < 2 after trim
  if (trimmed.length < 2) return true
  // 3. Emoji-only / no alpha chars after stripping emoji and flag codepoints
  const stripped = trimmed
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/[\u{1F1E6}-\u{1F1FF}]/gu, '')
    .trim()
  if (!stripped || !/[a-zA-Z]/.test(stripped)) return true
  // 4. Pronoun denylist (case-insensitive)
  const lower = trimmed.toLowerCase()
  if (PRONOUN_DENYLIST.some(p => lower === p)) return true
  return false
}

// ── City interface (for dependency-injected offline dataset) ─────────────────

export interface City {
  name: string
  asciiName: string
  country: string
  countryCode: string
  lat: number
  lng: number
  population: number
  alternateNames: string[]
}

// ── Geo lookup result ────────────────────────────────────────────────────────

export interface GeoResult {
  country?: string
  countryCode?: string
  lat?: number
  lng?: number
}

// ── DynamoDB cache helpers ───────────────────────────────────────────────────

function tableName(): string {
  return Resource.AuthorLocations.name
}

interface CacheRow {
  pk: string
  sk: string
  raw: string
  country?: string
  countryCode?: string
  lat?: number
  lng?: number
  source: 'bundled' | 'opencage' | 'miss'
  lookedUpAt: string
}

async function cacheGet(key: string): Promise<CacheRow | null> {
  const { Item } = await ddb.send(new GetCommand({
    TableName: tableName(),
    Key: { pk: `GEO#${key}`, sk: 'META' },
  }))
  return (Item as CacheRow) ?? null
}

async function cachePut(row: CacheRow): Promise<void> {
  await ddb.send(new PutCommand({
    TableName: tableName(),
    Item: row,
  }))
}

// ── Offline city index builder ───────────────────────────────────────────────

function buildOfflineIndex(cities: City[]): Map<string, City> {
  const index = new Map<string, City>()
  for (const city of cities) {
    index.set(city.name.toLowerCase(), city)
    if (city.asciiName) index.set(city.asciiName.toLowerCase(), city)
    for (const alt of city.alternateNames ?? []) {
      if (alt && !index.has(alt.toLowerCase())) {
        index.set(alt.toLowerCase(), city)
      }
    }
  }
  return index
}

// ── OpenCage fetch ───────────────────────────────────────────────────────────

async function fetchOpenCage(raw: string): Promise<GeoResult | 'rate-limited' | 'not-found'> {
  const apiKey = process.env.OPENCAGE_API_KEY
  if (!apiKey) return 'not-found'

  const url = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(raw)}&key=${apiKey}&limit=1&no_annotations=1`
  const res = await fetch(url)

  if (res.status === 429 || res.status >= 500) return 'rate-limited'
  if (res.status === 404) return 'not-found'
  if (!res.ok) return 'not-found'

  const data = (await res.json()) as {
    results?: Array<{
      components?: { country?: string; country_code?: string }
      geometry?: { lat?: number; lng?: number }
    }>
    total_results?: number
  }

  if (!data.results || data.results.length === 0 || (data.total_results ?? 0) === 0) {
    return 'not-found'
  }

  const result = data.results[0]
  return {
    country: result.components?.country,
    countryCode: result.components?.country_code?.toUpperCase(),
    lat: result.geometry?.lat,
    lng: result.geometry?.lng,
  }
}

// ── Main lookup function ─────────────────────────────────────────────────────

/**
 * Looks up a raw Twitter location string through a two-layer cache:
 *   1. DynamoDB permanent cache (including "miss" rows).
 *   2. Offline GeoNames city index (pass in via `deps.offlineCities`).
 *   3. OpenCage API fallback.
 *
 * Pass `deps.offlineCities` from the GeoNames cities5000 dataset.
 * When omitted, the offline layer is skipped and only the cache + API are used.
 */
export async function lookupLocation(
  raw: string,
  deps?: { offlineCities?: City[] },
): Promise<GeoResult | null> {
  // Step 1 — pre-filter junk
  if (isJunkLocation(raw)) return null

  const cacheKey = raw.toLowerCase().trim()

  // Step 2 — DynamoDB cache hit
  const cached = await cacheGet(cacheKey)
  if (cached) {
    if (cached.source === 'miss') return null
    return {
      country: cached.country,
      countryCode: cached.countryCode,
      lat: cached.lat,
      lng: cached.lng,
    }
  }

  const now = new Date().toISOString()

  // Step 3 — offline city match
  if (deps?.offlineCities && deps.offlineCities.length > 0) {
    const index = buildOfflineIndex(deps.offlineCities)
    const match = index.get(cacheKey)
    if (match) {
      const result: GeoResult = {
        country: match.country,
        countryCode: match.countryCode,
        lat: match.lat,
        lng: match.lng,
      }
      await cachePut({
        pk: `GEO#${cacheKey}`,
        sk: 'META',
        raw,
        source: 'bundled',
        lookedUpAt: now,
        ...result,
      })
      return result
    }
  }

  // Step 4 — OpenCage API
  const apiResult = await fetchOpenCage(raw)
  if (apiResult === 'rate-limited') {
    // Do NOT cache; let the next ingest retry
    return null
  }
  if (apiResult === 'not-found') {
    await cachePut({
      pk: `GEO#${cacheKey}`,
      sk: 'META',
      raw,
      source: 'miss',
      lookedUpAt: now,
    })
    return null
  }

  await cachePut({
    pk: `GEO#${cacheKey}`,
    sk: 'META',
    raw,
    source: 'opencage',
    lookedUpAt: now,
    ...apiResult,
  })
  return apiResult
}
