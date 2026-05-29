import { type SocialSource, type SourceAdapter, ALL_SOURCES } from './types'
import { twitterAdapter } from './twitter-adapter'
import { farcasterAdapter } from './farcaster-adapter'
import { redditAdapter } from './reddit-adapter'
import { telegramAdapter } from './telegram-adapter'
import { discordAdapter } from './discord-adapter'
import { type Plan, planMeets } from '../billing/tiers'

// Phase 1: twitter. Phase 2: farcaster. Phase 3: reddit. Phase 4: telegram. Phase 5: discord.
export const SOURCE_ADAPTERS: Partial<Record<SocialSource, SourceAdapter>> = {
  twitter: twitterAdapter,
  farcaster: farcasterAdapter,
  reddit: redditAdapter,
  telegram: telegramAdapter,
  discord: discordAdapter,
}

export function getAdapter(id: string): SourceAdapter | undefined {
  return SOURCE_ADAPTERS[id as SocialSource]
}

export function listImplementedSources(): SocialSource[] {
  return ALL_SOURCES.filter((s) => SOURCE_ADAPTERS[s]?.implemented)
}

/** Sources the given plan is entitled to use (implemented + plan meets minPlan). */
export function allowedSources(plan: Plan): SocialSource[] {
  return listImplementedSources().filter((s) => planMeets(plan, SOURCE_ADAPTERS[s]!.minPlan))
}
