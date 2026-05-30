// Apify REST API client
// Used by the Apify all-in-one BYOK ingestion mode (M9 Phase 8).
// Auth via Authorization: Bearer <token> header.

const APIFY_BASE_URL = 'https://api.apify.com/v2'

// Backoff delays between retry attempts (ms). Exported as a mutable array so
// tests can set it to [0, 0] to skip actual waits without fake timers.
export let RETRY_DELAYS_MS = [500, 1500]

// ── Sleep seam ────────────────────────────────────────────────────────────────
// All waits in this module go through `sleep()` which delegates to
// `__sleepImpl`. Tests override `__sleepImpl` (or swap it via `__setSleep`)
// to a vi.fn() that resolves immediately so no real time is spent waiting.
export let __sleepImpl: (ms: number) => Promise<void> = (ms) =>
  new Promise<void>((r) => setTimeout(r, ms))

async function sleep(ms: number): Promise<void> {
  return __sleepImpl(ms)
}

/** Replace the sleep implementation (for tests). Returns the previous impl. */
export function __setSleep(fn: (ms: number) => Promise<void>): (ms: number) => Promise<void> {
  const prev = __sleepImpl
  __sleepImpl = fn
  return prev
}

export class ApifyApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message)
    this.name = 'ApifyApiError'
  }
}

/**
 * Validate an Apify token via GET /v2/users/me.
 * Returns ok=false on 401/403 (invalid token).
 * Re-throws on 5xx/network errors so callers can surface a transient failure.
 * last4 = token.slice(-4).
 */
export async function validateApifyToken(token: string): Promise<{ ok: boolean; last4: string }> {
  const last4 = token.slice(-4)

  let response: Response
  try {
    response = await fetch(`${APIFY_BASE_URL}/users/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  } catch (networkErr) {
    throw networkErr
  }

  if (response.ok) {
    return { ok: true, last4 }
  }

  if (response.status === 401 || response.status === 403) {
    return { ok: false, last4 }
  }

  // 5xx and other errors — re-throw so callers can surface transient failures
  throw new ApifyApiError(
    `Apify API error: ${response.status} ${response.statusText}`,
    response.status,
  )
}

/**
 * Run an actor synchronously and return its dataset items.
 * POST https://api.apify.com/v2/acts/<actorId>/run-sync-get-dataset-items
 *   with header Authorization: Bearer <token>, Content-Type: application/json,
 *   query params: timeout=<timeoutSecs> (Apify run timeout), and the actor input as the JSON body.
 *
 * - actorId may contain a '/' (e.g. 'apidojo/tweet-scraper'); URL-encoded for the path segment.
 * - On HTTP 2xx: parse the JSON array of dataset items and return it (unknown[]).
 * - On 408 or a request that exceeds the timeout cap: throw ApifyApiError(..., 408).
 * - On 401/403: throw ApifyApiError(..., status) immediately (no retry).
 * - On other non-2xx: throw ApifyApiError(..., status).
 * - Bounded retry on 5xx/network only (RETRY_DELAYS_MS + sleep-seam pattern).
 */
export async function runActorSync(
  token: string,
  actorId: string,
  input: Record<string, unknown>,
  opts?: { timeoutSecs?: number },
): Promise<unknown[]> {
  // URL-encode the actorId so '/' and '~' are safe in the path segment
  const encodedActorId = encodeURIComponent(actorId)
  const url = new URL(`${APIFY_BASE_URL}/acts/${encodedActorId}/run-sync-get-dataset-items`)

  if (opts?.timeoutSecs !== undefined) {
    url.searchParams.set('timeout', String(opts.timeoutSecs))
  }

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    let response: Response

    try {
      response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      })
    } catch (networkErr) {
      // Network-level failure (DNS, TCP, etc.) — retry if budget remains
      if (attempt < RETRY_DELAYS_MS.length) {
        await sleep(RETRY_DELAYS_MS[attempt])
        continue
      }
      throw networkErr
    }

    if (response.ok) {
      const items = (await response.json()) as unknown[]
      return items
    }

    // 408 Timeout — surface as-is so adapter can treat as partial/timeout
    if (response.status === 408) {
      throw new ApifyApiError(
        `Apify actor run timed out: ${response.status} ${response.statusText}`,
        408,
      )
    }

    // 401/403 — invalid token, throw immediately (no retry)
    if (response.status === 401 || response.status === 403) {
      throw new ApifyApiError(
        `Apify API error: ${response.status} ${response.statusText}`,
        response.status,
      )
    }

    // 5xx — transient; retry if budget remains
    if (response.status >= 500) {
      if (attempt < RETRY_DELAYS_MS.length) {
        await sleep(RETRY_DELAYS_MS[attempt])
        continue
      }
      throw new ApifyApiError(
        `Apify API error: ${response.status} ${response.statusText}`,
        response.status,
      )
    }

    // Other non-2xx (4xx, 3xx, etc.) — throw immediately
    throw new ApifyApiError(
      `Apify API error: ${response.status} ${response.statusText}`,
      response.status,
    )
  }

  // Should not be reached — TypeScript flow exhaustion guard
  throw new ApifyApiError('Apify runActorSync: retry budget exhausted', 500)
}
