# Movers

The Movers page is a real-time leaderboard of the tokens with the biggest change in social buzz, updated every 60 seconds.

## What "buzz delta" means

Buzz delta (Buzz Δ) is the percentage change in mention volume for a token compared to the same window earlier. A Buzz Δ of +412% on $PEPE over 1H means that token has been mentioned 4× more in the last hour than it was in the equivalent preceding hour. It is the primary signal TokenBuzz uses to surface tokens that are heating up before price reflects it.

## Time windows

Use the pill group at the top of the page to choose a window:

- **1H** — buzz delta over the last 1 hour vs. the hour before.
- **24H** — buzz delta over the last 24 hours vs. the prior 24 hours.
- **7D** — buzz delta over the last 7 days vs. the 7 days before.

Switching the window reloads the table from a fresh API call. The leaderboard shows up to 50 tokens.

## Table columns

| Column | Description |
|---|---|
| **Token** | Token symbol. |
| **Buzz Δ** | Percentage change in mention volume for the selected window. Green = increase, red = decrease. |
| **Mentions** | Absolute mention count in the selected window. |
| **Price** | Current token price in USD. |
| **24h** | 24-hour price change percentage. |
| **Sent** | Prevailing sentiment: **bull**, **bear**, or **neu**. |

On mobile, columns collapse into a two-line stacked card layout.

## Sorting

Click any sortable column header to sort. Click again to toggle ascending / descending. Available sort keys:

- **Buzz Δ** (default, descending)
- **Mentions**
- **Sentiment** (bull → neu → bear, or reversed)

## Dragging a row to Hum

Each row is a drag source. Drag any token row and drop it onto the [Hum AI](./hum-ai.md) panel to attach that token's context — symbol, mentions, buzz delta, and sentiment — to your next Hum message.

## Refresh cadence

The table refreshes its data automatically when you change the time window. Buzz Δ is recalculated every 60 seconds on the server side; the footer confirms the cadence.
