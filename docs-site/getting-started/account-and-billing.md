# Account & Billing

Manage your profile, plan, payment method, API keys, and notification preferences from the Account page (`/account`).

## Opening Account settings

Click your avatar or username in the bottom-left corner of the sidebar, then choose **Account**, or navigate directly to `/account`. The page is divided into tabs in a Clerk-hosted profile panel, plus TokenBuzz-specific tabs for Plan & Billing, Notifications, API Keys, and Danger Zone.

## Plans and tiers

TokenBuzz has three plans:

| | Free | Pro | Alpha |
|---|---|---|---|
| **Price** | $0 | $24 / month | $240 / month |
| **Annual price** | — | $240 / year (2 months free) | $2,400 / year |
| **Hum AI queries / month** | 10 | 500 | Unlimited |
| **Analytics queries / month** | 5 | 50 | Unlimited |
| **Social sources** | X + Farcaster | + Reddit | + Telegram + Discord |
| **Dashboards / alerts / watchlists** | Unlimited | Unlimited | Unlimited |

The Free plan is permanent — there is no trial period. Dashboards, alerts, and watchlist entries are never capped; only AI queries and social-ingestion queries are metered (because they cost real compute and API quota).

## Subscribing (upgrading from Free)

1. Go to **Account → Plan & Billing**.
2. Click **Upgrade plan** (or the upgrade prompt on any quota-limited action).
3. In the upgrade modal, select a plan (Pro or Alpha) and a billing interval (monthly or annual).
4. Enter your card details in the Stripe payment form.
5. Click **Subscribe**.

Your plan activates immediately. Stripe handles payment and SCA / 3D Secure challenges if required by your bank.

## Changing your plan

1. Go to **Account → Plan & Billing**.
2. Click **Change plan**.
3. Select the new plan and interval.
4. Confirm. Stripe prorates the charge or credit automatically.

## Cancelling your subscription

1. Go to **Account → Plan & Billing**.
2. Click **Cancel subscription**.
3. Confirm the cancellation.

Your plan stays active until the end of the current billing period. After that, the account downgrades to Free. You will not be charged again unless you re-subscribe.

## Reactivating a cancelled subscription

If you cancelled but are still within the billing period, you can change your mind:

1. Go to **Account → Plan & Billing**.
2. Click **Reactivate subscription**.

Reactivation removes the pending cancellation and keeps your plan active at the next renewal date.

## Updating your payment method

1. Go to **Account → Plan & Billing**.
2. Click **Update payment method**.
3. Enter the new card details in the Stripe form and save.

## Invoices

Past invoices are listed at the bottom of **Plan & Billing** under **Billing history**. Each row shows the invoice number, date, amount, and status. Click **View invoice** to open the Stripe-hosted invoice page, or **Download PDF** for a PDF copy.

## Usage meters

The **Plan & Billing** tab shows your current-month usage:

- **Analytics queries used** — how many social-ingestion queries you have run this calendar month.
- **Hum AI queries used** — how many AI chat turns you have sent this month.

Both counters reset on the first of each calendar month regardless of your billing cycle date.

## Notification preferences

Go to **Account → Notifications** to control how TokenBuzz notifies you:

- **Email me when an alert triggers** — when enabled, TokenBuzz sends an email to the address on your account whenever any of your alert rules fires. Toggle this on or off at any time.

Alert rules themselves are managed on the [Alerts](../product/alerts.md) page.

## API Keys (BYOK)

Go to **Account → API Keys** to connect your social-platform credentials. See `../byok/overview.md` for a per-provider setup guide.

The API Keys tab has two modes:

- **Per-source keys** — connect individual credentials per platform (X, Reddit, Farcaster, Telegram). Each platform shows its status (active / invalid), last-four digits of the key, and when it was last validated.
- **Apify** — use a single Apify API key as a scraping backend for all sources. Per-source overrides let you mix modes (e.g. use Apify for X but a native Reddit key for Reddit). Apify runs bill to your own Apify account at their standard compute-unit pricing.

For any connected key you can:

- **Enable background polling** — lets TokenBuzz use your key to refresh watchlist tokens in the background even when you are not actively browsing.
- **Remove key** — deletes the encrypted credential from your account.

## Danger Zone

**Account → Danger Zone** contains destructive account actions. Read each prompt carefully before confirming.
