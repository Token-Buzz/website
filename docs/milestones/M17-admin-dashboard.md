# M17 — Admin Dashboard

Adds an **admin-only console** inside the existing authed app (`packages/application`): a `/admin` route group covering four areas — **Users & accounts**, **Billing & subscriptions**, **Ingestion & ops health**, and **Token & content data**. v1 is **read-only-first** (plus the safe `exportUserData` action); privileged mutations are deliberately deferred. The work is intentionally low-risk — no new DynamoDB table, GSI, or key builder is required; nearly every read reuses an existing `packages/core/src/db` function.

## Locked decisions

- **Access control:** Clerk `publicMetadata.role === 'admin'` — granted and revoked in the Clerk dashboard. No secret allowlist.
- **Scope:** all four areas (Users & accounts, Billing & subscriptions, Ingestion & ops health, Token & content data).
- **Hosting:** a new `app/(admin)/` route group with its own layout; an "Admin" nav entry visible only to admins.
- **v1 is read-only.** No impersonation, refunds, role/plan mutation, or admin-initiated deletion — all need audit trails. The one safe write action is `exportUserData`.

## Gating architecture

Defense-in-depth, 3 layers:

1. **Middleware (`packages/application/proxy.ts`)** — add `/admin(.*)` to a `createRouteMatcher` and `auth.protect()` it, preserving the existing `next-action` server-action carve-out. First gate only; not trusted for authorization.
2. **Page guard `requireAdmin()`** — new server-only helper at `app/(admin)/_admin/requireAdmin.ts`. Reads `(await auth()).sessionClaims?.metadata?.role` first; falls back to `clerkClient().users.getUser(userId)` `publicMetadata.role` so newly-granted admins are never locked out before their token refreshes. Non-admins are redirected to `/dashboard`. Called by `app/(admin)/layout.tsx`.
3. **API guard `requireAdminApi()`** — sibling helper returning `{ userId }` or `Response.json({ error: "Forbidden" }, { status: 403 })`, mirroring the existing `auth()`→401 pattern. **Authoritative gate** — every `app/api/admin/*` route calls it first. Even if middleware or UI are bypassed, data cannot be fetched.

A pure `isAdmin(role: unknown): boolean` predicate is extracted so the core logic is unit-testable without mocking Clerk.

**Clerk console step (Phase 1):** add a custom session-token claim mapping `metadata` → `{{user.public_metadata}}` so the middleware can read the role cheaply without a Backend API round-trip. Until this claim is configured and sessions re-minted, `sessionClaims.metadata?.role` is undefined; `requireAdmin()`'s Backend-API fallback covers the gap for newly-granted admins.

## Schema / config additions

**None.** No new table, GSI, key builder, or secret. This is the explicit design goal — every needed read already has a function:

- **Users list** → Clerk Backend API `clerkClient().users.getUserList({ limit, offset, query })` (already used in `app/api/account/route.ts`); `limit` caps at 500, default 10. Enrich only the current page with per-user getters (never enrich the full base in one request).
- **Global billing totals (subscriber counts / MRR)** → Stripe (existing client under `app/api/billing/_stripe`), not a DB scan. The DB has no plan GSI; a **`PlanIndex` GSI is deferred** — build it (with a dynalite integration test) only if a real-time global plan-distribution view becomes a hard requirement.
- **Cross-user ops / token reads** → already exist (see reuse list below).

## Functions to reuse

No new code in `packages/core` except `isAdmin`. All reads target existing functions:

**Per-user (1 read each — fan-out is bounded to the current page size):**

- `getPlanRecord(userId)` / `getUserPlan(userId)` — `packages/core/src/db/billing.ts:71`, `usage.ts:27`
- `getHumUsage(userId, period)` / `getIngestionUsage(userId, period)` / `getRefreshUsage(userId, period)` — `usage.ts:44/96/148`
- `getByokKeyStatus(userId, provider)` (non-secret projection — never decrypts) — `byok.ts:139`
- `exportUserData(userId)` — `account.ts:28`
- `getStripeCustomerId(userId)` — `billing.ts`

**Cross-user (no fan-out):**

- `listKeyHolders(provider)` — `byok.ts:221`
- `listAllMonitors()` — `monitors.ts:106`
- `listAlertsForToken(symbol)` — `alerts.ts:223`
- `listTrackedTokens({ limit })` / `getSpikingTokens()` — `tokens.ts:57/73`; `getToken(symbol)`
- `readSocialEvents()` — `social-events.ts:40`; `readSourceCounts(query)` — `source-counts.ts:35`
- Aggregates (`getMpm()`, `getPulse()`) — `packages/core/src/db/aggregates.ts`; poll-state getters — `poll-state.ts`
- Billing tier prices — `packages/core/src/billing/tiers.ts`

## Phases

### Phase 1 — Admin foundation: gating, route group, layout, nav (M)

1. Clerk dashboard: add custom session claim `metadata` → `{{user.public_metadata}}` (console step, documented in the runbook).
2. Implement `requireAdmin()` at `app/(admin)/_admin/requireAdmin.ts` — claim-first, Backend-API fallback, redirect non-admins to `/dashboard`.
3. Implement `requireAdminApi()` — returns `{ userId }` or a 403 `Response`.
4. Extract the pure `isAdmin(role: unknown): boolean` predicate (unit-tested).
5. Route group: `app/(admin)/layout.tsx` (calls `requireAdmin()`, renders an `AdminShell` reusing `_dashboard/primitives`) + `app/(admin)/admin/page.tsx` landing placeholder.
6. `proxy.ts`: add `/admin(.*)` matcher + `auth.protect()` (preserve the `next-action` carve-out).
7. `Shell.tsx`: pass an `isAdmin` flag into `AppShell`; append the Admin nav and command-palette entry **only** when true, via a conditional derived array — do **not** mutate `NAV_ITEMS_BASE` (referenced at `Shell.tsx:191/224/923`).
8. Unit tests: `isAdmin()` predicate + claim/fallback resolution.
9. Browser test: non-admin sees no Admin entry, `/admin` redirects, `/api/admin/*` → 403; flip role to admin → entry appears, `/admin` renders.

**Deliverable:** A protected, empty `/admin` route group reachable only by Clerk admins, with the two reusable guards in place for all subsequent phases.

### Phase 2 — Users & accounts (L)

1. `GET /api/admin/users` (guarded): `getUserList({ limit, offset, query })`; enrich the returned page with `getPlanRecord` + `getUserPlan`; return `{ users, totalCount }`.
2. `GET /api/admin/users/[userId]`: Clerk user + plan + usage (`getHum/Ingestion/RefreshUsage`, period from tier) + `getByokKeyStatus`.
3. `app/(admin)/admin/users/page.tsx` — searchable, paginated table (email, plan, signup date, last active, usage-vs-quota); search wired to the Clerk `query` param.
4. `app/(admin)/admin/users/[userId]/page.tsx` — detail view: plan, usage bars, BYOK status, `exportUserData` JSON behind a disclosure.
5. Safe action: "Export user data" button (`exportUserData`). No role/plan mutation, no admin delete in v1.
6. Unit tests for view-model mapping + pagination math.
7. Browser test: paginate, search by email, open a detail page for a known account.

**Deliverable:** Paginated, searchable Clerk-backed Users list with per-user plan/usage/BYOK detail; fan-out bounded to one Clerk page.

### Phase 3 — Billing & subscriptions (M)

1. `GET /api/admin/billing` (guarded): per-page plan distribution (Clerk page + `getPlanRecord`) plus global subscription/MRR from Stripe (`app/api/billing/_stripe`).
2. Extend the user detail route with a Stripe subscription block (`getStripeCustomerId` → Stripe lookup).
3. `app/(admin)/admin/billing/page.tsx` — tier breakdown, active/past-due/canceled counts (Stripe), grace/dunning list (DB plan fields from `enterGracePeriod`/`setPlanStatus`).
4. Read-only: per-customer Stripe dashboard deep links instead of in-app refunds or cancellations.
5. Unit tests for tier-aggregation and MRR math against `tiers.ts`.
6. Browser test: tier counts and dunning list match a known account; Stripe deep link works.

**Deliverable:** Billing overview (Stripe-sourced global counts, DB-sourced dunning) with per-customer Stripe deep links — no in-app financial mutations.

### Phase 4 — Ingestion & ops health (M)

1. `GET /api/admin/ops` (guarded): `listAllMonitors()`, `readSourceCounts(query)`, `getMpm()`/`getPulse()`, poll-state staleness, `listKeyHolders('twitter' | 'telegram')`.
2. `app/(admin)/admin/ops/page.tsx` — cards: active monitor count, source-count breakdown, MPM/pulse trend, last-poll staleness warnings, BYOK key-holder counts by provider, invalid-key count.
3. Surface poll lag and stale-query warnings as the primary actionable signal.
4. Unit tests for staleness/health derivation (timestamps → healthy/stale/down).
5. Browser test: monitor counts, source breakdown, and a deliberately stale poll-state surface as a warning.

**Deliverable:** Ops dashboard for ingestion throughput, poll freshness, source breakdown, and BYOK capacity — built entirely from existing cross-user functions.

### Phase 5 — Token & content data (M)

1. `GET /api/admin/tokens` (guarded): `listTrackedTokens({ limit })` + `getSpikingTokens()`.
2. `GET /api/admin/tokens/[symbol]`: `getToken`, `listAlertsForToken` (cross-user), recent `readSocialEvents`.
3. `app/(admin)/admin/tokens/page.tsx` — sortable tracked-token table (buzz/mentions/spike); spiking tokens highlighted.
4. `app/(admin)/admin/tokens/[symbol]/page.tsx` — detail: profile/buzz, cross-user alerts referencing the token (owning `userId` links back to `/admin/users/[userId]`), recent social events.
5. Unit tests for sort/derivation view-model logic.
6. Browser test: sort by buzz, open a token detail, confirm alerts and events render and the user back-link works.

**Deliverable:** Token & content explorer (tracked/spiking) with per-token detail for support and content auditing.

### Phase 6 — Polish, observability & docs (S)

1. Consistent empty/loading/error and 403/404 states across all admin pages.
2. Lightweight admin access logging (`userId` + route, no PII) for traceability.
3. `/admin` overview landing page linking the four sections with top-line counts.
4. Command-palette admin entries present only for admins; keyboard nav works.
5. Finalize `docs/milestones/M17-admin-dashboard.md` + a short operator runbook (how to grant the admin role in Clerk; read-only scope vs. deferred mutations).
6. Full typecheck + lint + unit tests green; final admin/non-admin browser smoke.

**Deliverable:** Polished, documented admin dashboard with consistent UX, access logging, and an operator runbook.

## Dependencies & ordering

- **Phase 1 blocks everything** — the route group, both guards, and nav integration must land first.
- **Phases 2–5 are independent of each other** once Phase 1 lands → parallelizable (one subagent per phase, per the L/XL convention). **Phase 3 lightly depends on Phase 2** (they share the `/api/admin/users/[userId]` route) — sequence Billing after or alongside Users.
- **Phase 6 last.**

Per-phase Size: Phase 1 = M, Phase 2 = L, Phases 3/4/5 = M, Phase 6 = S.

## Risks & gotchas

1. **Clerk metadata not in session by default.** Until the custom claim is configured AND sessions are re-minted, `sessionClaims.metadata?.role` is undefined. The Backend-API fallback in `requireAdmin` covers newly-granted admins. The middleware's cheap claim-check path takes effect on the user's next token refresh.
2. **Authorization lives in the API guard, not in middleware or UI.** Nav hiding is cosmetic; claims can lag. `requireAdminApi()` is the authoritative gate — test that a non-admin gets 403 from every admin API route even when hitting it directly.
3. **Cross-user fan-out cost (no Users table).** Bound enrichment to one Clerk page (`limit` ≤ 100); never enrich the full user base in a single request. Global aggregates come from Stripe. `PlanIndex` GSI is deferred.
4. **`getUserList` limits.** Cap is 500, default 10; use server-side `offset`/`totalCount` pagination, never load all users client-side.
5. **Privileged writes out of scope for v1.** No impersonation, refunds, role/plan mutation, or admin-initiated deletion — all require audit trails. v1 = read-only + safe `exportUserData`.
6. **PII / secret exposure.** Never expose decrypted BYOK secrets (use `getByokKeyStatus`, the projected non-secret read); keep PII out of access logs.
7. **Nav integration is touchy.** `NAV_ITEMS_BASE` is referenced at `Shell.tsx:191/224/923`; append the Admin entry via a conditional derived array, do not mutate the constant.
8. **Preserve the `next-action` carve-out** in `proxy.ts` when adding the `/admin(.*)` matcher.

## Critical files

- `packages/application/proxy.ts` — add `/admin(.*)` matcher
- `packages/application/app/(authed)/layout.tsx` — pattern to mirror for `app/(admin)/layout.tsx`
- `packages/application/app/(authed)/_dashboard/Shell.tsx` — conditional Admin nav entry (lines 191/224/923)
- `packages/application/app/api/account/route.ts` — existing `clerkClient` usage pattern to follow
- `packages/core/src/db/{billing,usage,byok,monitors,alerts,tokens,social-events,source-counts,aggregates,account}.ts` — reuse targets
- `packages/core/src/billing/tiers.ts` — tier prices for MRR/quota display
- New: `app/(admin)/_admin/requireAdmin.ts`, `app/(admin)/_admin/requireAdminApi.ts`, `app/(admin)/layout.tsx`, `app/(admin)/admin/**`, `app/api/admin/**`

## Status / Next steps / Gotchas

- **Status:** freshly planned; no implementation code yet. Epic + phase issues to be created, Project board updated.
- **Next:** Phase 1 (gating foundation) blocks all other phases and is the only correct starting point. Once Phase 1 lands, Phases 2–5 are fully parallelizable.
- **No schema work.** No new table, GSI, or key builder required for any phase — the deferred `PlanIndex` GSI is only pulled in if a real-time global plan-distribution view becomes a hard requirement.
- **v1 is read-only-first.** The safe `exportUserData` action is the one deliberate exception; all privileged mutations (impersonation, refunds, role changes, deletion) are out of scope until audit trails exist.
- **Gotchas:** the Clerk custom session-claim console step in Phase 1 must be done manually in the Clerk dashboard — document it in the runbook so future sessions can reproduce it. Until sessions re-mint, the Backend-API fallback path in `requireAdmin` is the live gate.
