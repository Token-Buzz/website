import type { SocialSource } from "@monorepo-template/core/sources/types";
import type { Plan } from "@monorepo-template/core/billing/tiers";

export interface SourceMeta {
  id: SocialSource;
  displayName: string;
  /** Minimum plan tier that can use this source. */
  minPlan: Plan;
  /** Whether the ingestor is live yet (only twitter in Phase 1). */
  implemented: boolean;
}

// Mirrors the M9 tier plan: Free = X + Farcaster, Pro = + Reddit, Alpha = + Telegram + Discord.
export const SOURCE_META: SourceMeta[] = [
  { id: "twitter",   displayName: "X",         minPlan: "free",  implemented: true  },
  { id: "farcaster", displayName: "Farcaster", minPlan: "free",  implemented: false },
  { id: "reddit",    displayName: "Reddit",    minPlan: "pro",   implemented: false },
  { id: "telegram",  displayName: "Telegram",  minPlan: "alpha", implemented: false },
  { id: "discord",   displayName: "Discord",   minPlan: "alpha", implemented: false },
];
