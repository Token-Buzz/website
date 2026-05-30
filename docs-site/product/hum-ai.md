# Hum AI

Hum is TokenBuzz's built-in AI research assistant. It reads your social data — posts, sentiment, mention spikes, live charts — and answers questions in plain language, citing the sources it used.

## Opening Hum

Several ways to open Hum:

- Press **⌘K** to open the command palette, type "Ask Hum", and press Enter.
- Click the **+ quick-add menu** in the top nav and choose **Ask Hum**.
- Drag any card, token row, or post into the Hum panel — the panel opens automatically when you drag near the right edge of the screen.

The Hum panel slides in from the right side of the screen and stays open as you navigate between pages.

## Chatting with Hum

Type a question in the composer at the bottom of the panel and press **Enter** (or **Shift+Enter** for a new line). Hum streams its reply in real time.

Example questions Hum can answer:

- "What's driving $PEPE buzz tonight?"
- "Is the $SOL chatter actually bearish?"
- "Surface new narratives my watchlist missed"
- "Summarize the sentiment on this dashboard"

Hum cites every source it uses. Sources appear as pill chips below the reply. Always verify before making a trade decision.

## Attaching context

Hum is most useful when given specific context from your own data. You can attach context two ways:

### Drag and drop

Drag any of the following into the Hum panel to attach it as context:

- A card from an [Analytics](./analytics.md) results grid or a [Dashboard](./watchlists-and-dashboards.md).
- A token row from the [Movers](./movers.md) page or [Watchlist](./watchlists-and-dashboards.md).
- A post from the [Live Feed](./live-feed.md).

While dragging, the Hum panel shows a "Drop to add context" overlay. On drop, the item appears as a context chip above the composer. You can attach multiple items before sending.

### Card menu

On any analytics card, open the **...** menu and choose **Add to context**. This adds the card's data as a context chip and (if Hum is not already open) opens the panel.

### Sending context without text

You can send context chips without typing any message — just click the send button. Hum will summarize and analyze the attached context.

## Conversations

Hum conversations are multi-turn and persisted. The panel has two tabs:

- **Current chat** — the active conversation. You can continue asking follow-up questions and Hum maintains context across turns.
- **Previous chats** — a list of past conversations, sorted newest-first. Click any conversation to reload it. Each item shows the title, timestamp, and message count.

Click **New chat** (on the Previous chats tab) to start a fresh conversation.

## Quota

Hum usage is metered per calendar month:

| Plan | Hum queries / month |
|---|---|
| Free | 10 |
| Pro | 500 |
| Alpha | Unlimited |

The quota counter is shown at the bottom of the composer area (e.g. "12 / 500 this month"). Each send — whether you type a message, attach context, or both — uses one query.

When you reach your limit, the composer is replaced with an upgrade prompt. Upgrade on the [Account & Billing](../getting-started/account-and-billing.md) page to increase your quota.

## Preset questions from the command palette

When you type a query in the command palette (⌘K), the palette shows an **Ask Hum about "..."** option at the top of the results. Selecting it opens Hum with your search text pre-filled in the composer, ready to send.
