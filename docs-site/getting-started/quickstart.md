# Quickstart

Get from zero to your first social-signal query in five minutes.

## 1. Sign up or sign in

1. Go to the TokenBuzz app and click **Sign in** (or **Get started** on the marketing site).
2. Create an account with Google, GitHub, or email + password.
3. On first login you land on the **Today** dashboard — a home view with a summary of your watchlist activity.

## 2. Connect a data source

TokenBuzz uses your own API credentials to pull data from social platforms. This keeps your searches private, avoids shared rate limits, and means your key usage is never mixed with other users.

Before running your first query, add at least one API key:

1. Open **Account** from the sidebar footer (or navigate to `/account`).
2. Go to the **API Keys** tab.
3. Select the provider you want to connect — X (Twitter), Reddit, Farcaster, or Telegram.
4. Follow the inline setup instructions to generate a credential on that platform.
5. Paste the credential and click **Validate & save**. TokenBuzz validates the key immediately and shows a confirmation when it is working.

For step-by-step instructions per provider, see `../byok/overview.md`.

> X (Twitter) and Farcaster are available on the Free plan. Reddit requires Pro or above. Telegram and Discord require Alpha.

## 3. Run your first analytics query

1. Click **Analytics** in the left sidebar.
2. Type a token symbol, hashtag, or keyword into the search bar — for example `$PEPE` or `AI agents L2`.
3. Press **Enter** or click the search button.

TokenBuzz ingests posts matching your query and renders a grid of analytics cards:

- A **tweet results** table showing the matching posts.
- **Sentiment gauge** and **sentiment timeline** showing bullish/bearish breakdown.
- **Top hashtags** and **top mentions** by reach.
- **Engagement timeseries**, **geographic distribution**, **language split**, and more.

This query counts against your monthly ingestion quota (5 queries / month on Free, 50 on Pro, unlimited on Alpha).

## 4. Explore the results

Once results load you can:

- **Filter by source** — use the source chips above the grid to narrow results to a single platform (e.g. X only).
- **Pin a card to a dashboard** — click the menu on any card and choose **Add to dashboard** to save it to a persistent workspace.
- **Ask Hum AI** — drag any card into the Hum panel, or use the card menu → **Add to context**, then type a question.

## 5. Check Movers and the Live Feed

While your query runs, two other pages are worth exploring right away:

- **Movers** — shows the tokens with the biggest social-buzz spikes right now, ranked by Buzz Δ, Mentions, or Sentiment.
- **Live Feed** — streams recent posts from your watchlist tokens in real time, with sentiment filter pills.

Both pages update every 60 seconds and require no quota.

## 6. Set an alert

To be notified the next time a token spikes:

1. Go to **Alerts** in the sidebar.
2. Fill in the **Symbol** field (e.g. `PEPE`).
3. Pick a **Condition**: Buzz spike, Sentiment flip, or Price move.
4. Set a **Threshold** percentage (for buzz spike or price move).
5. Click **Create alert**.

Triggered alerts appear in the **Inbox** at the bottom of the Alerts page. You can optionally enable email notifications in **Account → Notifications**.

## What's next?

- [Account & Billing](./account-and-billing.md) — review your plan or upgrade.
- [Movers](../product/movers.md) — understand how the buzz ranking works.
- [Analytics](../product/analytics.md) — full reference for every analytics card.
- [Hum AI](../product/hum-ai.md) — get the most out of the AI research assistant.
- [Alerts](../product/alerts.md) — create rules and manage your inbox.
