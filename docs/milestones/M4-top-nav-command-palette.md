# M4 — Top nav + ⌘K command palette

Strips the current top nav down to essentials, adds a ⌘K command palette as the single search surface, and a quick-add `+` menu for common actions. Both the top nav and the existing sidebar "Search tokens" button funnel into the same palette.

## ClickUp tasks consolidated here

- Brainstorm Search bar on side nav bar and on top nav bar
- Give the top navigation bar purpose

## Locked decisions

- Strip from the current top nav: hardcoded "Live · 2,140 mentions/m" status pill, broken search input, time-window pills (they stay on the pages that need them, not in the chrome).
- Keep in the top nav: `[Search ⌘K]` button and `[+]` quick-add button. On mobile, collapse to icons only.
- Notifications bell deferred to ship with M1's alerts delivery.
- User menu stays in the sidebar footer where it lives today.
- Search returns **dashboards + actions/commands only** in v1. Not tokens, not handles, not pages, not recent queries.
- Command registry is a single `Command[]` shared between the palette and the quick-add menu.

## Phases

### Phase 1 — Strip the top nav

- In `Shell.tsx`'s `TopBar`: remove the live-pill, search input, and time-window pills. Keep header height + sticky behaviour.
- Add `[Search ⌘K]` and `[+]` affordances on the right.

### Phase 2 — `<CommandPalette>` modal

- Global ⌘K / Ctrl+K keyboard listener at shell level. Esc closes.
- Centered modal ~520px wide. Autofocus input. Results below in sections.
- Arrow keys navigate, Enter executes, Esc closes.
- Both the new top-nav `[Search ⌘K]` button and the existing sidebar "Search ⌘K" pseudo-button open the same palette (shared trigger function).

### Phase 3 — Result sources

- **Dashboards** — fetched from `GET /api/dashboards` (M2). Fuzzy-match name. Show name + color swatch.
- **Actions** — hardcoded `Command[]` registry: *New dashboard*, *Ask Hum*, *Open settings*, *Sign out*, *Toggle theme*.
- **Contextual action** when input has text: `Ask Hum about "<query>"` is always shown at the top.

### Phase 4 — Quick-add `<QuickAddMenu>`

- Top-nav `[+]` button opens a small dropdown ~200px wide.
- Subset of the same `Command[]` registry: *New dashboard*, *Ask Hum*, *New alert via Hum*.
- Same handlers as the palette — implement once, render in two surfaces.

### Phase 5 — Wire to Hum and dashboards

- *Ask Hum about \<query\>* sets `presetQuestion` on the M3 `<HumPanel>` and opens it.
- *New dashboard* routes to the dashboard creation flow (M2).
- *New alert via Hum* opens M3 with a preset prompt to start alert authoring (M1).

## Dependencies

- Requires M2 (dashboards as a search source) and M3 (Hum as an action target).
- Light dependency on M1 (the "New alert via Hum" path needs alerts to exist).

## Notes

- The palette and the `+` menu are two surfaces over the same command registry. Treat them as one feature, not two.
