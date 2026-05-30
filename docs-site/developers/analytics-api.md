# Analytics API

The `/api/analytics/*` family of endpoints returns pre-computed statistics over ingested social-media data — hashtag frequency, mentions, engagement trends, geographic distribution, sentiment, and more.

> **Auth note:** The hosted app analytics routes at `app.tokenbuzz.app/api/analytics/*` are protected by **Clerk** session authentication and read from **DynamoDB** aggregates. The `api-caller` service exposes a parallel set of analytics endpoints (also at `/api/analytics/*`, externally under `/caller/api/analytics/*`) protected by **Auth0** and backed by **PostgreSQL**. The two surfaces share the same URL path shapes and similar parameter names, but their underlying data stores and auth mechanisms differ — that distinction is noted per section below.

---

## Common parameters (hosted app routes)

All hosted analytics endpoints (`app.tokenbuzz.app`) are `GET` requests that accept these query parameters:

| Parameter | Type | Required | Description |
|---|---|---|---|
| `query` | string | Yes | The search term / token symbol that was previously ingested (e.g. `$SOL`, `pepe`). |
| `window` | string | No | Time window over which to compute the aggregate. One of `1H`, `4H`, `24H`, `7D`. Defaults to `24H`. |

All endpoints return `401 Unauthorized` when the Clerk session is missing.

## Common parameters (api-caller service contract)

All `api-caller` analytics endpoints accept these query parameters:

| Parameter | Type | Required | Description |
|---|---|---|---|
| `query` | string | Yes | Matches `Tweet.query` in the PostgreSQL database. |
| `from` | ISO 8601 datetime | No | Inclusive lower bound on `Tweet.createdAt`. Example: `2025-01-01T00:00:00Z`. |
| `to` | ISO 8601 datetime | No | Exclusive upper bound on `Tweet.createdAt`. |
| `limit` | int | Varies | Maximum results to return (default `10` unless specified). |

If `from` and `to` are both omitted, the analytics run over all stored data for that query.

---

## Endpoint catalog

### Hosted app routes (`app.tokenbuzz.app/api/analytics/*`)

These endpoints read from DynamoDB aggregates populated at ingest time.

| Endpoint | Description | Extra parameters |
|---|---|---|
| `GET /api/analytics/hashtags` | Top hashtags used in tweets for a query/window | — |
| `GET /api/analytics/mentions` | Most-mentioned usernames for a query/window | — |
| `GET /api/analytics/keywords` | Top extracted keywords for a query/window (up to 50) | — |
| `GET /api/analytics/engagement-timeseries` | Engagement metrics (likes, retweets, replies, quotes) bucketed by hour | — |
| `GET /api/analytics/sentiment` | Per-symbol bullish/neutral/bearish counts and average sentiment score for top tracked tokens | No `query` or `window`; uses top tracked tokens automatically |
| `GET /api/analytics/sentiment-aggregation` | Aggregate positive/neutral/negative counts and average score | — |
| `GET /api/analytics/sentiment-by-query` | Sentiment breakdown scoped to a specific query | — |
| `GET /api/analytics/geographic` | Tweet counts by author country (top 50 countries, up to 2 000 tweets sampled) | — |
| `GET /api/analytics/bio-domains` | Top domains from author bio URLs | — |
| `GET /api/analytics/hashtag-pairs` | Co-occurring hashtag pairs for a query/window | `minCount` |
| `GET /api/analytics/domains` | Top URL domains from tweet link entities | — |
| `GET /api/analytics/language-distribution` | Language distribution for a query/window | — |
| `GET /api/analytics/source-distribution` | Posting-app distribution for a query/window | — |
| `GET /api/analytics/verification-breakdown` | Verified vs unverified author breakdown | — |
| `GET /api/analytics/bot-ratio` | Automated vs non-automated author ratio | — |
| `GET /api/analytics/posting-heatmap` | Day-of-week × hour-of-day heatmap | — |
| `GET /api/analytics/content-length-engagement` | Content length vs engagement correlation | — |
| `GET /api/analytics/author-influence` | Per-author engagement rate and tweet count | — |
| `GET /api/analytics/conversation-threads` | Thread stats (root tweet, participants, reply counts) | — |
| `GET /api/analytics/kpis` | High-level KPI summary for a query/window | — |
| `GET /api/analytics/pulse` | Real-time pulse / volume signal for a query | — |
| `GET /api/analytics/summary` | Narrative summary for a query/window | — |
| `GET /api/analytics/spikes` | Spike detection over the engagement timeseries | — |

### api-caller service contract (`/caller/api/analytics/*`)

These endpoints read from PostgreSQL and are authenticated with Auth0. They are the authoritative backend data source.

| Endpoint | Description | Extra parameters |
|---|---|---|
| `GET /api/analytics/hashtags` | Top hashtags for a query/time window | `limit` (default `10`) |
| `GET /api/analytics/domains` | Top URL domains for a query/time window | `limit` (default `10`) |
| `GET /api/analytics/mentions` | Most-mentioned usernames for a query/time window | `limit` (default `10`) |
| `GET /api/analytics/hashtag-pairs` | Co-occurring hashtag pairs ordered by frequency | `minCount` (default `2`) |
| `GET /api/analytics/bio-domains` | Top domains from author bio profile links | `limit` (default `10`) |
| `GET /api/analytics/mint-count` | Count of tweets stored for a query (optionally date-bounded) | `from`, `to` (see below) |
| `GET /api/analytics/sentiment` | Per-tweet sentiment and associated keywords | — |
| `GET /api/analytics/sentiment-aggregation` | Aggregate positive/neutral/negative counts and average score | — |
| `GET /api/analytics/keywords` | Top extracted keywords | — |
| `GET /api/analytics/follower-history` | Time series of follower/following counts for an `authorId` | `authorId` (required) |
| `GET /api/analytics/engagement-timeseries` | Engagement grouped by granularity (`hour`, `day`, `week`, `month`) | `granularity` |
| `GET /api/analytics/engagement-decay` | Per-tweet engagement snapshots over time (decay curves) | — |
| `GET /api/analytics/conversation-threads` | Thread stats for root tweets matching a query | — |
| `GET /api/analytics/geographic` | Tweet counts by normalised author location with lat/lon | — |
| `GET /api/analytics/language-distribution` | Language distribution | — |
| `GET /api/analytics/source-distribution` | Posting-app distribution | — |
| `GET /api/analytics/verification-breakdown` | Author verification breakdown | — |
| `GET /api/analytics/bot-ratio` | Automated vs non-automated author ratio | — |
| `GET /api/analytics/posting-heatmap` | Day-of-week × hour-of-day heatmap | — |
| `GET /api/analytics/content-length-engagement` | Content length vs engagement | — |
| `GET /api/analytics/author-influence` | Author engagement rate and tweet count | — |

For complete parameter lists and response shapes for the api-caller endpoints, enable Swagger via `SPRINGDOC_SWAGGER_UI_ENABLED=true` or refer to `docs/openapi.yaml` in the service repository.

---

## Worked example — top hashtags (hosted app)

**Request**

```bash
curl "https://app.tokenbuzz.app/api/analytics/hashtags?query=%24SOL&window=24H" \
  -H "Authorization: Bearer <clerk-session-token>"
```

**Response — `200 OK`**

```json
[
  { "hashtag": "solana", "count": 312 },
  { "hashtag": "crypto", "count": 198 },
  { "hashtag": "defi", "count": 145 },
  { "hashtag": "web3", "count": 87 }
]
```

Each item in the array represents one hashtag (case-normalised) and its occurrence count within the requested window.

---

## Worked example — top hashtags (api-caller service contract)

**Request**

```bash
curl "https://<api-caller-host>/caller/api/analytics/hashtags?query=ai&from=2025-01-01T00:00:00Z&to=2025-01-31T23:59:59Z&limit=5" \
  -H "Authorization: Bearer <auth0-token>"
```

**Response — `200 OK`**

```json
[
  { "hashtag": "AI", "usageCount": 123 },
  { "hashtag": "MachineLearning", "usageCount": 98 },
  { "hashtag": "DataScience", "usageCount": 76 },
  { "hashtag": "LLM", "usageCount": 54 },
  { "hashtag": "ChatGPT", "usageCount": 41 }
]
```

Note that the hosted app response uses `count` while the api-caller service uses `usageCount` — the two surfaces have independent response shapes.

---

## `mint-count` date-filter behaviour (api-caller service)

`GET /api/analytics/mint-count` has special date-filter semantics:

| `from` | `to` | Counts tweets where… |
|---|---|---|
| omitted | omitted | All stored tweets for `query` |
| provided | omitted | `createdAt >= from` |
| omitted | provided | `createdAt < to` |
| provided | provided | `from <= createdAt < to` |

```bash
# All time
curl "/caller/api/analytics/mint-count?query=ai" -H "Authorization: Bearer <token>"
# → 1234

# Bounded window
curl "/caller/api/analytics/mint-count?query=ai&from=2025-01-01T00:00:00Z&to=2025-02-01T00:00:00Z" \
  -H "Authorization: Bearer <token>"
# → 321
```

The response is a plain integer (not a JSON object).
