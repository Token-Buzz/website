# Authentication

TokenBuzz's two API surfaces use different authentication mechanisms. Using the wrong mechanism for a given surface will result in a `401 Unauthorized` response.

## Hosted app routes (Clerk)

The Next.js app routes at `app.tokenbuzz.app` are protected by [Clerk](https://clerk.com). Authentication is session-based for browser clients and bearer-token-based for programmatic access.

### Protected paths

The following path prefixes require a valid Clerk session:

- `/dashboard`
- `/watchlist`
- `/analytics`
- `/alerts`
- `/account`
- All `/api/*` routes (enforced per-route via `auth()` checks)

### How to authenticate

Browser-based flows are handled automatically via Clerk's hosted sign-in page (`/sign-in`). For programmatic API calls from your own code, obtain a short-lived session token from the Clerk SDK and include it as a bearer token:

```http
Authorization: Bearer <clerk-session-token>
```

### Error responses

| Status | Body | Meaning |
|---|---|---|
| `401 Unauthorized` | `{ "error": "Unauthorized" }` | No valid Clerk session or token |
| `402 Payment Required` | `{ "error": "quota_exhausted", "plan": "...", "used": N, "limit": N }` | Monthly ingestion quota reached |
| `403 Forbidden` | `{ "error": "source_locked", "locked": [...], "plan": "..." }` | Requested source not available on your plan |
| `403 Forbidden` | `{ "error": "byok_required", "reason": "missing" \| "invalid" }` | BYOK credential missing or revoked for the requested source |

---

## api-caller service (Auth0 + internal key)

The `api-caller` Spring Boot service supports two authentication methods. Both protect all `/api/**` endpoints (exposed externally under `/caller/api/**`).

### Method 1 — Auth0 JWT bearer token

Obtain an access token from your Auth0 tenant using the M2M client credentials flow, then pass it as a bearer token on every request.

```bash
# Fetch an access token
curl -s -X POST "https://<AUTH0_DOMAIN>/oauth/token" \
  -H "Content-Type: application/json" \
  -d '{
    "grant_type": "client_credentials",
    "client_id": "<AUTH0_CLIENT_ID>",
    "client_secret": "<AUTH0_CLIENT_SECRET>",
    "audience": "<AUTH0_AUDIENCE>"
  }'
```

Use the returned `access_token` on subsequent requests:

```http
Authorization: Bearer <access_token>
```

#### JWT validation rules

The service validates tokens as follows:

| Property | Expected value |
|---|---|
| Algorithm | `RS256` only |
| JWKS URL | `https://<AUTH0_DOMAIN>/.well-known/jwks.json` |
| `iss` claim | `https://<AUTH0_DOMAIN>/` (service normalises domain to include scheme and trailing `/`) |
| `aud` claim | Must contain `AUTH0_AUDIENCE` |

### Method 2 — Internal API key (`X-Internal-API-Key`)

When `INTERNAL_API_KEY` is configured on the server, you can authenticate any `/api/**` request with a shared key header instead of a JWT. This is intended for service-to-service calls inside the same private network.

```http
X-Internal-API-Key: <INTERNAL_API_KEY>
```

### Public paths (no auth required)

The following paths are always accessible without authentication:

| Path | Notes |
|---|---|
| `/actuator/health/**` | Health probe only; other actuator endpoints are not exposed by default |
| `/v3/api-docs/**` | OpenAPI docs (only when `SPRINGDOC_API_DOCS_ENABLED=true`) |
| `/swagger-ui/**` | Swagger UI (only when `SPRINGDOC_SWAGGER_UI_ENABLED=true`) |

### Dev profile (auth disabled)

When the service is started with `SPRING_PROFILES_ACTIVE=dev`, all authentication checks are bypassed via `DevSecurityConfig`. **Never run this in production.**

### Error responses

| Status | Body | Meaning |
|---|---|---|
| `401 Unauthorized` | `{ "error": "unauthorized" }` | Missing or invalid token / key |
| `403 Forbidden` | `{ "error": "forbidden" }` | Authenticated but not permitted to perform the action |
