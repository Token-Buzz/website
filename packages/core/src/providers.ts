// BYOK provider registry — the single source of truth for which external API
// providers a user can connect a key for. twitterapi.io, Reddit, Telegram,
// Discord, and Apify are social/ingest providers; CryptoPanic and CryptoCompare
// are news-aggregate providers (category 'news'). This registry is the
// extension point for additional providers (add an entry here, add a client
// module under src/lib, and wire validation/search dispatch
// — see docs/milestones/M10-byok.md).
//
// Each provider has a `category` field:
//   'social'  — per-source tab in the Account UI (Twitter, Reddit, Telegram, Discord)
//   'apify'   — Apify tab in the Account UI
//   'news'    — News Aggregates tab in the Account UI (CryptoPanic, CryptoCompare)

export type ProviderId = 'twitter' | 'reddit' | 'telegram' | 'discord' | 'apify' | 'cryptopanic' | 'cryptocompare'

/** Which API-Keys group the provider belongs to in the Account UI. */
export type ProviderCategory = 'social' | 'apify' | 'news'

export interface ByokProvider {
  /** Canonical id persisted on every BYOK record (the `provider` field / `BYOK#<id>` sort key). */
  id: ProviderId
  /** Human label shown in the Account UI and key-invalidation emails (e.g. "twitterapi.io"). */
  name: string
  /** Whether users can currently connect a key for this provider. */
  enabled: boolean
  /** Which API-Keys group it belongs to — social = per-source tab, apify = Apify tab, news = News Aggregates tab. */
  category: ProviderCategory
}

export const PROVIDERS: Record<ProviderId, ByokProvider> = {
  twitter: { id: 'twitter', name: 'twitterapi.io', enabled: true, category: 'social' },
  reddit: { id: 'reddit', name: 'Reddit', enabled: true, category: 'social' },
  telegram: { id: 'telegram', name: 'Telegram', enabled: true, category: 'social' },
  discord: { id: 'discord', name: 'Discord', enabled: true, category: 'social' },
  apify: { id: 'apify', name: 'Apify', enabled: true, category: 'apify' },
  cryptopanic: { id: 'cryptopanic', name: 'CryptoPanic', enabled: true, category: 'news' },
  cryptocompare: { id: 'cryptocompare', name: 'CryptoCompare', enabled: true, category: 'news' },
}

/** Canonical id for the twitterapi.io BYOK provider. */
export const TWITTER_PROVIDER: ProviderId = 'twitter'

/** Canonical id for the Reddit BYOK provider. */
export const REDDIT_PROVIDER: ProviderId = 'reddit'

/** Canonical id for the Telegram MTProto BYOK provider. */
export const TELEGRAM_PROVIDER: ProviderId = 'telegram'

/** Canonical id for the Discord bot-token BYOK provider. */
export const DISCORD_PROVIDER: ProviderId = 'discord'

/** Canonical id for the Apify all-in-one BYOK provider. */
export const APIFY_PROVIDER: ProviderId = 'apify'

/** Canonical id for the CryptoPanic news-aggregate BYOK provider. */
export const CRYPTOPANIC_PROVIDER: ProviderId = 'cryptopanic'

/** Canonical id for the CryptoCompare news-aggregate BYOK provider. */
export const CRYPTOCOMPARE_PROVIDER: ProviderId = 'cryptocompare'

/** Look up a provider's metadata by id; returns undefined for unknown ids. */
export function getProvider(id: string): ByokProvider | undefined {
  return (PROVIDERS as Record<string, ByokProvider>)[id]
}

/** Type guard: true when `id` is a known, currently-enabled provider. */
export function isEnabledProvider(id: string): id is ProviderId {
  return getProvider(id)?.enabled === true
}
