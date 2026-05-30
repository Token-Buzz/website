# Watchlists and Dashboards

TokenBuzz gives you two complementary ways to organize your research: the Watchlist for monitoring a curated token list, and Dashboards for building persistent analytics workspaces.

## Watchlist

The Watchlist page (`/watchlist`) displays your curated tokens in a sortable table.

### The token table

Each row shows:

| Column | Description |
|---|---|
| **Token** | Symbol and name. |
| **Price** | Current price in USD. |
| **24h** | 24-hour price change percentage. |
| **Buzz Δ** | Mention-volume change (buzz delta) relative to the prior period. |
| **Mentions** | Absolute mention count. |
| **Sparkline** | A small trend line of recent buzz activity. |
| **Sentiment** | Prevailing social sentiment: bull, bear, or neutral. |
| **Live** | Indicator dot for tokens with active live data. |

You can sort by any column by clicking its header. Click again to reverse the sort direction.

### Filtering the list

Use the filter bar above the table to narrow the view:

- **All** — show every token.
- **Bull** — tokens with bullish sentiment.
- **Bear** — tokens with bearish sentiment.
- **Live** — tokens currently receiving live ingest data.

### Adding tokens

Click **Add token** in the filter bar to add a token to your watchlist.

### Token detail pane

Click any row to open the token detail pane. On desktop it slides in as a right-hand panel beside the list; on mobile it opens as a full-screen overlay.

The detail pane shows:

- Live price, 24-hour change, buzz delta, and mention count.
- A sentiment meter showing the current bullish/bearish score.
- A [candlestick price chart](./charts.md) for the token.
- A sample of recent mentions with author, follower count, time, and sentiment.

Close the pane by clicking × or selecting a different token.

## Dashboards

Dashboards (`/dashboards`) are named, persistent workspaces that let you pin analytics cards and price charts to a custom grid layout. A dashboard is scoped to a **ticker** (a specific token), a **query** (a keyword or topic), or both.

### Creating a dashboard

1. Go to **Dashboards** in the sidebar.
2. Click **New dashboard**.
3. Give the dashboard a **Name** (required).
4. Enter a **Ticker** (e.g. `BTC`), a **Query** (e.g. `AI agents L2`), or both. At least one is required.
5. Click **Create dashboard**.

You are taken directly to the new dashboard's grid view.

You can also create a dashboard from:

- The **command palette** (⌘K → "New dashboard").
- The **+ quick-add menu** in the top nav.
- The **Add to dashboard** action on any analytics card.
- The **Pin to dashboard** action on any saved query in [Query History](./query-history.md).

### Viewing and editing a dashboard

A dashboard's detail page (`/dashboards/[id]`) shows a drag-and-resize card grid. Each card is an analytics chart or data view scoped to the dashboard's ticker / query. Rearrange cards by dragging them; resize by dragging the bottom-right corner.

### Deleting a dashboard

From the Dashboards list, click the × icon on the right side of a dashboard row. A confirmation prompt appears before deletion.

### Adding cards from Analytics

When viewing [Analytics](./analytics.md) results, every chart card has a **...** menu with an **Add to dashboard** action. Clicking it opens a dashboard picker where you can select an existing dashboard or create a new one. The card is added to the chosen dashboard's grid.
