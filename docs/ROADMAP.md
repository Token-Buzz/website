# TokenBuzz Roadmap

Brainstormed product roadmap for the TokenBuzz application and marketing site. Nine milestones cover the full active scope; two items are intentionally deferred.

## Strategic decisions

- **Positioning:** crypto-only for v1. Expand to broader finance (stocks, FX, commodities) only after the crypto product is proven; expansion will likely require a rebrand. The brand, vocabulary, data providers, and ingestion sources all assume crypto.
- **Schema posture:** crypto-specific data model. Accept a real migration cost later if/when broader-finance expansion happens, rather than carrying generic-`Asset` boilerplate today for a future that may never come.
- **Multi-source data:** per-source tables (one new DDB table per platform), unified only at the source-agnostic `Aggregates` table. No generic `SocialPosts` table.
- **Cost-driven gating:** tier limits meter the things that actually cost money — LLM tokens (Hum) and social-API calls. No artificial caps on dashboards, alerts, or other zero-marginal-cost features.

## Milestones

| # | Title | Phase |
| - | --- | --- |
| M1 | Movers / Live feed / Alerts | v1 |
| M2 | Watchlists → Dashboards | v1 |
| M3 | Hum AI slide-out | v1 |
| M4 | Top nav + ⌘K command palette | v1 |
| M5 | Account / Billing / Stripe | v1 |
| M6 | Candlestick + Price Charts | v1 |
| M7 | Marketing live ticker | v1 |
| M8 | Query History | v1 |
| M9 | Multi-Social Ingestion (v2) | v2 |

See `docs/milestones/M*.md` for the detailed brief on each milestone (locked decisions, schema additions, phases).

## Dependency graph

```
M1 ─┬─► M2 ─┬─► M3 ─► M4
    │       └─► M6 ─► M7
    └─► M8 ─► (loops back to M2)
M5 (orthogonal — entitlement layer touches M3 + M9)
M9 (post-v1; extends M1 ingestion + M5 quotas)
```

- **M1 unblocks everything** — Movers / Live feed / Alerts establishes the ingestion + aggregate read paths that M2, M6, M8, M9 all build on.
- **M2 is the canvas** that M3, M6, and M8 all render into.
- **M5 is orthogonal** — pricing tiers, entitlement enforcement, billing UI. Touches M3 (Hum quota) and M9 (per-source quotas) but can be built in parallel with the feature milestones.

## Deferred items (acknowledged, not lost)

| Item | Status | Reason |
| --- | --- | --- |
| User Flow / Onboarding | Deferred to post-v1 | First-run experience is best designed after M1–M3 ship — you need to know what a new user lands on before designing how they get there. |
| Finance vs Crypto positioning | Decided (crypto-only v1) | See "Strategic decisions" above. |
| Multi-social ingestion (Reddit, IG, FB, TikTok) | Promoted to M9 with a reframed source order | The original ClickUp list reflected general "social media" thinking. For crypto specifically, Telegram and Farcaster are higher-signal than IG/FB/TikTok; IG/FB are skipped and TikTok is deferred indefinitely. |

## Original ClickUp task coverage

This roadmap consolidates and supersedes the 26 tasks created in ClickUp on 2026-05-22 (preserved as subtasks of "OLD TASKS 05-22-2026" in the same list). Every original task maps to one of M1–M9.
