import type { Plan } from '../billing/tiers'

export type SocialSource = 'twitter' | 'farcaster' | 'reddit' | 'telegram' | 'discord'

export const ALL_SOURCES: SocialSource[] = ['twitter', 'farcaster', 'reddit', 'telegram', 'discord']

/** Type guard: true when `x` is a recognised SocialSource value. */
export function isSocialSource(x: unknown): x is SocialSource {
  return ALL_SOURCES.includes(x as SocialSource)
}

export interface IngestOpts {
  maxPages?: number
  /** Optional offline geo dataset (cities) passed by callers that geo-enrich authors. */
  offlineCities?: unknown[]
}

export interface IngestResult {
  source: SocialSource
  ingested: number
}

export interface SourceAdapter {
  readonly id: SocialSource
  readonly displayName: string
  /** Minimum entitlement tier required to use this source. */
  readonly minPlan: Plan
  /** Polling cadence floor in ms (cost-control policy enforced by the poller). */
  readonly pollIntervalMs: number
  /** False until the concrete ingestor lands (later phases). */
  readonly implemented: boolean
  /** BYOK provider name for per-user key lookup, or null if no per-user key needed. */
  readonly byokProvider: string | null
  /** Manual on-demand search: fetch + persist matching posts for `query`. Returns count. */
  search(apiKey: string, query: string, opts?: IngestOpts): Promise<IngestResult>
  /** Incremental poll: fetch + persist posts newer than the last-seen cursor. Returns count. */
  since(apiKey: string, query: string, opts?: IngestOpts): Promise<IngestResult>
}
