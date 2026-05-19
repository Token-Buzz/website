export interface BotHeuristicInput {
  statusesCount: number
  followers: number
  following: number
  accountAgeDays: number
  profilePictureUrl?: string
  description?: string
}

export interface BotHeuristicResult {
  /** Heuristic bot likelihood score, clamped to [0, 1]. */
  botScore: number
}

/**
 * Computes a heuristic bot-likelihood score using four weighted signals.
 * Weights: postsPerDay 0.35, accountAge 0.25, defaultPfp+emptyBio 0.25, followerRatio 0.15.
 * Each signal contributes its weight × [0, 1]; total is clamped to [0, 1].
 */
export function computeBotScore(input: BotHeuristicInput): BotHeuristicResult {
  const { statusesCount, followers, following, accountAgeDays, profilePictureUrl, description } = input

  // Signal 1 — Posts per day (weight 0.35)
  // postsPerDay ≥ 50 → linear ramp, capped at 1.0 at 200/day
  let postsPerDaySignal = 0
  if (accountAgeDays > 0 && statusesCount > 0) {
    const postsPerDay = statusesCount / accountAgeDays
    if (postsPerDay >= 50) {
      postsPerDaySignal = Math.min((postsPerDay - 50) / (200 - 50), 1)
    }
  }

  // Signal 2 — Account age (weight 0.25)
  // < 30 days → full signal
  const accountAgeSignal = accountAgeDays > 0 && accountAgeDays < 30 ? 1 : 0

  // Signal 3 — Default PFP + empty bio (weight 0.25)
  // Default PFP: URL contains 'default_profile_images' or is missing → +0.5
  // Empty bio: description length < 10 → +0.5
  const defaultPfp =
    !profilePictureUrl || profilePictureUrl.includes('default_profile_images') ? 0.5 : 0
  const emptyBio = !description || description.trim().length < 10 ? 0.5 : 0
  const pfpBioSignal = defaultPfp + emptyBio // max = 1.0

  // Signal 4 — Follower/following ratio (weight 0.15)
  // followers / following < 0.1 → full signal; guard against division by zero
  let ratioSignal = 0
  if (following > 0) {
    ratioSignal = followers / following < 0.1 ? 1 : 0
  } else if (followers === 0) {
    // No followers, no following → suspicious
    ratioSignal = 1
  }

  const raw =
    postsPerDaySignal * 0.35 +
    accountAgeSignal * 0.25 +
    pfpBioSignal * 0.25 +
    ratioSignal * 0.15

  return { botScore: Math.min(1, Math.max(0, raw)) }
}
