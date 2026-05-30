# Query API

The query endpoint triggers ingestion of social posts from one or more configured sources and returns ingestion statistics — it is the entry point for populating TokenBuzz's analytics data.

> **Auth note:** The hosted app route (`POST /api/query` at `app.tokenbuzz.app`) uses **Clerk** session authentication and a per-user quota gate. The `api-caller` service also exposes `POST /api/query` and `GET /api/query` (see below) using **Auth0** authentication. The parameter contracts differ between the two surfaces — this page documents both, clearly labelled.

---

## Hosted app — `POST /api/query`

**Base URL:** `https://app.tokenbuzz.app`

### Purpose

Triggers a fan-out ingestion across one or more social sources (Twitter/X, Reddit, Telegram, Discord, etc.) using the caller's BYOK credentials, records ingestion usage against the caller's quota, and returns the count of newly ingested posts.

### Authentication

Clerk session bearer token. See [Authentication](./authentication.md).

### Request

```http
POST /api/query
Content-Type: application/json
Authorization: Bearer <clerk-session-token>
```

#### Request body

| Field | Type | Required | Description |
|---|---|---|---|
| `query` | string | Yes | Search term or token symbol (e.g. `"$SOL"`, `"pepe"`) |
| `sources` | string[] | No | Array of source IDs to ingest from. Defaults to `["twitter"]`. Supported values depend on your plan and configured BYOK keys. |
| `maxPages` | number | No | Maximum pages to fetch from the upstream API. Clamped to `[1, 10]`. Defaults to `5`. |

#### Allowed `sources` values

| Value | Provider | BYOK required |
|---|---|---|
| `"twitter"` | X / Twitter (via twitterapi.io) | Yes |
| `"reddit"` | Reddit | Yes |
| `"telegram"` | Telegram (GramJS) | Yes |

Other values are rejected with `400 unsupported_source`. A source that exists but is not available on your plan returns `403 source_locked`.

#### Example request

```bash
curl -X POST https://app.tokenbuzz.app/api/query \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <clerk-session-token>" \
  -d '{
    "query": "$SOL",
    "sources": ["twitter"],
    "maxPages": 3
  }'
```

### Response

#### Single-source success — `200 OK`

```json
{
  "ingested": 87,
  "query": "$SOL",
  "bySource": {
    "twitter": 87
  }
}
```

| Field | Type | Description |
|---|---|---|
| `ingested` | number | Total posts newly ingested across all sources |
| `query` | string | The query string that was searched |
| `bySource` | object | Per-source ingestion counts |

#### Multi-source success — `200 OK`

When `sources` contains more than one value, partial failures are returned inline rather than as HTTP error codes:

```json
{
  "ingested": 142,
  "query": "$SOL",
  "bySource": {
    "twitter": 87,
    "reddit": 55
  },
  "errors": [
    { "source": "telegram", "error": "byok_required", "reason": "missing" }
  ],
  "locked": [],
  "unsupported": []
}
```

#### Error responses

| Status | Body | Condition |
|---|---|---|
| `400` | `{ "error": "query required" }` | Missing or empty `query` field |
| `400` | `{ "error": "unsupported_source", "unsupported": [...] }` | All requested sources are unrecognised |
| `401` | `{ "error": "Unauthorized" }` | No valid Clerk session |
| `402` | `{ "error": "quota_exhausted", "plan": "...", "used": N, "limit": N }` | Monthly ingestion quota reached |
| `403` | `{ "error": "source_locked", "locked": [...], "plan": "..." }` | All requested sources require a higher plan |
| `403` | `{ "error": "byok_required", "reason": "missing" \| "invalid" }` | BYOK credential absent or revoked (single-source path) |
| `429` | `{ "error": "rate limited upstream", "detail": "..." }` | Upstream source rate-limited the request |
| `502` | `{ "error": "<source> ingest failed", "detail": "..." }` | Upstream source returned an unexpected error |

---

## Quota endpoint — `GET /api/query/quota`

Returns the caller's current ingestion quota status without triggering an ingestion.

```http
GET /api/query/quota
Authorization: Bearer <clerk-session-token>
```

**Response — `200 OK`**

```json
{
  "allowed": true,
  "plan": "pro",
  "used": 12,
  "limit": 500
}
```

---

## api-caller service — `GET /api/query` and `POST /api/query`

> This section documents the **api-caller service contract** (Spring Boot / Auth0). The request/response shapes here do not apply to the hosted app routes above.

**External path prefix (Traefik):** `/caller/api/query`

### Purpose

Calls the external `twitterapi.io` advanced search API, ingests all pages into PostgreSQL using `since_id` to fetch only newer tweets on repeated calls, and returns the stored tweets for the query.

### `since_id` behaviour

For each `query`, the service stores the ID of the most recently ingested tweet. On subsequent calls for the same `query`, it appends `since_id:<id>` to the external search so that only tweets newer than the last known ID are fetched. This makes repeated polling efficient without duplicating data.

### Methods and parameters

**`POST /api/query`** — query string in the JSON body.

**`GET /api/query`** — all parameters as query string.

| Parameter | Type | Method | Default | Description |
|---|---|---|---|---|
| `query` | string | Both (body for POST, query param for GET) | — | **Required.** Search term. |
| `limit` | int | Both | `0` | Max tweets to return in the response. `0` = no limit. `postCount` always reflects the full stored total. |
| `externalLimit` | int | GET only | `QUERY_EXTERNAL_LIMIT` env var | Requested cap on external pagination (tweet-count terms). Capped to `QUERY_EXTERNAL_LIMIT` if exceeded. Ignored when `isIngestor=true`. |
| `isIngestor` | boolean | Both | `false` | When `true`, uses the server's default pagination safety cap regardless of `externalLimit`. Intended for automated ingestion jobs. |

#### `QUERY_EXTERNAL_LIMIT` cap behaviour

| `QUERY_EXTERNAL_LIMIT` | `externalLimit` provided | Effective cap |
|---|---|---|
| `0` (default) | Not provided | Server default pagination safety cap |
| `0` | Provided | Lower of provided value and server default |
| `N > 0` | Not provided | `N` |
| `N > 0` | Provided < N | Provided value |
| `N > 0` | Provided > N | Capped to `N` |

#### Ingestor mode (`isIngestor=true`)

When `isIngestor=true`, the service:

- Still calls the external API (it does **not** skip ingestion).
- Ignores `externalLimit` and applies its own default pagination safety cap.
- Persists/updates authors in the `author` table.
- Extracts author bio URLs into `author_bio_url`.
- Submits a deduplicated author set for asynchronous GeoNames location normalisation.

### Request examples

```bash
# POST (body)
curl -X POST https://<api-caller-host>/caller/api/query \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <auth0-token>" \
  -d '{ "query": "ai" }'

# GET with pagination cap and response limit
curl "https://<api-caller-host>/caller/api/query?query=ai&externalLimit=200&limit=100" \
  -H "Authorization: Bearer <auth0-token>"

# Ingestor mode
curl "https://<api-caller-host>/caller/api/query?query=ai&isIngestor=true" \
  -H "Authorization: Bearer <auth0-token>"
```

### Success response — `200 OK`

```json
{
  "tweets": [
    {
      "id": "1234567890",
      "type": "tweet",
      "url": "https://twitter.com/someuser/status/1234567890",
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
        "profilePicture": "https://pbs.twimg.com/...",
        "coverPicture": "https://pbs.twimg.com/...",
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

| Field | Type | Description |
|---|---|---|
| `tweets` | array | Tweets from the local DB after ingestion. If `limit > 0`, returns at most `limit` items ordered by most recent `createdAt`. |
| `postCount` | number | Total tweets stored for this query in the DB (unaffected by `limit`). |
| `has_next_page` | boolean | Whether additional pages exist in the external API response. |
| `next_cursor` | string \| null | Cursor for the next page if `has_next_page` is `true`. |

### Error responses

| Status | Body | Condition |
|---|---|---|
| `400` | `{ "error": 123, "message": "..." }` | Upstream `twitterapi.io` returned a 400 |
| `402` | `{ "error": 402, "message": "External API credits are not enough. Please recharge." }` | Upstream API credits exhausted |
| `401` | `{ "error": "unauthorized" }` | Missing or invalid Auth0 token / internal key |

---

## `POST /api/tweets/by-ids` (api-caller service)

Fetch stored tweets by their IDs from the local PostgreSQL database. Does **not** call the external API.

```http
POST /caller/api/tweets/by-ids
Content-Type: application/json
Authorization: Bearer <auth0-token>
```

```json
{
  "tweetIds": ["1234567890", "9876543210"]
}
```
