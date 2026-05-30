// Apify all-in-one BYOK ingestion adapter.
// Builds a SourceAdapter for any SocialSource backed by the Apify actor registry.
// Used in 'apify' ingestion mode (M9 Phase 8).
//
// IMPORTANT: this file MUST NOT import from registry.ts — registry.ts imports
// APIFY_ADAPTERS from here, so that direction would be a circular dependency.
// Source metadata (displayName, minPlan, pollIntervalMs) is defined locally below.

import { runActorSync, ApifyApiError } from '../lib/apify'
import { APIFY_ACTORS } from '../lib/apify-actors'
import { enrichRawTweet } from '../lib/enrich'
import { putTweet } from '../db/tweets'
import { APIFY_PROVIDER } from '../providers'
import type { Plan } from '../billing/tiers'
import type { SourceAdapter, IngestOpts, IngestResult, SocialSource } from './types'

// ── Local metadata table ──────────────────────────────────────────────────────
// Mirrors the minPlan / displayName / pollIntervalMs from each direct adapter.
// Apify runs are heavier than per-source direct calls, so all sources share a
// conservative 15-minute poll interval regardless of the direct adapter cadence.
// minPlan is kept identical to the direct adapter so entitlement is unchanged.

interface ApifySourceMeta {
  displayName: string
  minPlan: Plan
  /** ms — conservative 15 min for all Apify-backed sources (heavier runs). */
  pollIntervalMs: number
}

const APIFY_SOURCE_META: Record<SocialSource, ApifySourceMeta> = {
  twitter: {
    displayName: 'X',
    minPlan: 'free',
    pollIntervalMs: 15 * 60 * 1000,
  },
  reddit: {
    displayName: 'Reddit',
    minPlan: 'free',
    pollIntervalMs: 15 * 60 * 1000,
  },
  farcaster: {
    displayName: 'Farcaster',
    minPlan: 'free',
    pollIntervalMs: 15 * 60 * 1000,
  },
  telegram: {
    displayName: 'Telegram',
    minPlan: 'alpha',
    pollIntervalMs: 15 * 60 * 1000,
  },
  discord: {
    displayName: 'Discord',
    minPlan: 'free',
    pollIntervalMs: 15 * 60 * 1000,
  },
}

// ── Core ingest helper ────────────────────────────────────────────────────────

async function runApifyIngest(
  source: SocialSource,
  apiToken: string,
  query: string,
  maxItems: number,
  timeoutSecs: number,
  methodName: string,
): Promise<IngestResult> {
  const spec = APIFY_ACTORS[source]

  let rows: unknown[]
  try {
    rows = await runActorSync(apiToken, spec.actorId, spec.buildInput(query, { maxItems }), {
      timeoutSecs,
    })
  } catch (err) {
    if (err instanceof ApifyApiError && err.status === 408) {
      // Timeout — treat as partial/empty rather than a hard failure for manual search
      console.warn(`[apifyAdapter(${source}).${methodName}] actor timed out (408); returning 0`)
      return { source, ingested: 0 }
    }
    // 401/403 or other errors — re-throw so the caller can mark the key invalid / surface the error
    throw err
  }

  const writeResults = await Promise.allSettled(
    rows.flatMap((row) => {
      const raw = spec.normalize(row)
      if (raw === null) return []
      return [
        (async () => {
          const tweet = enrichRawTweet(raw, query, { source })
          await putTweet(tweet)
        })(),
      ]
    }),
  )

  let ingested = 0
  for (const result of writeResults) {
    if (result.status === 'fulfilled') {
      ingested++
    } else {
      console.error(`[apifyAdapter(${source}).${methodName}] putTweet failed:`, result.reason)
    }
  }

  return { source, ingested }
}

// ── Factory ───────────────────────────────────────────────────────────────────

export function makeApifyAdapter(source: SocialSource): SourceAdapter {
  const meta = APIFY_SOURCE_META[source]

  return {
    id: source,
    displayName: `${meta.displayName} (Apify)`,
    minPlan: meta.minPlan,
    pollIntervalMs: meta.pollIntervalMs,
    implemented: true,
    byokProvider: APIFY_PROVIDER,

    async search(apiToken: string, query: string, opts?: IngestOpts): Promise<IngestResult> {
      const maxItems = (opts?.maxPages ?? 5) * 20
      return runApifyIngest(source, apiToken, query, maxItems, 60, 'search')
    },

    async since(apiToken: string, query: string, _opts?: IngestOpts): Promise<IngestResult> {
      // Apify has no since-cursor; fetch recent and rely on putTweet idempotency.
      return runApifyIngest(source, apiToken, query, 40, 60, 'since')
    },
  }
}

// ── Registry ──────────────────────────────────────────────────────────────────

export const APIFY_ADAPTERS: Partial<Record<SocialSource, SourceAdapter>> = {
  twitter: makeApifyAdapter('twitter'),
  reddit: makeApifyAdapter('reddit'),
  farcaster: makeApifyAdapter('farcaster'),
  telegram: makeApifyAdapter('telegram'),
  discord: makeApifyAdapter('discord'),
}
