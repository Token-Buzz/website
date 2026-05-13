# api-caller

Spring Boot (Java 21) service that:

- Ingests tweets/posts from the external `twitterapi.io` API into PostgreSQL (using `since_id` when possible so repeated queries only fetch newer results).
- Exposes analytics endpoints over stored tweets/authors.
- Exposes read-only raw-table endpoints for BI/debugging.
- Optionally dispatches tweets to `api-ai` for asynchronous sentiment analysis and stores results.

## Quickstart

### Build / test

- Build (Windows): `./mvnw.cmd clean package`
- Run tests (Windows): `./mvnw.cmd test`

### Run locally

1. Set the required environment variables (see **Configuration**).
2. Run: `./mvnw.cmd spring-boot:run`

To enable Swagger/OpenAPI endpoints (useful for local/dev):

- `SPRINGDOC_API_DOCS_ENABLED=true`
- `SPRINGDOC_SWAGGER_UI_ENABLED=true`

## Configuration

Required environment variables:

- `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` (PostgreSQL)
- `TWITTER_API_KEY` (twitterapi.io)
- `GEONAMES_APP_DB_URL`, `GEONAMES_APP_DB_USERNAME`, `GEONAMES_APP_DB_PASSWORD`

Auth (required when **not** running with Spring profile `dev`):

- `AUTH0_DOMAIN`
- `AUTH0_AUDIENCE`

Optional / advanced:

- `SPRING_PROFILES_ACTIVE=dev` (disables all auth checks; see `DevSecurityConfig`)
- `INTERNAL_API_KEY` (shared key for internal service-to-service auth; enables `X-Internal-API-Key` authentication for all `/api/**` endpoints)
- `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET` (Auth0 M2M credentials)
- `SPRINGDOC_API_DOCS_ENABLED`, `SPRINGDOC_SWAGGER_UI_ENABLED`
- `QUERY_EXTERNAL_LIMIT` (int, default: `0`)
  - Hard cap for the `externalLimit` query parameter on `GET /api/query`.
  - If `externalLimit` exceeds this value, the service caps it to `QUERY_EXTERNAL_LIMIT`.

### Docker

The `Dockerfile` expects a pre-built jar at `target/api-caller.jar`:

- Build jar: `./mvnw.cmd clean package -DskipTests`
- Build image: `docker build -t api-caller:latest .`

## Architecture (high level)

- **REST layer**: Spring MVC controllers under `src/main/java/.../REST/Server` (`ServiceController`, `AnalyticsController`, `AllDataController`, etc.).
- **External ingestion**: `ClientApiService` calls `twitterapi.io` advanced search and follows cursor pagination; `since_id` is appended based on the latest stored tweet ID per query.
- **Persistence**:
  - Primary PostgreSQL datasource via Spring Data JPA (`Tweet`, `Author`, analytics entities).
  - Read-only raw-table endpoints under `/api/data/*` implemented via `JdbcTemplate`.
- **GeoNames**: optional secondary (read-only) JPA datasource enabled when `spring.geonames.datasource.url` is configured (disabled in the `test` profile).
- **Sentiment**: optional async dispatch to `api-ai` (`SentimentDispatchServiceImpl`) and callback endpoints under `/api/internal/sentiment/*`.

---

## 1. Search & Ingestion

### 1.1 `/api/query`

Trigger a search against the external X/Twitter API (`twitterapi.io` advanced_search), ingest all pages into the database, and return tweets from your own DB for the given query.

The service uses `since_id` when possible so that repeated calls for the same `query` only fetch **newer** tweets.

**Method**

- `POST /api/query`
- `GET  /api/query`

**Query parameters**

- `limit` (int, optional, default `0`)
  - Maximum number of tweets to return in the response.
  - `0` means no limit (return all stored tweets for the query).
- `externalLimit` (int, optional; **GET only**)
  - Requested cap for external pagination (in tweet-count terms; used to derive max pages).
  - If omitted, it defaults to `QUERY_EXTERNAL_LIMIT`.
  - If provided and exceeds `QUERY_EXTERNAL_LIMIT`, the service caps it to `QUERY_EXTERNAL_LIMIT`.
  - If `QUERY_EXTERNAL_LIMIT` is `0`, omitting `externalLimit` means “use default pagination safety cap”.
- `isIngestor` (boolean, optional, default `false`)
  - Intended for automated ingestion jobs.
  - When `isIngestor=true`, `externalLimit` is ignored and the service uses its default pagination safety cap.

**POST request body (JSON)**

```json
{
  "query": "ai"
}
```

- `query` (string, required): Search term.

For `GET /api/query`, provide `query` as a query parameter instead of a request body, e.g.:

`GET /api/query?query=ai&externalLimit=200&limit=100`

#### Ingestor mode (`isIngestor`)

`isIngestor=true` is intended for automated ingestion jobs.

- It does **not** skip the external API call.
- It primarily affects how the `limit` parameter is applied to external pagination.
  - For `isIngestor=true`, the service uses its default pagination safety cap.
  - For `isIngestor=false` and `limit >= 20`, the service may cap external pagination based on the requested `limit`.

Processing performed during ingestion includes:

- Authors are persisted/updated in the `author` table.
- Author bio URLs are extracted into `author_bio_url`.
- A deduplicated set of authors from the response is submitted for **asynchronous location normalization** (GeoNames).

**Success response – 200 OK**

```json
{
  "tweets": [
    {
      "id": "1234567890",
      "type": "tweet",
      "url": "https://twitter.com/...",
      "text": "Example tweet text",
      "source": "Twitter for iPhone",
      "retweetCount": "10",
      "replyCount": "2",
      "likeCount": "30",
      "quoteCount": "1",
      "viewCount": "100",
      "bookmarkCount": "0",
      "createdAt": "2025-01-03T12:34:56Z",
      "lang": "en",
      "isReply": false,
      "inReplyToId": null,
      "conversationId": "1234567890",
      "inReplyToUserId": null,
      "inReplyToUsername": null,
      "isLimitedReply": false,
      "author": {
        "userName": "someuser",
        "id": "9999",
        "url": "https://twitter.com/someuser",
        "name": "Some User",
        "isBlueVerified": true,
        "verifiedType": "business",
        "profilePicture": "https://...",
        "coverPicture": "https://...",
        "description": "Bio text",
        "location": "Earth",
        "followers": 1000,
        "following": 100,
        "canDm": true,
        "createdAt": "2020-01-01T00:00:00Z",
        "favouritesCount": 200,
        "hasCustomTimelines": false,
        "isTranslator": false,
        "mediaCount": 50,
        "statusesCount": 2000,
        "possiblySensitive": false,
        "isAutomated": false,
        "automatedBy": null,
        "unavailable": false,
        "message": null,
        "unavailableReason": null
      },
      "query": "ai"
    }
  ],
  "postCount": 42,
  "has_next_page": false,
  "next_cursor": null
}
```

Notes:

- `tweets` are loaded from your DB (after ingesting new pages from the external API).
- `query` on each tweet is the original user query.
- `postCount` is the total number of tweets stored for that query in the database.
- If `limit > 0`, only the first `limit` tweets (by most recent `createdAt`) are returned in `tweets`,
  while `postCount` still reflects the total stored count.
- The service uses `since_id` per query by looking up the latest stored tweet ID for that query and
  appending `since_id:<id>` to the external search query, so repeated calls only fetch new tweets.

**Error response – 400 Bad Request (external API error)**

When the upstream advanced search API returns a 400, the service surfaces:

```json
{
  "error": 123,
  "message": "Upstream error message"
}
```

- Status: `400`

**Error response – 402 Payment Required (external API credits exhausted)**

If the upstream API returns `402 Payment Required`, the service surfaces:

```json
{
  "error": 402,
  "message": "External API credits are not enough. Please recharge."
}
```

- Status: `402`

### 1.2 POST `/api/tweets/by-ids`

Fetch stored tweets by ID from the local database (no external API call).

**Method**

- `POST /api/tweets/by-ids`

**Request body (JSON)**

```json
{
  "tweetIds": ["123", "456"]
}
```

---

## 2. Analytics Endpoints

Analytics endpoints compute statistics over the stored tweet and related tables.

Unless stated otherwise, they read from your **local database** only; they do not call the external API.

Common query parameters:

- `query` – string, required; matches `Tweet.query`.
- `from` – ISO 8601 datetime, optional; inclusive lower bound on `Tweet.createdAt`.
- `to` – ISO 8601 datetime, optional; exclusive upper bound on `Tweet.createdAt`.
  - If `from` and `to` are omitted, the analytics run over **all** stored data for that query.

Date format example: `2025-01-01T00:00:00Z`.

### 2.1 GET `/api/analytics/hashtags`

Return top hashtags used in tweets for a given query and time window.

**Method**

- `GET /api/analytics/hashtags`

**Query parameters**

- `query` (string, required)
- `from` (ISO datetime, optional)
- `to` (ISO datetime, optional)
- `limit` (int, optional, default `10`)

**Example**

`GET /api/analytics/hashtags?query=ai&from=2025-01-01T00:00:00Z&to=2025-01-31T23:59:59Z&limit=20`

or over all time:

`GET /api/analytics/hashtags?query=ai&limit=20`

**Response – 200 OK**

```json
[
  {
    "hashtag": "AI",
    "usageCount": 123
  },
  {
    "hashtag": "MachineLearning",
    "usageCount": 98
  }
]
```

---

### 2.2 GET `/api/analytics/domains`

Return top URL domains (from tweet `entities.urls`) for a query/time window.

**Method**

- `GET /api/analytics/domains`

**Query parameters**

- `query` (string, required)
- `from` (ISO datetime, optional)
- `to` (ISO datetime, optional)
- `limit` (int, optional, default `10`)

**Example**

`GET /api/analytics/domains?query=ai&limit=10`

**Response – 200 OK**

```json
[
  {
    "domain": "example.com",
    "usageCount": 42
  },
  {
    "domain": "github.com",
    "usageCount": 35
  }
]
```

---

### 2.3 GET `/api/analytics/mentions`

Return most-mentioned users (from `entities.user_mentions`) for a query/time window.

**Method**

- `GET /api/analytics/mentions`

**Query parameters**

- `query` (string, required)
- `from` (ISO datetime, optional)
- `to` (ISO datetime, optional)
- `limit` (int, optional, default `10`)

**Example**

`GET /api/analytics/mentions?query=ai&limit=10`

**Response – 200 OK**

```json
[
  {
    "screenName": "openai",
    "mentionCount": 50
  },
  {
    "screenName": "someuser",
    "mentionCount": 27
  }
]
```

---

### 2.4 GET `/api/analytics/hashtag-pairs`

Return pairs of hashtags that co-occur in the same tweet, ordered by frequency.

**Method**

- `GET /api/analytics/hashtag-pairs`

**Query parameters**

- `query` (string, required)
- `from` (ISO datetime, optional)
- `to` (ISO datetime, optional)
- `minCount` (long, optional, default `2`)

**Example**

`GET /api/analytics/hashtag-pairs?query=ai&minCount=5`

**Response – 200 OK**

```json
[
  {
    "hashtagA": "AI",
    "hashtagB": "MachineLearning",
    "pairCount": 30
  },
  {
    "hashtagA": "AI",
    "hashtagB": "DataScience",
    "pairCount": 18
  }
]
```

---

### 2.5 GET `/api/analytics/bio-domains`

Return top domains found in author bios (profile links) for users who have tweets matching the query/time window.

**Method**

- `GET /api/analytics/bio-domains`

**Query parameters**

- `query` (string, required)
- `from` (ISO datetime, optional)
- `to` (ISO datetime, optional)
- `limit` (int, optional, default `10`)

**Example**

`GET /api/analytics/bio-domains?query=ai&limit=10`

**Response – 200 OK**

```json
[
  {
    "domain": "company.com",
    "usageCount": 12
  },
  {
    "domain": "personal-site.net",
    "usageCount": 7
  }
]
```

---

### 2.6 GET `/api/analytics/mint-count`

Return the number of tweets stored for a given query (optionally within a time window).

**Method**

- `GET /api/analytics/mint-count`

**Query parameters**

- `query` (string, required)
- `from` (ISO datetime, optional)
- `to` (ISO datetime, optional)

**Date filter behavior**

- If both `from` and `to` are omitted: counts **all** tweets stored for the given `query`.
- If only `from` is provided: counts tweets where `createdAt >= from`.
- If only `to` is provided: counts tweets where `createdAt < to`.
- If both are provided: counts tweets where `from <= createdAt < to`.

**Examples**

- All time for a query:
  - `GET /api/analytics/mint-count?query=ai`
- Bounded window for a query:
  - `GET /api/analytics/mint-count?query=ai&from=2025-01-01T00:00:00Z&to=2025-01-31T00:00:00Z`

**Response – 200 OK**

```json
1234
```

This indicates there are 1,234 tweets stored for `query = "ai"` (or within the specified date range, if provided).

### 2.7 Additional analytics endpoints (advanced analytics)

The following endpoints are implemented to support richer analytics over stored tweets and authors. They operate purely on the local database and do not call the external API.

- `GET /api/analytics/sentiment` – per-tweet sentiment plus associated keywords for a query/time window.
- `GET /api/analytics/sentiment-aggregation` – aggregate positive/neutral/negative counts and average sentiment score.
- `GET /api/analytics/keywords` – top extracted keywords for a query/time window.
- `GET /api/analytics/follower-history` – time series of follower/following counts for a given `authorId`.
- `GET /api/analytics/engagement-timeseries` – engagement metrics (likes, retweets, replies, quotes, views) grouped by a specified granularity (`hour`, `day`, `week`, `month`).
- `GET /api/analytics/engagement-decay` – per-tweet engagement snapshots over time, suitable for decay curves.
- `GET /api/analytics/conversation-threads` – high-level stats for conversation threads (root tweet, participant usernames, counts).
- `GET /api/analytics/geographic` – aggregated tweet counts by normalized author location (with approximate latitude/longitude).
- `GET /api/analytics/language-distribution` – language distribution for a query/time window.
- `GET /api/analytics/source-distribution` – source/app distribution for a query/time window.
- `GET /api/analytics/verification-breakdown` – verification breakdown for authors contributing to a query/time window.
- `GET /api/analytics/bot-ratio` – automated vs non-automated author ratio for a query/time window.
- `GET /api/analytics/posting-heatmap` – day-of-week x hour-of-day heatmap for a query/time window.
- `GET /api/analytics/content-length-engagement` – content length vs engagement for a query/time window.
- `GET /api/analytics/author-influence` – author influence metrics (engagement rate and tweet count) for a query/time window.

For exact parameter lists and response shapes, see the OpenAPI documentation generated by Springdoc (enable via `SPRINGDOC_API_DOCS_ENABLED` / `SPRINGDOC_SWAGGER_UI_ENABLED`), `docs/openapi.yaml`, or the design document in `AI_CONTEXT/producer-api-prompt.md`.

---

## 3. Data Access Endpoints (`/api/data/...`)

These endpoints provide read-only access to raw tables (for analytics/BI/debugging). They use `JdbcTemplate` under the hood.

All `/api/data/*` endpoints:

- Use `GET`.
- Return an **array of JSON objects**.
- Support optional `columns` and `limit` query parameters.
- Default to **all columns** and **limit = 500** rows when parameters are omitted.

Common query parameters:

- `columns` (string, optional)
  - Comma-separated list of column names to include in the result.
  - Column names must match one of the allowed columns for that table (see below).
  - If omitted or blank, all columns are returned.
- `limit` (integer, optional)
  - Maximum number of rows to return.
  - If omitted or `<= 0`, defaults to `500`.

If you request only invalid columns (none match the allowed set), the API returns `400 Bad Request` with a message listing allowed columns.

### 3.1 `/api/data/author`

Return rows from the `author` table.

**Method**

- `GET /api/data/author`

**Allowed columns**

- `user_name`
- `automated_by`
- `can_dm`
- `cover_picture`
- `created_at`
- `description`
- `favourites_count`
- `followers`
- `following`
- `has_custom_timelines`
- `id`
- `is_automated`
- `is_blue_verified`
- `is_translator`
- `location`
- `media_count`
- `message`
- `name`
- `possibly_sensitive`
- `profile_picture`
- `statuses_count`
- `unavailable`
- `unavailable_reason`
- `url`
- `verified_type`

**Example – all columns, default limit (500)**

`GET /api/data/author`

**Example – specific columns and limit**

`GET /api/data/author?columns=user_name,name,followers&limit=50`

**Response – 200 OK**

```json
[
  {
    "user_name": "someuser",
    "name": "Some User",
    "followers": 1234
  },
  {
    "user_name": "anotheruser",
    "name": "Another User",
    "followers": 567
  }
]
```

---

### 3.2 `/api/data/author_bio_url`

Return rows from the `author_bio_url` table.

**Method**

- `GET /api/data/author_bio_url`

**Allowed columns**

- `id`
- `context`
- `display_url`
- `end_index`
- `expanded_url`
- `start_index`
- `url`
- `author_user_name`

**Example**

`GET /api/data/author_bio_url?columns=author_user_name,display_url,expanded_url&limit=100`

**Response – 200 OK**

```json
[
  {
    "author_user_name": "someuser",
    "display_url": "example.com",
    "expanded_url": "https://example.com/profile"
  }
]
```

---

### 3.3 `/api/data/symbols`

Return rows from the `symbols` table.

**Method**

- `GET /api/data/symbols`

**Allowed columns**

- `mint`
- `bonding_curve_key`
- `created_on`
- `created_at`
- `description`
- `image`
- `initial_buy`
- `market_cap_sol`
- `meta_datajson`
- `name`
- `pool`
- `pumpjson`
- `signature`
- `sol_amount`
- `symbol`
- `telegram`
- `trader_public_key`
- `twitter`
- `tx_type`
- `uri`
- `v_sol_in_bonding_curve`
- `v_tokens_in_bonding_curve`
- `website`
- `mint_tweets`
- `symbol_tweets`

**Example**

`GET /api/data/symbols?columns=mint,symbol,market_cap_sol,sol_amount&limit=50`

**Response – 200 OK**

```json
[
  {
    "mint": "ABCDE...",
    "symbol": "TEST",
    "market_cap_sol": 123.45,
    "sol_amount": 10.5
  }
]
```

---

### 3.3a `/api/symbols/rate`

Return the **rate** of new rows in the `symbols` table over a recent timeframe, based on the `created_at` column.

**Method**

- `GET /api/symbols/rate`

**Query parameters**

- `timeframe` (string, required)
  - One of: `5m`, `15m`, `30m`, `1h`, `4h`, `6h`, `8h`, `12h`, `1d`.
  - Interpreted as a duration before "now". For example, `1h` counts rows with `created_at >= now - 1 hour`.

**Example**

`GET /api/symbols/rate?timeframe=5m`

**Response – 200 OK**

```json
{
  "timeframe": "5m",
  "seconds": 300,
  "count": 42
}
```

If an unsupported timeframe is provided, the endpoint returns `400 Bad Request` with a message listing allowed values.

---

### 3.4 `/api/data/tweet`

Return rows from the `tweet` table.

**Method**

- `GET /api/data/tweet`

**Allowed columns**

- `id`
- `created_at`
- `like_count`
- `query`
- `reply_count`
- `retweet_count`
- `text`
- `url`
- `view_count`
- `author_user_name`
- `bookmark_count`
- `conversation_id`
- `in_reply_to_id`
- `in_reply_to_user_id`
- `in_reply_to_username`
- `is_limited_reply`
- `is_reply`
- `lang`
- `quote_count`
- `source`
- `type`

**Example**

`GET /api/data/tweet?columns=id,query,text,created_at&limit=100`

**Response – 200 OK**

```json
[
  {
    "id": "2008343209152241911",
    "query": "$Atlas",
    "text": "Example tweet text...",
    "created_at": "2025-01-05T20:32:11Z"
  }
]
```

---

### 3.5 `/api/data/tweet_hashtag`

Return rows from the `tweet_hashtag` table.

**Method**

- `GET /api/data/tweet_hashtag`

**Allowed columns**

- `id`
- `end_index`
- `start_index`
- `text`
- `tweet_id`

**Example**

`GET /api/data/tweet_hashtag?columns=tweet_id,text&limit=100`

**Response – 200 OK**

```json
[
  {
    "tweet_id": "2008343209152241911",
    "text": "AIInfrastructure"
  }
]
```

---

### 3.6 `/api/data/tweet_mention`

Return rows from the `tweet_mention` table.

**Method**

- `GET /api/data/tweet_mention`

**Allowed columns**

- `id`
- `id_str`
- `name`
- `screen_name`
- `tweet_id`

**Example**

`GET /api/data/tweet_mention?columns=tweet_id,screen_name&limit=100`

**Response – 200 OK**

```json
[
  {
    "tweet_id": "2008343209152241911",
    "screen_name": "openai"
  }
]
```

---

### 3.7 `/api/data/tweet_query_count`

Return rows from the `tweet_query_count` table.

**Method**

- `GET /api/data/tweet_query_count`

**Allowed columns**

- `id`
- `count`
- `query`
- `timestamp`

**Example**

`GET /api/data/tweet_query_count?columns=query,count,timestamp&limit=50`

**Response – 200 OK**

```json
[
  {
    "query": "$Atlas",
    "count": 186,
    "timestamp": "2025-01-05T20:32:11Z"
  }
]
```

---

### 3.8 `/api/data/tweet_url_entity`

Return rows from the `tweet_url_entity` table.

**Method**

- `GET /api/data/tweet_url_entity`

**Allowed columns**

- `id`
- `display_url`
- `end_index`
- `expanded_url`
- `start_index`
- `url`
- `tweet_id`

**Example**

`GET /api/data/tweet_url_entity?columns=tweet_id,display_url,expanded_url&limit=100`

**Response – 200 OK**

```json
[
  {
    "tweet_id": "2008343209152241911",
    "display_url": "example.com/article",
    "expanded_url": "https://example.com/article?id=123"
  }
]
```

---

## 4. Notes

- All `/api/data/*` and `/api/symbols/rate` endpoints are **read-only**; they do not modify the database.
- Column names are case-insensitive in the query string but must match the listed names.
- When no parameters are provided for `/api/data/*`, each endpoint returns **all columns** and up to **500 rows**.
- If `limit` is provided and positive, that value is used instead of the default.
- The search and analytics endpoints rely on the ingestion flow (`/api/query`) to have populated the underlying tables.

---

## 5. Authentication (Auth0)

In Traefik deployments, external requests are routed through the `/caller` path prefix, e.g.:

- `POST /caller/api/query`
- `POST /caller/api/tweets/by-ids`
- `GET  /caller/api/analytics/...`
- `GET  /caller/api/symbols/rate`
- `GET  /caller/api/data/{endpoint}` (raw tables)

### 5.1 Sentiment integration (api-ai)

This service calls `api-ai` for sentiment analysis and provides a callback endpoint.

Relevant environment variables:

- `API_AI_BASE_URL` (default: `http://api-ai:8080`)
- `SENTIMENT_CALLBACK_BASE_URL` (default: `http://api-caller:8080`)

The sentiment dispatch URL is built as:

- `${API_AI_BASE_URL}/ai/api/sentiment/batch/async`

The callback URL provided to `api-ai` is built as:

- `${SENTIMENT_CALLBACK_BASE_URL}/caller/api/internal/sentiment/results`

Notes:

- External Traefik path prefixes (like `/caller`) are routing concerns and do not change the internal dispatch URL.
- `SENTIMENT_CALLBACK_BASE_URL` must be reachable by `api-ai` (e.g., on the same Docker network use the service DNS name `api-caller`).

### 5.2 Required environment variables

When **not** running with Spring profile `dev`, the service validates JWTs using Auth0:

- `AUTH0_DOMAIN`
  - Example: `your-tenant.us.auth0.com`
  - Also accepted: `https://your-tenant.us.auth0.com/` (the service normalizes both)
- `AUTH0_AUDIENCE`
  - Example: `https://api.your-domain.com/caller`

These variables are wired into Spring via `application.yml`:

- `auth0.domain=${AUTH0_DOMAIN}`
- `auth0.caller.audience=${AUTH0_AUDIENCE}`

### 5.3 JWT validation rules

- JWKS URL is derived from `AUTH0_DOMAIN` (after normalization) as `https://<domain>/.well-known/jwks.json`.
- `iss` must match the normalized issuer (the service ensures `https://` and a single trailing `/`).
- The `aud` claim must contain `AUTH0_AUDIENCE`.
- Only `RS256`-signed tokens are accepted.

### 5.4 Protected paths

- In non-dev profiles: all `/api/**` endpoints (routed externally as `/caller/api/**`) require `Authorization: Bearer <access_token>`.
- Public by default: `/actuator/**`, `/v3/api-docs/**`, `/swagger-ui/**`.
  - By default, only `health` is exposed (`/actuator/health/**`).
- In Spring profile `dev`: all endpoints are permitted (see `DevSecurityConfig`).

### 5.4 Error responses

When auth fails, the service returns small JSON bodies to avoid breaking existing consumers:

- Missing/invalid token:
  - Status: `401 Unauthorized`
  - Body: `{ "error": "unauthorized" }`
- Authenticated but not allowed to perform the action:
  - Status: `403 Forbidden`
  - Body: `{ "error": "forbidden" }`

All successful responses and payload shapes from the existing endpoints remain unchanged.
