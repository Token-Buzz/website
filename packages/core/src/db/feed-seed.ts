import { upsertTokenProfile } from './token-profile'

/**
 * Curated map of well-known token symbols → their official press/website links.
 * Keys are UPPERCASE symbols. Only includes entries with high confidence —
 * pressFeedUrl is omitted when we know a press page exists but are unsure of
 * a stable RSS/Atom feed URL.
 */
export const CURATED_PRESS_SEED: Record<
  string,
  { websiteUrl?: string; pressUrl?: string; pressFeedUrl?: string }
> = {
  BTC: {
    websiteUrl: 'https://bitcoin.org',
    pressUrl: 'https://bitcoin.org/en/blog',
    pressFeedUrl: 'https://bitcoin.org/en/rss/blog.xml',
  },
  ETH: {
    websiteUrl: 'https://ethereum.org',
    pressUrl: 'https://blog.ethereum.org',
    pressFeedUrl: 'https://blog.ethereum.org/feed.xml',
  },
  SOL: {
    websiteUrl: 'https://solana.com',
    pressUrl: 'https://solana.com/news',
  },
  DOT: {
    websiteUrl: 'https://polkadot.network',
    pressUrl: 'https://polkadot.network/blog',
    pressFeedUrl: 'https://polkadot.network/blog/rss.xml',
  },
  ADA: {
    websiteUrl: 'https://cardano.org',
    pressUrl: 'https://cardano.org/news',
  },
  AVAX: {
    websiteUrl: 'https://www.avax.network',
    pressUrl: 'https://www.avax.network/blog',
  },
  LINK: {
    websiteUrl: 'https://chain.link',
    pressUrl: 'https://chain.link/press',
  },
  UNI: {
    websiteUrl: 'https://uniswap.org',
    pressUrl: 'https://blog.uniswap.org',
    pressFeedUrl: 'https://blog.uniswap.org/rss.xml',
  },
  AAVE: {
    websiteUrl: 'https://aave.com',
    pressUrl: 'https://governance.aave.com',
  },
  MKR: {
    websiteUrl: 'https://makerdao.com',
    pressUrl: 'https://blog.makerdao.com',
    pressFeedUrl: 'https://blog.makerdao.com/feed',
  },
  OP: {
    websiteUrl: 'https://www.optimism.io',
    pressUrl: 'https://optimism.mirror.xyz',
  },
  ARB: {
    websiteUrl: 'https://arbitrum.io',
    pressUrl: 'https://arbitrumfoundation.medium.com',
  },
}

/**
 * Idempotent seeder — writes a PROFILE row on the Tokens table for every entry
 * in CURATED_PRESS_SEED. Safe to run repeatedly; PutItem overwrites with the
 * same payload each time.
 */
export async function seedCuratedTokenProfiles(): Promise<{
  created: number
  updated: number
  skipped: number
}> {
  let created = 0
  let updated = 0

  for (const [symbol, links] of Object.entries(CURATED_PRESS_SEED)) {
    await upsertTokenProfile({
      symbol,
      source: 'curated',
      ...links,
    })
    // All upserts count as created on first run; subsequent runs overwrite
    // idempotently. We track both counters as "updated" on re-runs since we
    // cannot distinguish first-write from overwrite without a conditional check.
    updated++
  }

  // No skipped entries — we always upsert (no conditional skip logic).
  const skipped = 0
  return { created, updated, skipped }
}
