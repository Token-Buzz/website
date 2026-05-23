# M3 — Hum AI slide-out

The AI assistant available throughout the application. Slide-out panel from the right edge, persistent across routes, accepts drag-in context (cards, tokens, queries), supports multi-turn conversations.

## ClickUp tasks consolidated here

- Hum AI (parent)
- Create the Hum AI chat box slide-out available throughout the entire page
- Get Models hooked up
- Add drag-and-drop context features

## Locked decisions

- Slide-out panel anchored to the right edge of the viewport, ~420px wide. Toggle via keyboard shortcut (assigned in M4 command palette: `Ask Hum`) and via a persistent floating launcher icon.
- Conversations are per-user, persisted in DDB, threaded by `conversationId`.
- Drag-in context: any card from a dashboard / analytics page / live feed can be dragged into the panel and becomes a "context item" attached to the next message.
- LLM model: Claude (`claude-sonnet-4-6` for v1 — fast enough for streaming, strong enough for crypto-narrative reasoning). Default model can change without UI change.
- Hum usage is metered per-user-per-month and tier-gated (see M5).

## Schema additions

```ts
// UserData table
conversationKey(userId, conversationId) => {
  pk: `USER#${userId}`,
  sk: `CONV#${conversationId}`,
}
// attrs: { title, createdAt, updatedAt, messageCount }

messageKey(userId, conversationId, timestamp) => {
  pk: `USER#${userId}`,
  sk: `CONV#${conversationId}#MSG#${timestamp}`,
}
// attrs: { role: 'user'|'assistant', text, contextItems[]?, model, tokensIn, tokensOut }
```

## Phases

### Phase 1 — Slide-out shell + conversation persistence

- `<HumPanel>` component mounted at the application root (in `Shell.tsx`), always rendered but hidden until toggled.
- Persistent across route changes (sits above the page, not inside it).
- API routes: `GET /api/hum/conversations`, `POST /api/hum/conversations/:id/messages`, `GET /api/hum/conversations/:id`.

### Phase 2 — Anthropic SDK + streaming

- Server-side: Anthropic SDK with prompt caching enabled on the system prompt + recent context items.
- Streaming responses via Server-Sent Events to the panel.
- Model selection per request (default Sonnet 4.6, A/B with Opus 4.7 later).

### Phase 3 — Drag-in context

- Each card (M2) and each token / tweet in the live feed (M1) is a drag source.
- `<HumPanel>` is a drop target — accepting a drop attaches the item to the next outbound message as `contextItems`.
- Server includes context-item summaries in the message envelope sent to the model.

### Phase 4 — Conversation list + history sidebar

- Panel has two tabs: "Current chat" and "Previous chats".
- Previous chats list shows title (auto-generated from first user message), preview, timestamp.
- Click a previous chat → loads it into the panel.

### Phase 5 — Quota integration

- Each assistant response decrements the user's monthly Hum quota (M5).
- When quota is exhausted, the panel shows an inline upgrade CTA instead of the input field.

### Phase 6 — Preset prompts

- Accepts `presetQuestion` prop / URL param. Pre-fills the input so the M4 command palette's "Ask Hum about \<query\>" and the quick-add menu's "New alert via Hum" can drop the user directly into an opinionated starting point.

## Dependencies

- Requires M1 (data the model can reason over).
- Loosely depends on M2 (cards are drag sources) — Hum can launch before M2 lands but drag-in is limited until M2 cards exist.
- Tightly couples with M5 for quota enforcement.
- M4 provides discovery surfaces (quick-add, command-palette).
