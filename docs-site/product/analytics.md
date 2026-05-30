# Analytics

The Analytics page (`/analytics`) is where you run social-signal queries and explore the results across a rich set of charts. Type any token symbol, hashtag, handle, or freeform keyword — TokenBuzz ingests matching posts and renders a grid of analytics cards.

## Running a query

1. Navigate to **Analytics** in the sidebar.
2. Type your query into the search bar at the top of the page — for example `$PEPE`, `AI agents`, or `Solana memecoin`.
3. Press **Enter** or click the search button.

TokenBuzz ingests matching posts from your connected social sources, runs analytics, and renders the cards. Ingestion uses one query from your monthly quota (5 on Free, 50 on Pro, unlimited on Alpha). The query is also saved to your [Query History](./query-history.md).

If you have previously run the same query, a recent-queries dropdown appears when you focus the search bar so you can re-submit without retyping.

## Source filter

When a query is active, a row of source chips appears above the chart grid. Click a chip to filter the **tweet results table** to a single social platform (X, Farcaster, Reddit, etc.). Charts themselves always reflect all sources regardless of the filter — the source filter only scopes the raw post table.

The available source chips depend on which sources you have connected and your plan tier.

## Chart categories

Analytics results are grouped into the following categories of charts. Each chart card can be:

- **Added to a dashboard** — via the card menu → **Add to dashboard**.
- **Added to Hum context** — via the card menu → **Add to context**, or by dragging the card into the Hum panel.

### Posts

**Tweet results table** — the individual posts that matched your query, with author, text, engagement counts, token tags, and sentiment. Filter this table by source using the source chips.

### Hashtags and mentions

- **Top hashtags** — the most-used hashtags in matching posts over the last 24 hours, as a ranked bar list.
- **Top mentions** — the most-mentioned accounts by reach (follower-weighted).
- **Keyword word cloud** — the top extracted terms and phrases from post text.

### Engagement

- **Symbol rate** — how many posts per hour mention your query over time.
- **Engagement timeseries** — likes, retweets, replies, and quotes plotted over time.
- **Content length × engagement** — scatter chart of post text length versus engagement score, revealing whether long-form or short posts drive more interaction.
- **Conversation depth** — how deep threaded replies go on average, indicating the level of discussion vs. broadcast posting.

### Sentiment

- **Sentiment gauge** — a dial showing the overall bullish/bearish score for the query over the last 7 days.
- **Sentiment timeline** — a stacked area chart of the percentage of bull / bear / neutral posts over time.

### Audience

- **Geographic distribution** — a map chart of the top 15 author locations by post count.
- **Language distribution** — the breakdown of post languages.
- **Verification breakdown** — the share of posts from accounts with blue, business, or government verification badges.
- **Bot ratio** — the estimated share of posts from automated vs. human accounts.
- **Author influence** — a scatter chart of author followers versus their engagement rate, revealing whether high-follower accounts are actually engaging with the topic.
- **Posting heatmap** — a day-of-week × hour-of-day heat map of posting activity over the last 7 days, showing when the conversation peaks.

### Links

- **Domain distribution** — which external domains are linked to in matching posts.
- **Bio domains** — which domains appear in authors' profile bio links (useful for identifying affiliated projects or media).

### Source

- **Source distribution** — which social client or app posted each tweet (e.g. Twitter Web App, TweetDeck, Buffer), revealing organic vs. scheduled content.

## Monitor mode

When a query is active, a **Monitor** button appears in the controls row. Enabling a monitor keeps TokenBuzz polling for new posts matching your query in the background, so the charts stay fresh without you having to re-submit. Monitor sessions persist as long as the page is open.

## Adding results to a dashboard

Click the **...** menu on any card and choose **Add to dashboard**. A picker modal lets you select an existing dashboard or create a new one. The card is added to the chosen dashboard's grid, scoped to the same query.

You can also add all cards at once when pinning a query from [Query History](./query-history.md).
