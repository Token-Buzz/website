# Developer / API Overview

TokenBuzz exposes two distinct API surfaces — a hosted, Clerk-authenticated set of Next.js route handlers, and a separate Spring Boot ingestion/analytics service (`api-caller`) with its own authentication contract.

## The two API surfaces

### 1. Hosted app routes (Next.js, Clerk auth)

These are the routes served by the TokenBuzz application at `app.tokenbuzz.app`. Every request must carry a valid Clerk session cookie or bearer token — unauthenticated requests receive `401 Unauthorized`.

| Base path | Purpose |
|---|---|
| `POST /api/query` | Trigger multi-source social ingestion and return ingestion stats |
| `GET /api/query/quota` | Return the caller's current ingestion quota status |
| `GET /api/analytics/*` | Query pre-aggregated analytics stored in DynamoDB |

These routes are documented in [Query API](./query-api.md) and [Analytics API](./analytics-api.md).

**Important:** The hosted app routes do **not** use Auth0 JWTs or an `X-Internal-API-Key` header. Those authentication mechanisms belong exclusively to the `api-caller` service described below.

### 2. api-caller service (Spring Boot, Auth0 / internal key auth)

`api-caller` is a Spring Boot (Java 21) ingestion and analytics service that backs the platform. It:

- Ingests tweets and posts from the external `twitterapi.io` API into PostgreSQL.
- Exposes analytics endpoints over stored tweets and authors.
- Exposes read-only raw-table endpoints (`/api/data/*`) for BI and debugging.
- Optionally dispatches tweets to `api-ai` for asynchronous sentiment analysis.

In Traefik deployments, the service is reachable under the `/caller` path prefix:

```
POST   /caller/api/query
GET    /caller/api/query
POST   /caller/api/tweets/by-ids
GET    /caller/api/analytics/<endpoint>
GET    /caller/api/symbols/rate
GET    /caller/api/data/<table>
```

Authentication for this service uses Auth0 JWT bearer tokens or an `X-Internal-API-Key` header — see [Authentication](./authentication.md) for details.

## Content types

All endpoints accept and return `application/json` unless stated otherwise. Requests with a body must set `Content-Type: application/json`.

## Base URLs

| Surface | Base URL |
|---|---|
| Hosted app (production) | `https://app.tokenbuzz.app` |
| Hosted app (PR preview) | `https://pr-<N>.staging.tokenbuzz.app` |
| api-caller service | Deployment-specific; contact your administrator |

## Authentication

See [Authentication](./authentication.md) for full details on both authentication mechanisms.
