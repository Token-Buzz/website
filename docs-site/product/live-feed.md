# Live Feed

The Live Feed is a chronological stream of social posts from the tokens on your watchlist, with sentiment filtering and infinite scroll.

## What appears in the feed

The feed shows posts that mention your watchlist tokens. Each post card displays:

- **Author avatar, name, and handle**
- **Post text**
- **Token tags** — the watchlist tokens detected in the post (shown as `$SYMBOL` chips)
- **Engagement counts** — likes, retweets, replies, views
- **Time** — relative timestamp (e.g. "4m ago", "2h ago")
- **Sentiment pill** — `bull`, `bear`, or `neu` when classified

If your watchlist is empty, the feed will be empty too. Add tokens to your watchlist to populate it.

## Sentiment filter

Use the sentiment pill group at the top of the feed to narrow results:

- **All** — show every post regardless of sentiment (default).
- **Bull** — only posts classified as bullish.
- **Bear** — only posts classified as bearish.
- **Neutral** — only posts classified as neutral.

Changing the filter reloads the feed from the start.

## Token filter (deep link)

The feed accepts a `?token=SYMBOL` URL parameter that pre-filters to a single token. This is used by the [Charts](./charts.md) page — clicking "View in live feed" from a social-event overlay on a candle opens the Live Feed filtered to that token. A chip at the top of the feed shows the active filter; click **clear** next to the chip to remove it.

## Infinite scroll

The feed loads 30 posts at a time. Scroll to the bottom to load more. A "Loading more…" indicator appears while the next page fetches. When there are no more posts a footer message reads "End of feed · posts from your watchlist tokens."

## Dragging a post to Hum

Each post card is a drag source. Drag any card into the [Hum AI](./hum-ai.md) panel to attach the author handle, post text, and associated token as context for your next Hum message.
