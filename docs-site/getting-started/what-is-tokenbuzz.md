# What is TokenBuzz?

TokenBuzz is a crypto social-signal analytics platform that turns the noise of social media into clear, actionable intelligence for token traders and researchers.

## The core idea

Crypto prices move before on-chain data moves. Social chatter — a spike in $PEPE mentions, a bear-sentiment swing on $SOL, a KOL post that lights up Farcaster — often precedes price action by hours. TokenBuzz ingests posts from X (Twitter), Farcaster, Reddit, Telegram, and Discord, runs them through sentiment classification and engagement analytics, and surfaces the signals you need before they show up anywhere else.

## Who it's for

- **Active traders** who need to catch narrative shifts and mention spikes ahead of the crowd.
- **Researchers and analysts** who want to compare social momentum across tokens, narratives, or time periods.
- **Portfolio managers** tracking a curated watchlist who want a single feed of relevant activity and rule-based alerts when something unusual happens.

## Main areas of the app

| Area | What it does |
|---|---|
| **Movers** | Leaderboard of tokens ranked by buzz delta — how much their mention volume changed over 1H, 24H, or 7D. |
| **Live Feed** | Real-time stream of posts from your watchlist tokens, filterable by sentiment. |
| **Alerts** | Rule-based notifications — buzz spikes, price moves, sentiment flips — delivered in-app. |
| **Watchlist** | Your curated token list with price, mentions, buzz delta, sentiment, and sparkline at a glance. |
| **Dashboards** | Persistent, named workspaces that pin any analytics card or chart to a custom grid layout. |
| **Analytics** | Deep-dive charts for any query: sentiment, hashtags, engagement, geography, influencer mapping, and more. |
| **Hum AI** | AI research assistant that reads your social data and answers questions in plain language, citing its sources. |
| **Charts** | Candlestick price charts with social-event overlays — see exactly where the buzz spikes happened on the candle. |
| **Query History** | Every analytics search you run is saved so you can re-run, compare snapshots, or pin results to a dashboard. |
| **Command palette** | Press ⌘K to jump between dashboards and execute common actions without navigating menus. |

## What makes it different

Most charting tools show you price. TokenBuzz shows you *why* price is moving — or why it's about to. The candlestick charts overlay social events directly on price candles so you can see the correlation between a KOL tweet storm and the next leg up. Hum AI can explain any of those moments in plain language and point you to the underlying posts.

## Data sources

TokenBuzz connects to social platforms through your own API keys (Bring Your Own Key — BYOK). Your credentials are AES-KMS encrypted at rest and never shared with third parties.

- **X (Twitter)** — via twitterapi.io. Available on all plans.
- **Farcaster** — built-in Neynar integration. Available on all plans.
- **Reddit** — your Reddit app credentials. Available on Pro and Alpha plans.
- **Telegram** — your GramJS session. Available on Alpha plan.
- **Discord** — available on Alpha plan.

## Plans at a glance

| | Free | Pro | Alpha |
|---|---|---|---|
| Hum AI queries / month | 10 | 500 | Unlimited |
| Analytics queries / month | 5 | 50 | Unlimited |
| Sources | X + Farcaster | + Reddit | + Telegram + Discord |
| Dashboards, alerts, watchlists | Unlimited | Unlimited | Unlimited |

See [Account & Billing](./account-and-billing.md) for full plan details.

## Getting started

See [Quickstart](./quickstart.md) to connect your first data source and run your first query.
