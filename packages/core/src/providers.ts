// BYOK provider registry — the single source of truth for which external API
// providers a user can connect a key for. twitterapi.io and Reddit are enabled;
// this registry is the extension point for additional providers (add an entry
// here, add a client module under src/lib, and wire validation/search dispatch
// — see docs/milestones/M10-byok.md).

export type ProviderId = 'twitter' | 'reddit'

export interface ByokProvider {
  /** Canonical id persisted on every BYOK record (the `provider` field / `BYOK#<id>` sort key). */
  id: ProviderId
  /** Human label shown in the Account UI and key-invalidation emails (e.g. "twitterapi.io"). */
  name: string
  /** Whether users can currently connect a key for this provider. */
  enabled: boolean
}

export const PROVIDERS: Record<ProviderId, ByokProvider> = {
  twitter: { id: 'twitter', name: 'twitterapi.io', enabled: true },
  reddit: { id: 'reddit', name: 'Reddit', enabled: true },
}

/** Canonical id for the twitterapi.io BYOK provider. */
export const TWITTER_PROVIDER: ProviderId = 'twitter'

/** Canonical id for the Reddit BYOK provider. */
export const REDDIT_PROVIDER: ProviderId = 'reddit'

/** Look up a provider's metadata by id; returns undefined for unknown ids. */
export function getProvider(id: string): ByokProvider | undefined {
  return (PROVIDERS as Record<string, ByokProvider>)[id]
}

/** Type guard: true when `id` is a known, currently-enabled provider. */
export function isEnabledProvider(id: string): id is ProviderId {
  return getProvider(id)?.enabled === true
}
