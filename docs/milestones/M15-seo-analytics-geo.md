# M15 — SEO, Analytics & AI Search Optimization

Establish a full technical-SEO foundation for the public marketing site, wire **Google Analytics 4** behind a privacy-compliant **consent banner** (Google Consent Mode v2), optimize the site for **AI / answer engines (GEO/AEO)**, and add an **MDX-based blog / content engine** to drive organic growth. Marketing-only — no changes to the authed `application`, `core`, or the DynamoDB layer.

## Locked decisions

- **Scope = `packages/marketing` only.** No DB, no Clerk, no `core`. SEO/analytics never reach into the application or the data pipeline.
- **Analytics = Google Analytics 4** (gtag.js) loaded **only after opt-in** via a first-party consent banner using **Consent Mode v2** (default-deny). Measurement ID supplied as `NEXT_PUBLIC_GA_MEASUREMENT_ID`.
- **Consent = a lightweight first-party banner** (no third-party CMP). Default-deny for `analytics_storage` / `ad_storage`; choice persisted in a first-party cookie/localStorage; GA boots and Consent Mode upgrades only on accept. Privacy-policy copy stays consistent with M12.
- **Google Search Console verification** via Next.js `metadata.verification.google` (free, cookieless) — the essential SEO-measurement tool that pairs with GA4 and lets us submit the sitemap and monitor indexing/queries.
- **Canonical absolute URLs** via `metadataBase` derived from the production apex (`WEB_DOMAIN`). **Indexing is production-only:** on any non-production stage (`pr-<N>`) `robots` emits `Disallow: /` and canonicals/sitemap suppress, so previews are never indexed (no duplicate-content penalty). Gate with the existing `$app.stage === "production"` / `isProd` pattern.
- **Dynamic OG images** via `next/og` `ImageResponse` — a branded template, per-page and per-post.
- **Blog = file-based MDX** under `content/blog/*.mdx` (frontmatter-driven), rendered with the existing `react-markdown` / `remark-gfm` stack (or `next-mdx-remote`). No CMS. Each post gets `BlogPosting` JSON-LD + an OG image + a sitemap entry + RSS.
- **AI search (GEO/AEO):** publish `llms.txt`, explicitly allow reputable AI crawlers (GPTBot, ClaudeBot, PerplexityBot, Google-Extended, …) on production, and structure copy answer-first with rich JSON-LD so answer engines can extract and cite the site.

## Config / infra additions

```ts
// infra/secrets.ts — new sst.Secret entries (seed REAL values in BOTH Console
// environments: production + the fallback env used by pr-<N> stages). No empty fallbacks.
NEXT_PUBLIC_GA_MEASUREMENT_ID   // GA4 "G-XXXXXXXX" — public, wired into marketing `environment`
GOOGLE_SITE_VERIFICATION        // Search Console token (server-rendered <meta> via metadata.verification)

// infra/marketing.ts — wire both into the marketing Next app `environment`.
// No DynamoDB changes: no new table, keys, or GSI. No core/application changes.
```

## Phases

### Phase 1 — Technical SEO foundation (L)

- Central SEO helper (`lib/seo.ts`): `metadataBase` from the production domain, default title template (`%s · TokenBuzz`), description, keywords, canonical, and stage-aware `robots` directives.
- Per-page `metadata` / `generateMetadata` for **every** route (home — currently none; changelog; contact; coming-soon — currently missing a description).
- `app/robots.ts` — production allows crawl + references the sitemap; every non-production stage emits `Disallow: /`.
- `app/sitemap.ts` — enumerate static routes (blog posts join in Phase 6) with `lastModified`/`priority`; production domain only.
- Icons/manifest: `app/icon`/`favicon`, `app/apple-icon`, `app/manifest.ts` (name, theme color, PWA-lite).
- **Unit tests** for the SEO helper (canonical + robots logic by stage).

### Phase 2 — Structured data (JSON-LD) (M)

- Reusable `<JsonLd>` component + typed builders in `lib/structured-data.ts`.
- `Organization` + `WebSite` in the root layout.
- `FAQPage` generated from the **existing** `_components/FAQ.tsx` data (single source of truth — it's already structured).
- `SoftwareApplication` / `Product` for the app offering; `BreadcrumbList` on subpages.
- **Unit tests** asserting valid JSON-LD shapes.

### Phase 3 — Open Graph & dynamic social images (M)

- Branded `app/opengraph-image.tsx` (+ `twitter-image.tsx`) via `next/og` `ImageResponse`.
- Per-route OG (changelog, contact) and per-post OG (Phase 6).
- Complete `openGraph` + `twitter` (`summary_large_image`) metadata across all pages.
- Verify previews render (Open Graph debuggers / local capture).

### Phase 4 — Google Analytics 4 + consent + conversion tracking (L)

- `NEXT_PUBLIC_GA_MEASUREMENT_ID` secret + `infra/marketing.ts` wiring; load GA via `@next/third-parties` (or hand-rolled gtag) with **Consent Mode v2 default-deny**.
- First-party **consent banner** (accept / reject / manage), persisted choice, Consent Mode `update` on accept; GA only loads & sends after opt-in.
- Conversion + engagement events: primary CTA → signup, contact-form submit, outbound app clicks; **UTM capture/persistence** carried into the signup deep-link.
- **Google Search Console** verification via `metadata.verification.google`; submit the sitemap.
- **Unit tests** for the consent state machine + event helpers; **browser test** that GA does not fire pre-consent and does fire post-accept.

### Phase 5 — AI search optimization (GEO/AEO) (M)

- Publish `llms.txt` summarizing the product, key pages, and canonical descriptions for LLM/answer engines.
- robots policy for reputable AI crawlers (GPTBot, ClaudeBot, PerplexityBot, Google-Extended, …) — allow on production, documented per bot.
- Answer-first content: concise factual summaries, Q&A blocks, a definitive "what is TokenBuzz" statement answer engines can cite; enrich JSON-LD (FAQ/HowTo/Definition) for extractability.
- Confirm all key content is SSR/HTML-first (no client-only critical content) so crawlers and agents see it.

### Phase 6 — Blog / content engine (L)

- MDX content under `content/blog/*.mdx` with frontmatter (title, description, date, author, tags, ogImage).
- `/blog` listing + `/blog/[slug]` detail (replaces the footer's `/blog` → `/coming-soon` stub).
- Per-post metadata + canonical + `BlogPosting`/`Article` JSON-LD + dynamic OG image + breadcrumbs.
- Posts feed `sitemap.ts`; add an `app/blog/rss.xml` (or `feed.xml`) RSS route.
- Seed 1–2 launch posts. **Unit tests** for frontmatter parsing/slug + sitemap inclusion.

### Phase 7 — Core Web Vitals & marketing polish (M)

- Audit LCP/CLS/INP (Lighthouse); image optimization (`next/image`, explicit sizing, `priority` on hero), font loading (`next/font`, `display: swap`), `preconnect`.
- `next.config.ts`: SEO/security headers, needed redirects (www→apex, trailing-slash policy), compression.
- Optional digital-marketing lever: newsletter / lead-capture hook (spin out to a follow-up if it grows).
- Re-run Lighthouse; target a 95+ SEO score and green Core Web Vitals.

## Dependencies

- **Marketing-only**, independent of the data pipeline — can run in parallel with other milestones.
- Touches the same marketing app as **M7** (live ticker): coordinate on `infra/marketing.ts` env wiring and the root `layout.tsx`.
- The consent banner / privacy copy intersects **M12** (Security & Compliance) — keep them consistent.

## Risks / open questions

- **Preview-stage indexing** — hard-guard canonicals + robots so only `production` is indexable; a leaked `pr-<N>` index causes duplicate-content penalties. Gate via `isProd`.
- **GA + consent correctness** — Consent Mode v2 must default-deny and upgrade only on opt-in; verify **no cookies are set pre-consent** (compliance-critical).
- **OG image runtime** — `next/og` runs on the edge; ensure fonts/assets bundle and image routes are cached.
- **AI-crawler policy is a product/legal choice** — allowing GPTBot et al. trades content exposure for citations; confirm the desired stance per bot before shipping Phase 5.
- **Blog scope creep** — keep the engine minimal (file-based MDX, no CMS/editor); a CMS is a separate milestone if ever needed.
- **`next@latest` pin** — marketing tracks `next@latest`; confirm the installed major (Metadata API, `next/og`, `@next/third-parties`) before implementing.
