# M5 — Account / Billing / Stripe

Account-page rebuild plus end-to-end Stripe subscriptions with custom UI (Stripe Elements). Tier-gated entitlements enforced server-side against monthly per-user usage counters.

## ClickUp tasks consolidated here

- Account settings page with payments and billing and such
- Subscriptions through Stripe integration

## Locked decisions

- **Custom UI with Stripe Elements** (not Stripe Checkout / Customer Portal). Full design control; we build the upgrade flow, payment-method update, plan-change, cancel, and invoice list ourselves.
- **Three tiers** (matching the existing marketing site): Free / Pro $24/mo / Alpha $240/mo. Both monthly and annual SKUs per paid tier (2 months free on annual).
- **No trial.** Free tier itself is the "trial".
- **Cost-driven gating only.** Tier limits meter what costs us real money: Hum AI queries and social-API ingestion. No artificial caps on dashboards, alerts, watchlists, or other zero-marginal-cost features.

## Tier quotas (starting point)

| | Free | Pro | Alpha |
| - | - | - | - |
| Hum AI queries / month | 10 | 500 | Unlimited |
| Tweet-ingestion queries / month | 5 | 50 | Unlimited |
| Source access | X + Farcaster (M9) | + Reddit | + Telegram + Discord |
| Everything else | Unlimited | Unlimited | Unlimited |

## Schema additions

```ts
// secrets (infra/secrets.ts)
STRIPE_SECRET_KEY
STRIPE_PUBLISHABLE_KEY
STRIPE_WEBHOOK_SECRET

// tier config (packages/core/src/billing/tiers.ts)
//   declares quotas + Stripe priceId per tier × interval

// UserData table — plan record
planKey(userId) => { pk: `USER#${userId}`, sk: 'PLAN' }
// attrs: { plan, status, interval, currentPeriodEnd, cancelAtPeriodEnd, stripeCustomerId, stripeSubId }

// UserData table — monthly usage counters
usageKey(userId, yyyymm, kind) => { pk: `USER#${userId}`, sk: `USAGE#${yyyymm}#${kind}` }
// kind ∈ {'hum','queries','reddit',...}, attrs: { count } — atomic ADD on increment

// Stripe webhook idempotency
stripeEventKey(eventId) => { pk: `STRIPE_EVENT#${eventId}`, sk: 'PROCESSED' }
```

## Phases

### Phase 1 — Stripe setup + tier config

- Add Stripe secrets to `infra/secrets.ts`. Seed via SST Console.
- Stripe dashboard: create Products + Prices (Pro Monthly $24, Pro Annual $240 [2 months free], Alpha Monthly $240, Alpha Annual $2400).
- `tiers.ts` exports tier metadata + Stripe price IDs.

### Phase 2 — Plan record + entitlement core

- `getUserPlan(userId)` reads DDB, defaults to Free if no row.
- `canUseHum(userId)` and `canIngestQuery(userId)` check the per-month usage counter against the tier cap; return `{ allowed, used, limit, plan }`.
- `recordHumUsage(userId)` and `recordIngestionUsage(userId)` atomic ADD on the monthly counter row.
- Counters auto-reset on month rollover via the different `yyyymm` partition in the sort key.

### Phase 3 — Stripe webhook handler

- New unauthenticated route `/api/webhooks/stripe` with signature verification via `STRIPE_WEBHOOK_SECRET`.
- Idempotency: check for an existing `STRIPE_EVENT#<id>` row first; return 200 if seen.
- Handled events: `customer.subscription.created/updated/deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`.
- Each event updates the user's PLAN record.

### Phase 4 — Custom upgrade UI with Stripe Elements

- Install `@stripe/react-stripe-js` + `@stripe/stripe-js`.
- `<UpgradeModal>` with `<Elements>` provider + `<PaymentElement>` for card capture.
- Monthly/yearly toggle, plan-comparison column.
- Server endpoints: `POST /api/billing/create-subscription`, `change-plan`, `cancel`, `reactivate`, `update-payment-method`, `GET /api/billing/invoices`.
- SCA / 3DS handled via `stripe.confirmPayment(clientSecret)` — plan for Stripe test-card coverage.

### Phase 5 — Account page rebuild

- Replace the 9-line `account/page.tsx` with a tabbed layout:
  - **Profile** — Clerk's `<UserProfile />`
  - **Plan & Billing** — current plan card, monthly/yearly toggle, payment method, invoices list, cancel/reactivate
  - **Notifications** — M1's alert delivery preferences
  - **API Keys** — Alpha-only, generate/revoke
  - **Danger Zone** — delete account, export data

### Phase 6 — Entitlement enforcement

- Wire `canUseHum` into `/api/hum/chat` (M3): on exceeded, return HTTP 402 with `{ plan, used, limit, upgradeUrl }`.
- Wire `canIngestQuery` into the tweet-ingestion route. Same pattern.
- Client interceptor on 402 → opens `<UpgradeModal>`.
- UX surfacing: "X / Y queries used this month" visible in the relevant UIs.

### Phase 7 — Marketing site refresh

- Update `packages/marketing/app/_components/Pricing.tsx`: monthly/yearly toggle with annual savings badge ("Save $48/yr"), real quotas displayed under each tier, "Most Popular" stays on Pro.
- CTAs route to signup with `?plan=pro&interval=year` so users land in the right upgrade flow post-auth.

### Phase 8 — Dunning + grace period

- `past_due` keeps the user on their paid tier for a 7-day grace period with a top banner: "Payment failed — update your card."
- After Stripe gives up dunning (subscription deleted webhook), auto-downgrade to Free with email notification.

## Dependencies

- Independent of feature milestones — can be built in parallel.
- Touches M3 (Hum quota check), M9 (per-source quota check).
- M9 extends the usage-counter schema with per-source counters.
