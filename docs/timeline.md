# Roadmap & Time Estimates

Effort estimates and a calendar timeline for every milestone / phase, driving the GitHub Project
**Roadmap view** (`Start date → Target date` fields). Generated 2026-05-24.

## Assumptions

- **All code is written by AI.** Estimates are **your hours** — briefing AI, reviewing PRs, testing
  live, and merging — not AI wall-clock (which overlaps your review of other phases).
- **Your capacity: 44h/week** = 4h × 5 weekdays + 12h × 2 weekend days.
- **Sequence: fastest path to a sellable v1**, respecting dependencies:
  finish M1 → M2 → M3 → M6 → M5 → M4 → M8 → M7 → M9.
- Dates below are **nominal full-capacity** (assume you hit your hours every day). A realistic ~30%
  buffer for review slippage and integration unknowns (Stripe SCA, Birdeye, Telegram bans) pushes the
  all-done date to **early–mid July 2026**.

## Sizing key

| Size | Your hours | Typical phase |
| --- | --- | --- |
| XS | 1h | strip nav, preset prompts, empty/error states, cost-counter |
| S | 2h | simple page/component, one small API, wiring |
| M | 3–4h | standard CRUD + UI page, one integration, moderate live testing |
| L | 5–7h | drag-drop editor, streaming AI, Stripe Elements, candle chart, an ingestor |
| XL | 9h | foundational/risky: stream-fed data layer, Telegram MTProto ingestor |

## Milestone summary

| Milestone | Your hours | Nominal window |
| --- | --- | --- |
| M1 — Movers / Live feed / Alerts (remaining) | 11 | 05-26 → 05-28 |
| M2 — Watchlists → Dashboards | 21 | 05-29 → 05-31 |
| M3 — Hum AI slide-out | 20 | 05-31 → 06-04 |
| M6 — Candlestick + Price Charts | 23 | 06-04 → 06-07 |
| M5 — Account / Billing / Stripe | 31 | 06-07 → 06-13 |
| M4 — Top nav + ⌘K palette | 11 | 06-13 → 06-14 |
| M8 — Query History | 17 | 06-14 → 06-16 |
| M7 — Marketing live ticker | 10 | 06-16 → 06-19 |
| M9 — Multi-Social Ingestion (v2) | 34 | 06-19 → 06-23 |
| **Total remaining** (+ 5h loose) | **~183** | **05-25 → 06-23** |

Already shipped: M1 P2/P3 (Movers + Live feed UI), M1.5 P1–P4 (mobile responsive). M1.5 P5 (QA) pending.

## Per-phase schedule

Loose (no milestone):

| # | Item | Size | Hrs | Start | Target |
| - | - | - | - | - | - |
| 97 | Bug: API Errors | M | 3 | 05-25 | 05-25 |
| 96 | Cleanup Repo | S | 2 | 05-25 | 05-26 |
| 87 | M1.5 P5 — Cross-breakpoint QA pass | S | 2 | 05-25 | 05-26 |

M1 — Movers / Live feed / Alerts:

| # | Item | Size | Hrs | Start | Target |
| - | - | - | - | - | - |
| 19 | P1 Data layer (alert keys + stream handler + alert CRUD) | L | 5 | 05-26 | 05-27 |
| 22 | P4 Alerts UI + rule plumbing | L | 6 | 05-27 | 05-28 |

M2 — Watchlists → Dashboards:

| # | Item | Size | Hrs | Start | Target |
| - | - | - | - | - | - |
| 24 | P1 Dashboard CRUD + listing | M | 4 | 05-29 | 05-29 |
| 25 | P2 Dashboard view + card rendering | L | 6 | 05-30 | 05-30 |
| 26 | P3 Drag-and-drop layout editor | L | 6 | 05-30 | 05-30 |
| 27 | P4 Card `...` menu | S | 2 | 05-31 | 05-31 |
| 28 | P5 Promote-from-Analytics flow | M | 3 | 05-31 | 05-31 |

M3 — Hum AI slide-out:

| # | Item | Size | Hrs | Start | Target |
| - | - | - | - | - | - |
| 30 | P1 Slide-out shell + conversation persistence | M | 4 | 05-31 | 05-31 |
| 31 | P2 Anthropic SDK + streaming | L | 6 | 06-01 | 06-01 |
| 32 | P3 Drag-in context | M | 4 | 06-02 | 06-02 |
| 33 | P4 Conversation list + history sidebar | M | 3 | 06-03 | 06-03 |
| 34 | P5 Quota integration (stub until M5) | S | 2 | 06-03 | 06-03 |
| 35 | P6 Preset prompts | XS | 1 | 06-04 | 06-04 |

M6 — Candlestick + Price Charts:

| # | Item | Size | Hrs | Start | Target |
| - | - | - | - | - | - |
| 52 | P1 Birdeye provider + cache-through API | L | 6 | 06-04 | 06-05 |
| 53 | P2 CandleChart component | M | 4 | 06-06 | 06-06 |
| 54 | P3 Basic indicators | S | 2 | 06-06 | 06-06 |
| 55 | P4 Social overlays (the differentiator) | L | 6 | 06-06 | 06-06 |
| 56 | P5 Wire into the app | M | 3 | 06-07 | 06-07 |
| 57 | P6 Cost guardrails | S | 2 | 06-07 | 06-07 |

M5 — Account / Billing / Stripe:

| # | Item | Size | Hrs | Start | Target |
| - | - | - | - | - | - |
| 43 | P1 Stripe setup + tier config | M | 3 | 06-07 | 06-07 |
| 44 | P2 Plan record + entitlement core | M | 4 | 06-07 | 06-07 |
| 45 | P3 Stripe webhook handler | L | 5 | 06-08 | 06-08 |
| 46 | P4 Custom upgrade UI w/ Stripe Elements | L | 7 | 06-09 | 06-10 |
| 47 | P5 Account page rebuild | M | 4 | 06-10 | 06-11 |
| 48 | P6 Entitlement enforcement | M | 3 | 06-11 | 06-12 |
| 49 | P7 Marketing site refresh | S | 2 | 06-12 | 06-12 |
| 50 | P8 Dunning + grace period | M | 3 | 06-13 | 06-13 |

M4 — Top nav + ⌘K palette:

| # | Item | Size | Hrs | Start | Target |
| - | - | - | - | - | - |
| 37 | P1 Strip the top nav | XS | 1 | 06-13 | 06-13 |
| 38 | P2 CommandPalette modal | M | 4 | 06-13 | 06-13 |
| 39 | P3 Result sources | S | 2 | 06-13 | 06-13 |
| 40 | P4 Quick-add menu | S | 2 | 06-13 | 06-13 |
| 41 | P5 Wire to Hum and dashboards | S | 2 | 06-14 | 06-14 |

M8 — Query History:

| # | Item | Size | Hrs | Start | Target |
| - | - | - | - | - | - |
| 65 | P1 SavedQuery write hook | M | 3 | 06-14 | 06-14 |
| 66 | P2 History page + sidebar entry | M | 3 | 06-14 | 06-14 |
| 67 | P3 Snapshot detail view | M | 4 | 06-14 | 06-14 |
| 68 | P4 Inline recent-queries drawer | S | 2 | 06-15 | 06-15 |
| 69 | P5 Pin to dashboard | M | 3 | 06-15 | 06-16 |
| 70 | P6 Retention enforcement | S | 2 | 06-16 | 06-16 |

M7 — Marketing live ticker:

| # | Item | Size | Hrs | Start | Target |
| - | - | - | - | - | - |
| 59 | P1 Snapshot Lambda + S3 bucket | M | 4 | 06-16 | 06-17 |
| 60 | P2 LiveTicker reads snapshot | S | 2 | 06-17 | 06-18 |
| 61 | P3 Click handler → signup deep-link | S | 2 | 06-18 | 06-18 |
| 62 | P4 Empty / error states | XS | 1 | 06-18 | 06-18 |
| 63 | P5 Cost guardrails | XS | 1 | 06-19 | 06-19 |

M9 — Multi-Social Ingestion (v2):

| # | Item | Size | Hrs | Start | Target |
| - | - | - | - | - | - |
| 72 | P1 Source-agnostic query layer | L | 6 | 06-19 | 06-20 |
| 73 | P2 Farcaster ingestor | M | 4 | 06-20 | 06-20 |
| 74 | P3 Reddit ingestor | L | 5 | 06-20 | 06-20 |
| 75 | P4 Telegram ingestor (MTProto, ops-heavy) | XL | 9 | 06-21 | 06-21 |
| 76 | P5 Discord ingestor | L | 6 | 06-21 | 06-22 |
| 77 | P6 UI source filter chips + per-source quotas | M | 3 | 06-22 | 06-23 |
| 78 | P7 TikTok / IG / FB (deferred/skipped) | XS | 1 | 06-23 | 06-23 |

## Notes

- Estimates are per-phase. The board's `Estimate` field holds the hour value; `Size` holds the
  t-shirt; **`Roadmap Start` / `Roadmap Target`** (custom date fields) drive the Roadmap view; epics
  carry the rolled-up totals.
- These two custom date fields exist because GitHub's *native* `Start date` / `Target date` planning
  fields can't be written by the automation token (they require issue-field scopes the PAT lacks),
  whereas custom project date fields can.
- To see the timeline: open the Project → switch the view layout to **Roadmap**, and set its date
  fields to **Roadmap Start** (start) and **Roadmap Target** (end).
- Re-running the sequence with a 1.3× buffer is a one-line change if you want the dates to reflect
  realistic slippage rather than full-capacity throughput.
