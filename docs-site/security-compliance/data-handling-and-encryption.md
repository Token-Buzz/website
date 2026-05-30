# Data Handling and Encryption

TokenBuzz stores the minimum data necessary to deliver the service. All data is encrypted in transit and at rest. User-supplied credentials receive additional application-layer encryption using AWS KMS.

## What TokenBuzz stores

| Data category | Where | Retention |
|---|---|---|
| Social content (posts, metadata) indexed by your queries | DynamoDB (`Tweets`, `Aggregates`, `Tokens` tables) | Retained while your account is active; TTL-expired items are purged automatically |
| User preferences, watchlists, saved queries, dashboards | DynamoDB (`UserData`, `Feeds` tables) | Retained while your account is active |
| Provider credentials you supply (BYOK) | DynamoDB (`UserData` table), AES-encrypted via AWS KMS | Retained until you remove the key via Account settings; removed immediately on deletion |
| Authentication data (email, session tokens) | Managed by Clerk — not stored in TokenBuzz's database | Governed by Clerk's data processing terms |
| Contact form submissions | Forwarded via Resend; not stored in the database | Not retained |

TokenBuzz does not store payment card data. Billing is handled entirely by Stripe; TokenBuzz retains only Stripe customer and subscription IDs.

## Encryption in transit

All communication between users and TokenBuzz is encrypted using TLS. CloudFront terminates TLS at the edge and enforces HTTPS for every request — HTTP connections are not accepted for authenticated application routes.

API calls from the application server to AWS services (DynamoDB, KMS, SSM) travel over AWS's internal network using TLS-secured SDK calls.

## Encryption at rest

**DynamoDB:** All tables use AWS server-side encryption (SSE) at rest. Encryption is applied automatically by DynamoDB using AWS-managed keys; no plaintext data is written to storage.

**S3:** Any S3 buckets used by the application (for Next.js build assets, CloudFront origin content) have server-side encryption enabled and TLS-only bucket policies that reject unencrypted connections.

**BYOK credentials:** Before a user-supplied provider key is written to DynamoDB, it is encrypted at the application layer using AES via a dedicated AWS KMS customer-managed key (`BYOK_KMS_KEY_ID`). This means:

- The ciphertext in DynamoDB is opaque — the raw key is never stored in plaintext anywhere.
- Decryption requires a live KMS API call with a valid IAM context; the ciphertext alone is not sufficient.
- The KMS key has automatic annual rotation enabled.
- Only the application server role has `kms:Encrypt`, `kms:Decrypt`, and `kms:GenerateDataKey` on this key.

## Authentication

User accounts and sessions are managed by [Clerk](https://clerk.com). TokenBuzz does not implement its own password hashing, session management, or credential storage. Clerk supports:

- Email/password authentication
- Social OAuth sign-in
- Multi-factor authentication (MFA) — available to all users

The authenticated application enforces route-level protection in middleware; unauthenticated requests to protected routes (`/dashboard`, `/watchlist`, `/analytics`, `/alerts`, `/account`) are redirected to sign-in before any data is accessed.

## Bring Your Own Key (BYOK) credential handling

TokenBuzz supports connecting third-party data providers (Twitter/X, Reddit, Telegram, Farcaster) using credentials you supply. The design principles for BYOK credentials:

- **Never displayed in full.** The Account UI shows only the last four characters of a stored key. The full plaintext is only held in memory during an active API request and is never logged or written to disk.
- **Isolated per-user.** Each user's credentials are encrypted with the same KMS key but stored under a user-scoped partition key. One user's data cannot be used to derive another's.
- **Removable on demand.** Deleting a provider key from Account settings immediately removes the DynamoDB item and all associated metadata. No background copies are retained.
- **Status tracking.** If a provider rejects a key (for example, due to revocation), TokenBuzz marks it as `invalid` and surfaces the status in the Account UI rather than silently failing.

## Data export and deletion

- **Export:** Account data export is available from Account settings. The export includes your saved queries, watchlists, and dashboards.
- **Account deletion:** Deleting your account removes your user data from TokenBuzz's DynamoDB tables, including all BYOK credentials and preferences. Authentication records are deleted via Clerk's account deletion flow.

If you need to request deletion of specific data outside the self-service flow, contact support through the form at [tokenbuzz.app](https://tokenbuzz.app).
