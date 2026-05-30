import { SOURCE_ADAPTERS, listImplementedSources } from '../sources/registry'
import { type SocialSource } from '../sources/types'
import { getUserPlan } from './usage'
import { type Plan, planMeets } from '../billing/tiers'
import { listKeyHolders, getByokKey } from './byok'
import { listMonitors, listAllMonitors, type Monitor } from './monitors'
import { getAllTrackedQueries } from './user-data'
import { assignQueriesToHolders, type PollHolder } from '../lib/poll-assignment'
import { type IngestionMode, resolveIngestionMode } from '../sources/ingestion-mode'
import { getIngestionSettings } from './ingestion-mode'
import { APIFY_PROVIDER } from '../providers'

export interface MonitorTask {
  source: SocialSource
  userId: string
  /** Decrypted BYOK key for the source's provider — job-only, never returned to clients. */
  apiKey: string
  query: string
  /** Ingestion mode that produced this task — determines which adapter the poller uses. */
  mode: IngestionMode
}

/**
 * Builds the per-source set of (user, decrypted key, deduped query) tasks to
 * poll this cycle. For each IMPLEMENTED source adapter with a byokProvider:
 *  - enumerate eligible holders for that provider (status==='active' && backgroundPolling)
 *  - determine each holder's monitored queries FOR THIS SOURCE:
 *      • their Monitor records whose `sources` include this source → those queries
 *      • if the holder has NO monitor records at all, FALL BACK to getAllTrackedQueries(userId)
 *        but only for the 'twitter' source (preserves the pre-M9 behavior; other sources
 *        require an explicit monitor opt-in)
 *  - entitlement filter: include the holder only if planMeets(userPlan, adapter.minPlan)
 *  - dedup queries across holders per source via assignQueriesToHolders
 *  - decrypt the holder's key (getByokKey) and skip if not active
 * Returns a flat MonitorTask[] across all sources.
 * Cadence (shouldPollNow) is NOT applied here — the poller applies it per task.
 */
export async function getMonitorAssignments(): Promise<MonitorTask[]> {
  const tasks: MonitorTask[] = []

  // Cache getUserPlan, listMonitors, and getIngestionSettings per userId to avoid redundant reads
  const planCache = new Map<string, Plan>()
  const monitorsCache = new Map<string, Monitor[]>()
  const settingsCache = new Map<string, Awaited<ReturnType<typeof getIngestionSettings>>>()

  async function getCachedPlan(userId: string): Promise<Plan> {
    if (!planCache.has(userId)) {
      const { plan } = await getUserPlan(userId)
      planCache.set(userId, plan)
    }
    return planCache.get(userId)!
  }

  async function getCachedMonitors(userId: string): Promise<Monitor[]> {
    if (!monitorsCache.has(userId)) {
      const monitors = await listMonitors(userId)
      monitorsCache.set(userId, monitors)
    }
    return monitorsCache.get(userId)!
  }

  async function getCachedSettings(userId: string): Promise<Awaited<ReturnType<typeof getIngestionSettings>>> {
    if (!settingsCache.has(userId)) {
      const settings = await getIngestionSettings(userId)
      settingsCache.set(userId, settings)
    }
    return settingsCache.get(userId)!
  }

  // Lazily fetched once and reused across all keyless adapters in the loop.
  let allMonitorsCache: Monitor[] | null = null

  async function getAllMonitorsCached(): Promise<Monitor[]> {
    if (allMonitorsCache === null) {
      allMonitorsCache = await listAllMonitors()
    }
    return allMonitorsCache
  }

  for (const [sourceId, adapter] of Object.entries(SOURCE_ADAPTERS) as Array<[SocialSource, (typeof SOURCE_ADAPTERS)[SocialSource]]>) {
    if (!adapter || !adapter.implemented) continue

    if (adapter.byokProvider !== null) {
      // ── BYOK path (e.g. twitter) ──────────────────────────────────────────
      // Only include a holder for this source in the per-source path if their
      // resolved mode for this source is 'per-source'. If it's 'apify', the
      // Apify path (below) will handle it, guaranteeing mutual exclusivity.
      const provider = adapter.byokProvider
      const holders = await listKeyHolders(provider)
      const eligible = holders.filter((h) => h.status === 'active' && h.backgroundPolling)

      const pollHolders: PollHolder[] = []

      for (const holder of eligible) {
        const { userId } = holder

        // Mode exclusivity: skip if this user uses apify mode for this source
        const userSettings = await getCachedSettings(userId)
        if (resolveIngestionMode(userSettings, sourceId) !== 'per-source') continue

        // Entitlement check
        const userPlan = await getCachedPlan(userId)
        if (!planMeets(userPlan, adapter.minPlan)) continue

        // Determine queries for this source
        const monitors = await getCachedMonitors(userId)
        let queries: string[]

        if (monitors.length === 0) {
          // Fallback: use getAllTrackedQueries, but only for twitter
          if (sourceId === 'twitter') {
            queries = await getAllTrackedQueries(userId)
          } else {
            queries = []
          }
        } else {
          // Use monitor records that include this source (skip paused monitors)
          queries = monitors
            .filter((m) => m.enabled !== false && m.sources.includes(sourceId))
            .map((m) => m.query)
        }

        if (queries.length > 0) {
          pollHolders.push({ userId, queries })
        }
      }

      // Dedup queries across holders for this source
      const assigned = assignQueriesToHolders(pollHolders)

      // Decrypt keys and build MonitorTasks
      for (const [userId, queries] of assigned) {
        const keyData = await getByokKey(userId, provider)
        if (!keyData || keyData.status !== 'active') continue

        for (const query of queries) {
          tasks.push({
            source: sourceId,
            userId,
            apiKey: keyData.apiKey,
            query,
            mode: 'per-source',
          })
        }
      }
    } else {
      // ── Keyless path (e.g. farcaster) ─────────────────────────────────────
      // Eligibility = the user has a Monitor record that includes this source.
      // No per-user BYOK key; the adapter reads process.env.NEYNAR_API_KEY.
      // Only include a user if their resolved mode for this source is 'per-source'
      // (apify-mode farcaster users are handled by the Apify path below).
      const allMonitors = await getAllMonitorsCached()

      // Collect monitors for this source, grouped by userId.
      const byUser = new Map<string, string[]>()
      for (const monitor of allMonitors) {
        if (monitor.enabled === false) continue
        if (!monitor.sources.includes(sourceId)) continue

        // Mode exclusivity: skip if this user uses apify mode for this source
        const userSettings = await getCachedSettings(monitor.userId)
        if (resolveIngestionMode(userSettings, sourceId) !== 'per-source') continue

        const existing = byUser.get(monitor.userId) ?? []
        existing.push(monitor.query)
        byUser.set(monitor.userId, existing)
      }

      const pollHolders: PollHolder[] = []

      for (const [userId, queries] of byUser) {
        // Entitlement check
        const userPlan = await getCachedPlan(userId)
        if (!planMeets(userPlan, adapter.minPlan)) continue

        pollHolders.push({ userId, queries })
      }

      // Dedup queries across users for this source
      const assigned = assignQueriesToHolders(pollHolders)

      for (const [userId, queries] of assigned) {
        for (const query of queries) {
          tasks.push({
            source: sourceId,
            userId,
            apiKey: '', // no per-user key; adapter reads process.env.NEYNAR_API_KEY
            query,
            mode: 'per-source',
          })
        }
      }
    }
  }

  // ── Apify path ─────────────────────────────────────────────────────────────
  // For each user with an active Apify BYOK key and backgroundPolling=true:
  // for each implemented source whose resolved mode is 'apify', collect their
  // monitor queries and emit tasks with mode='apify'.
  // Mutual exclusivity with the direct paths above is guaranteed because the
  // direct paths skip any (user, source) where resolveIngestionMode !== 'per-source'.
  const apifyHolders = await listKeyHolders(APIFY_PROVIDER)
  const apifyEligible = apifyHolders.filter((h) => h.status === 'active' && h.backgroundPolling)

  const implementedSources = listImplementedSources()

  // Collect (source → PollHolder[]) for apify path, then dedup per source.
  const apifyPollHoldersBySource = new Map<SocialSource, PollHolder[]>()

  for (const holder of apifyEligible) {
    const { userId } = holder

    const userSettings = await getCachedSettings(userId)
    const userPlan = await getCachedPlan(userId)
    const monitors = await getCachedMonitors(userId)

    for (const sourceId of implementedSources) {
      // Only process this source in the apify path if the user's mode resolves to 'apify'
      if (resolveIngestionMode(userSettings, sourceId) !== 'apify') continue

      // Entitlement check uses the direct adapter's minPlan (unchanged by mode)
      const directAdapter = SOURCE_ADAPTERS[sourceId]
      if (!directAdapter || !planMeets(userPlan, directAdapter.minPlan)) continue

      // Determine queries: monitor records for this source, or twitter fallback
      let queries: string[]
      if (monitors.length === 0) {
        // Fallback: only for twitter (mirrors the per-source path)
        if (sourceId === 'twitter') {
          queries = await getAllTrackedQueries(userId)
        } else {
          queries = []
        }
      } else {
        queries = monitors
          .filter((m) => m.enabled !== false && m.sources.includes(sourceId))
          .map((m) => m.query)
      }

      if (queries.length === 0) continue

      const existing = apifyPollHoldersBySource.get(sourceId) ?? []
      existing.push({ userId, queries })
      apifyPollHoldersBySource.set(sourceId, existing)
    }
  }

  // Dedup per source and emit tasks
  for (const [sourceId, pollHolders] of apifyPollHoldersBySource) {
    const assigned = assignQueriesToHolders(pollHolders)

    for (const [userId, queries] of assigned) {
      // Decrypt the user's Apify token
      const keyData = await getByokKey(userId, APIFY_PROVIDER)
      if (!keyData || keyData.status !== 'active') continue

      for (const query of queries) {
        tasks.push({
          source: sourceId,
          userId,
          apiKey: keyData.apiKey,
          query,
          mode: 'apify',
        })
      }
    }
  }

  return tasks
}
