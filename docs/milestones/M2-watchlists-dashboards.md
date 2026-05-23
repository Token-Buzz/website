# M2 — Watchlists → Dashboards

The pivotal repositioning: watchlists become dashboards. A dashboard is a collection of analytics cards (and a candlestick chart) scoped to a search query, a ticker, or a combination. Cards are drag-and-drop, addable from the Analytics page, and removable.

## ClickUp tasks consolidated here

- Watchlists → Each one is a dashboard (parent)
- Each watchlist dashboard will contain all analytics and a candlestick chart
- Each dashboard can be either a combination of a ticker symbol and search term, or a search term on its own
- Make each card (analytics + candlestick) a moveable drag-and-drop component with an × remove button
- Card `...` menu with two options: "add to context" (Hum) and "add to dashboard"

## Locked decisions

- A dashboard's scope is `{ ticker?, query?, name }` — at least one of ticker or query must be present.
- Cards are positioned by `{ x, y, w, h }` grid coordinates stored per-card on the dashboard.
- Drag-and-drop layout uses a grid system (12-column responsive grid).
- Each card type implements a common `<Card>` interface with `header / body / footer` slots and a `...` menu.

## Schema additions

```ts
// UserData table
dashboardKey(userId, dashboardId) => {
  pk: `USER#${userId}`,
  sk: `DASHBOARD#${dashboardId}`,
}
// attrs: { name, ticker?, query?, cards: Card[], createdAt, updatedAt }

// Card shape
type Card = {
  id: string
  type: 'mentions' | 'sentiment' | 'hashtags' | 'domains' | 'languages' | 'sources' | 'top-authors' | 'candlestick' | ...
  position: { x: number, y: number, w: number, h: number }
  options: Record<string, unknown>  // type-specific (e.g. timeframe for candlestick)
}
```

## Phases

### Phase 1 — Dashboard CRUD + listing

- New API routes: `GET /api/dashboards`, `POST /api/dashboards`, `PATCH /api/dashboards/:id`, `DELETE /api/dashboards/:id`.
- New `/dashboards` route listing all of the user's dashboards.
- "New dashboard" flow: name + (ticker and/or query) → empty dashboard.

### Phase 2 — Dashboard view + card rendering

- Route `/dashboards/[id]`.
- Grid layout component that positions cards by their `{x, y, w, h}` coordinates.
- Card type registry — one component per card type, sharing a common chrome (header, `...` menu, × remove).

### Phase 3 — Drag-and-drop layout editor

- Use `dnd-kit` or `react-grid-layout` for grid drag-and-drop.
- "Edit layout" mode toggles drag handles + resize handles on every card.
- Layout changes persist via `PATCH /api/dashboards/:id` on drop.

### Phase 4 — Card `...` menu

- Two actions per card: "Add to context" (sends card data to Hum via M3) and "Add to dashboard" (opens a dashboard picker — copy the card's config into the chosen dashboard).
- Implemented as a small floating menu component, shared across all card types.

### Phase 5 — Promote-from-Analytics flow

- On the Analytics page, every aggregate card gets the same `...` menu. "Add to dashboard" opens the same dashboard picker.
- Bridge between exploratory Analytics use and persistent dashboards.

## Dependencies

- Requires M1 (the aggregates that the cards display).
- Unblocks M3 (cards as Hum context), M6 (candlestick card type), M8 (query history → pin to dashboard).

## Notes

- The `candlestick` card type is a placeholder until M6 ships — until then, it renders an "Coming soon" state or falls through to the existing SVG sparkline.
