# Security & Compliance Overview

TokenBuzz is built on AWS using a fully serverless architecture, with security controls applied at every layer — from account-wide guardrails to per-resource encryption and least-privilege IAM policies.

## Architecture

TokenBuzz runs entirely on AWS managed services. There are no long-lived virtual machines or container hosts to patch, no OS-level attack surface to manage, and no persistent compute instances that accumulate risk over time. The application is deployed as serverless functions (AWS Lambda via Next.js on SST) behind a CloudFront distribution, with data stored in DynamoDB.

This architecture eliminates entire categories of risk — host compromise, unpatched OS vulnerabilities, and SSH exposure — by design, not by configuration.

## Encryption

**In transit:** All traffic is encrypted using TLS. CloudFront enforces HTTPS for every request to both the marketing site and the authenticated application. HTTP connections are redirected or rejected.

**At rest:** DynamoDB tables are encrypted at rest using AWS-managed keys (SSE by default on all tables). User-supplied provider credentials (Bring Your Own Key, or BYOK) are additionally encrypted at the application layer using a dedicated AWS KMS customer-managed key before being written to the database — so raw credential values never appear in storage.

## Authentication

User authentication is handled by [Clerk](https://clerk.com), a managed identity platform. TokenBuzz does not store passwords. Clerk handles credential management, session tokens, and multi-factor authentication. The authenticated application (`app.*`) is protected at the middleware layer; unauthenticated requests to protected routes are redirected to sign-in.

## Secrets management

Application secrets (API keys, service credentials) are stored in AWS SSM Parameter Store and injected into the runtime environment at deploy time via SST. No secrets are committed to the codebase or included in build artifacts. Per-user BYOK credentials follow a stricter path: they are encrypted with AWS KMS before being stored, and the plaintext is only ever held in memory during an active request.

## Least-privilege IAM

Each component of the application (Next.js server, background jobs) has a scoped IAM role that permits only the specific DynamoDB tables, KMS keys, and AWS services it needs. No component has a wildcard `*:*` policy. IAM Access Analyzer is enabled at the AWS Organizations level to surface overly-permissive policies continuously.

## Compliance frameworks

| Framework | Status |
|---|---|
| CIS AWS Foundations Benchmark v6.0.0 | Aligned — see [CIS AWS Benchmark](./cis-aws-benchmark.md) |
| SOC 2 Type II | Roadmap |
| ISO 27001 | Roadmap |

TokenBuzz's AWS account configuration is verified against the CIS AWS Foundations Benchmark v6.0.0 using automated scanning. A controls matrix documents every CIS control, its owner, and the infrastructure code that enforces it.

## Contact

Security questions or vulnerability reports: please reach out through the contact form at [tokenbuzz.app](https://tokenbuzz.app) or email the address on file for your account.
