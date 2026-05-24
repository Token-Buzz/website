# M1.5 Phase 5 — cross-breakpoint QA pass

Captured 2026-05-24 in a real browser, signed in via the Clerk dev instance against a local dynalite seeded with sample tokens / a watchlist / tracked queries. Every authed route plus the public/auth pages were swept at **phone 390×844, tablet 768×1024, desktop 1280×800**; each phone shot was asserted for no horizontal overflow (`scrollWidth <= innerWidth`). Verdict: **PASS** after the two stragglers below were fixed.

## Stragglers found and fixed in this phase

- **Auth pages 5px overflow @ 390px** (`/sign-in`, `/sign-up`, `/`): the `.tb-stage` grid's implicit track sized to the provider buttons' max-content. Fixed in `app/_auth/auth.css` with `grid-template-columns: minmax(0, 1fr)`. Now 390/390; `/forgot-password` and tablet/desktop unaffected.
- **`TokenDetailPane` clipping @ 390px**: the 4-col stat strip clipped the Sentiment column and the `1fr 240px` chart+dial grid overflowed. On mobile the strip is now 2×2, the chart+dial stack, and the header buttons are icon-only. Applies to both the standalone `/watchlist/<sym>` page and the slide-over overlay.

## Screenshots

`<route>-<breakpoint>.png` — phone for every route, plus tablet/desktop for the data-dense/interactive routes and a desktop sanity shot for the rest. Notable:

- `watchlist-detail-phone.png` — standalone detail: 2×2 stat strip, chart + dial stacked, all visible.
- `watchlist-detail-overlay-phone.png` — same pane as the slide-over opened from `/watchlist`.
- `sign-in-phone.png` / `sign-up-phone.png` / `root-phone.png` — auth pages, no overflow.
- `drawer-open-phone.png` — the mobile nav drawer (focus-trapped; `inert` when closed).
