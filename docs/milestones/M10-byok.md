# M10 — BYOK (Bring Your Own Key)

Moves twitterapi.io ingestion from a single project-owned API key to per-user keys. Each user supplies their own twitterapi.io API key, stored AWS-KMS-encrypted in the `UserData` table, and decrypted at request time. Keys are used for both interactive queries and opt-in background polling. Multi-provider readiness: the architecture is provider-agnostic, designed to accommodate future social sources (X API, M9 platforms).

## Locked decisions

- **Fully per-user.** The project-wide `TWITTER_API_KEY` secret was removed entirely (Phase 5). No shared ingestion quota.
- **AWS KMS direct encryption.** Keys are <4KB; encrypted via customer-managed KMS keys, decrypted at request time (never cached in plaintext).
- **BYOK users bypass quotas.** They pay twitterapi.io directly; ingestion by key-holders is not metered against the project quota (M5).
- **Communal results.** When a key-holder polls tracked tokens, results land in shared `Tweets` and `Aggregates` tables visible to all users.
- **Background polling opt-in.** Per-user toggle on the Account → API Keys page, default off. Only active + opted-in key-holders are assigned polling jobs.
- **Provider-agnostic DB layer.** All key functions take `provider: string` (currently `'twitter'`); extensible to future providers without schema changes.

## Architecture & Data Model

### UserData BYOK record

```ts
// Key builder in packages/core/src/db/keys.ts
byokKey(userId, provider) => {
  pk: `USER#${userId}`,
  sk: `BYOK#${provider}`
}

// Row shape (packages/core/src/db/byok.ts)
{
  userId: string,
  provider: string,
  ciphertext: string,           // base64 KMS-encrypted key
  last4: string,                // last 4 chars of plaintext key (unencrypted, for display)
  validatedAt: string,          // ISO-8601 timestamp of last successful validation
  status: 'active' | 'invalid', // 'invalid' = 401/403 response detected
  backgroundPolling?: boolean,  // opt-in flag for background jobs
  gsi1pk: `BYOK#${provider}`,   // GSI partition key
  gsi1sk: `USER#${userId}`      // GSI sort key
}
```

### ByokHolders GSI

Indexes keys by provider to enumerate all key-holders for a given provider (used by background jobs to fan out polling).

- **GSI1**: `gsi1pk = BYOK#<provider>`, `gsi1sk = USER#<userId>`.
- Allows queries like `QueryIndex gsi1pk='BYOK#twitter' WHERE status='active' AND backgroundPolling=true`.

### KMS Key

- Provisioned in `infra/byok.ts` as a customer-managed symmetric key (`keyUsage: ENCRYPT_DECRYPT`) via the Pulumi AWS provider (SST v4 has no first-class KMS component).
- Alias: `alias/website-<stage>-byok`.
- Auto-rotation enabled; 30-day deletion window.
- `kms:Encrypt` / `kms:Decrypt` access is granted by linking the key to the application (and, as of Phase 6, the background jobs) through SST resource bindings.

### Provider Registry

New `packages/core/src/providers.ts` is the single source of truth for enabled providers:

```ts
export type ProviderId = 'twitter' // extend the union when enabling a new provider

export interface ByokProvider {
  id: ProviderId
  name: string // display name, e.g. "twitterapi.io"
  enabled: boolean
}

export const PROVIDERS: Record<ProviderId, ByokProvider> = {
  twitter: { id: 'twitter', name: 'twitterapi.io', enabled: true },
}

// Canonical id for the only enabled provider — a plain string, not an object.
export const TWITTER_PROVIDER: ProviderId = 'twitter'

export function getProvider(id: string): ByokProvider | undefined { /* ... */ }
export function isEnabledProvider(id: string): id is ProviderId { /* ... */ }
```

**Telegram is now a second BYOK provider** (provider id `telegram`, exported as `TELEGRAM_PROVIDER`). Unlike the single-string twitterapi.io key, its credential is a JSON-encoded three-field object `{ apiId, apiHash, session }` (a GramJS `StringSession`), stored KMS-encrypted in `UserData` and resolved per-user by the source adapter's `byokProvider: 'telegram'` (M9 Phase 4). Auth failures (401/403) invalidate the key via the same path as twitterapi.io.

## Request Paths

### Interactive Query

User submits a search on the dashboard. The `/api/query` route:

1. Retrieves the caller's BYOK key via `getByokKey(userId, TWITTER_PROVIDER)`.
2. Decrypts the key (AWS KMS `Decrypt` call).
3. Passes it to `searchTweets()` in the twitterapi.io client.
4. **Key invalidation on auth error:** If the response is 401 or 403, calls `markByokKeyInvalid(userId, provider)` (sets `status: 'invalid'`, preserves GSI keys) and returns HTTP 403 with error code `{ error: "byok_required", reason: "invalid" }`.
5. On success, results are persisted to the shared `Tweets` / `Aggregates` tables.

### Background Polling (opt-in)

Jobs in `packages/jobs/src` (poller.ts, follower-snapshot.ts, engagement-snapshot.ts) call `getPollAssignments(provider)`:

1. Lists all keys where `status='active'` AND `backgroundPolling=true`.
2. Enumerates tracked tokens for each key-holder (deduplicated across holders).
3. For each assigned holder, decrypts their key and submits the query.
4. Results land in shared tables.
5. **Key errors:** `key-errors.ts` handles 401/403 responses: calls `markByokKeyInvalid()` and emails the user (via Clerk + Resend) with a link to the Account → API Keys page.

### Key Validation & Setup

Account → API Keys page (`packages/application/app/(authed)/account/[[...rest]]/ApiKeysSection.tsx`):

1. **Add key:** User pastes their twitterapi.io API key.
2. **Validate:** POST `/api/account/keys` with `{ provider, key }`. The route:
   - Calls `validateKey(key)` in the twitterapi.io client (probes the stable handle "elonmusk" via `/twitter/user/info`).
   - On success, calls `putByokKey({ userId, provider, apiKey })`, which encrypts (KMS) and persists the row.
   - Returns `{ provider, providerName, configured: true, last4, validatedAt, status, backgroundPolling }`.
3. **Display:** Shows a configured card with masked `last4` (e.g., "Key ending in `xyz9`") and the provider display name.
4. **Toggle polling:** PATCH `/api/account/keys` to set `backgroundPolling` flag.
5. **Remove key:** DELETE `/api/account/keys/[provider]` — validates the provider via `isEnabledProvider()` and calls `deleteByokKey()`.

### Key Invalidation

When a query or background job receives 401/403:

1. Calls `markByokKeyInvalid(userId, provider)` — atomically sets `status: 'invalid'` while preserving GSI keys (so the key still appears in `ByokHolders` queries for cleanup/notification).
2. **For background jobs:** `key-errors.ts` emails the user with the reason and a link to re-validate.
3. **Interactive queries:** The caller sees the 403 error and can re-add their key via the Account UI.

## DB Layer (packages/core/src/db/byok.ts)

All functions are provider-agnostic:

- `putByokKey({ userId, provider, apiKey })` — encrypts (KMS) the plaintext key and writes/updates the row (including the GSI keys).
- `getByokKey(userId, provider)` — read with decryption via KMS.
- `deleteByokKey(userId, provider)` — remove the key.
- `hasByokKey(userId, provider)` — existence check (no decrypt).
- `getByokKeyStatus(userId, provider)` — projected read of the non-secret metadata only (no decrypt, no KMS call).
- `markByokKeyInvalid(userId, provider)` — conditionally set status='invalid' (preserves GSI keys).
- `setByokBackgroundPolling(userId, provider, enabled)` — update the opt-in toggle.
- `listKeyHolders(provider)` — query ByokHolders GSI; returns `{ userId, status, backgroundPolling }[]` for the provider (used by jobs).

## Crypto (packages/core/src/lib/crypto.ts)

```ts
export async function encryptSecret(plaintext: string): Promise<string> {
  // AWS KMS Encrypt → base64
}

export async function decryptSecret(ciphertext: string): Promise<string> {
  // Base64 → AWS KMS Decrypt
}
```

## twitterapi.io Client (packages/core/src/lib/twitter.ts)

Provider-specific client — the only hardcoded reference to twitterapi.io in the codebase. Exports:

```ts
export async function searchTweets(apiKey: string, query: string, opts?: { sinceId?: string; maxPages?: number; queryType?: string }): Promise<RawTweet[]> { /* ... */ }
export async function lookupUser(apiKey: string, username: string): Promise<TwitterAuthor | null> { /* ... */ }
export async function validateKey(apiKey: string): Promise<{ ok: boolean; last4: string }> {
  // Probes stable handle "elonmusk" via /twitter/user/info; ok=true on 200, false on 401/403
}

export class TwitterApiError extends Error {
  constructor(message: string, public readonly status: number) { /* ... */ }
}
```

Base URL: `https://api.twitterapi.io`. Auth header: `X-API-Key: <apiKey>`. Retries on 5xx / network errors with backoff; 401/403 fail immediately (no retry).

## Phases

### Phase 1 — KMS crypto + UserData BYOK schema

- Provision KMS key in `infra/byok.ts`.
- Add `byokKey` builder and ByokHolders GSI to `packages/core/src/db/keys.ts`.
- Implement `encryptSecret` / `decryptSecret` in `packages/core/src/lib/crypto.ts`.
- Implement BYOK record functions in `packages/core/src/db/byok.ts`: `putByokKey`, `getByokKey`, `deleteByokKey`, `hasByokKey`, `getByokKeyStatus`, `markByokKeyInvalid`, `setByokBackgroundPolling`, `listKeyHolders`.

### Phase 2 — twitterapi.io client

- Create `packages/core/src/lib/twitter.ts` with `searchTweets()`, `lookupUser()`, `validateKey()`.
- Handle 401/403 as auth errors (no retry); 5xx / network errors with backoff.

### Phase 3 — Account → API Keys UI

- Add API Keys tab to the Account page (`packages/application/app/(authed)/account/[[...rest]]/ApiKeysSection.tsx`).
- Key entry form, validate on submit, display masked last4 and provider name.
- Background-polling toggle (persisted via PATCH).
- Remove key button (DELETE).

### Phase 4 — Interactive query path

- Update `packages/application/app/api/query/route.ts` to use the caller's BYOK key.
- Decrypt via `getByokKey()`.
- On 401/403, call `markByokKeyInvalid()` and return 403 with `{ error: "byok_required", reason: "invalid" }`.

### Phase 5 — Remove project key

- Delete the `TWITTER_API_KEY` secret from `infra/secrets.ts`.
- Remove references from the legacy ingestion pipeline (if any).

### Phase 6 — Background jobs source keys from users

- Update background jobs (`packages/jobs/src/poller.ts`, `follower-snapshot.ts`, `engagement-snapshot.ts`) to call `getPollAssignments(provider)` and dispatch queries per key-holder.
- Implement `key-errors.ts` to handle auth errors and email users.

### Phase 7 — Multi-provider readiness + docs

- Introduce `packages/core/src/providers.ts` registry: `ProviderId`, `PROVIDERS`, `TWITTER_PROVIDER`, `getProvider()`, `isEnabledProvider()`.
- Update DELETE `/api/account/keys/[provider]` to validate provider via `isEnabledProvider()`.
- Account UI fetches provider display name from API response (`providerName`) instead of hardcoding "twitterapi.io".
- Document M10 and the "Adding a new provider" extension path.

## Adding a New Provider

To extend BYOK to a new provider (e.g., X API, Reddit, or a platform from M9):

1. **Register the provider** (`packages/core/src/providers.ts`):
   - Add a new entry to `PROVIDERS` with `id`, `name`, and `enabled: true` (or false if rolling out gradually).
   - Extend the `ProviderId` union type.
   - Example: `{ id: 'reddit', name: 'Reddit', enabled: false }`.

2. **Implement the provider client** (`packages/core/src/lib/<provider>.ts`):
   - Export `validateKey(apiKey: string): Promise<boolean>` — probe a stable endpoint to verify the key is valid.
   - Export `searchQuery(query: string, apiKey: string): Promise<T[]>` — search/ingest matching posts/messages.
   - Export `lookupUser(handle: string, apiKey: string): Promise<User>` — resolve a user handle (used by follower-snapshot).
   - Export a custom error class extending the base pattern (e.g., `RedditError`).
   - Handle auth errors (invalid key) distinctly from transient errors (5xx / network).

3. **Wire the client into request paths**:
   - `packages/application/app/api/account/keys` (POST validation): Dispatch on provider to call the appropriate `validateKey()`.
   - `packages/application/app/api/query/route.ts` (interactive search): Dispatch on provider to call the appropriate search function.
   - `packages/jobs/src/poller.ts`, `follower-snapshot.ts`, `engagement-snapshot.ts` (background jobs): Dispatch on provider.

4. **DB layer and GSI already support it.** The `byok.ts` functions and ByokHolders GSI are provider-agnostic — no schema changes required.

5. **Account UI labels and delete validation are automatic.** The Account UI already fetches `providerName` from the API; the DELETE route already validates via `isEnabledProvider()`.

**Example future targets:**
- **X API:** New provider client `packages/core/src/lib/x-api.ts` with `validateKey()`, `searchTweets()`, `lookupUser()`.
- **M9 platforms (Reddit, Telegram, Discord, Farcaster):** Each gets its own client module. The integration layer dispatches to the appropriate client based on the provider the user selected on the Account UI.

## Gotchas

1. **Stale queries from keyless/opted-out users.** If a user tracks a query but never supplies a BYOK key (or disables background polling), that query is ingested only when the user interactively searches it. Results from other key-holders are visible, but the inactive user's tracked query doesn't drive background polling. This is accepted — the user can opt in at any time.

2. **follower-snapshot error handling.** The `lookupUser()` function is called inside `follower-snapshot.ts`; errors are caught and swallowed (no email notification). The `searchTweets` jobs are the authoritative key-invalidation path — if a key is invalid, the next search job will detect it and email the user.

3. **Never log / return / commit plaintext keys.** The plaintext key exists only in transient stack memory during the decrypt call. Never log it, never return it to the client, never commit it to source control (obviously). Always work with the encrypted form and decrypted-in-transit value.

4. **Crypto errors are rare but possible.** If KMS is unavailable or the key policy denies the IAM role, `decryptSecret()` throws. Callers should catch and surface a user-friendly error (e.g., "Unable to decrypt key; please try again or contact support").
