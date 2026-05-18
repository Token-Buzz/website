# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

npm workspaces monorepo under `packages/*`, deployed with **SST v3** on AWS.

- `packages/marketing` — public Next.js site (`@website/marketing`). Dev on port **3000**.
- `packages/application` — authed Next.js app (`@website/application`). Dev on port **3002**. Uses Clerk.
- `packages/core` — shared library (`@monorepo-template/core`). DynamoDB client + key builders for the single-table design. Consumed by `application` via `sst.Resource` bindings — never imported by `marketing`.
- `packages/scripts` — one-off SST-shell scripts (`sst shell tsx`).
- `infra/` — SST resource definitions, loaded in order by `sst.config.ts`: `secrets → router → marketing → application → clerk → jobs`. Table definitions live in `infra/db.ts` and are shared by `application` and `jobs`.
- `scripts/` — repo-level Node/tsx utilities for managing SST secrets and GitLab CI variables.

## Common commands

Run from the repo root:

```bash
npm run dev:marketing          # marketing on :3000
npm run dev:application        # application on :3002
npm run lint                   # all workspaces
npm run typecheck              # all workspaces
npm run lint:application       # single workspace
npm test -w packages/core      # vitest under `sst shell` (needs an SST stage)

# SST
npx sst deploy --stage <stage>
npx sst remove --stage <stage>
npx sst shell --stage <stage> <cmd>   # any cmd with Resource/env bindings

```

There is no root-level test command; only `packages/core` has tests.

## Architecture

### Routing — one CloudFront in front of both Next.js apps

`infra/router.ts` creates a single `sst.aws.Router` with the apex domain. `infra/marketing.ts` attaches the marketing Next.js at the apex; `infra/application.ts` attaches the application Next.js at `app.{WEB_DOMAIN}`. Don't add a second Router — both production apps share this one.

PR stages (`pr-<N>`): both the application and marketing get their own CloudFront distributions at `pr-<N>.{WEB_DOMAIN}` (e.g. `pr-5.staging.tokenbuzz.app`) with **DNS-only (grey cloud) Cloudflare records** so ACM issues the cert directly — Cloudflare's free Universal SSL doesn't cover second-level wildcards.

### Stages

- `production` is the only named stage — it gets the custom domain and Cloudflare DNS for Clerk (see `infra/clerk.ts`).
- All other stage names are ephemeral (`pr-<N>`); they get auto-generated URLs and use the PR Console env vars for Clerk and all other config.
- CI/CD runs via SST Console Autodeploy (see `console.autodeploy` in `sst.config.ts`): push `master` to `production` branch to deploy production; opening a PR deploys to `pr-<number>` and closing it tears that stage down.

### Persistence — DynamoDB single-table design

Four tables defined in `infra/db.ts`: `Tweets`, `Aggregates`, `Tokens`, `UserData`. Both the application (`infra/application.ts`) and background jobs (`infra/jobs.ts`) import and link these tables. Access them only through `packages/core/src/db`:

- `client.ts` — exports the `ddb` DocumentClient and `TableNames` map (reads `Resource.X.name`).
- `keys.ts` — canonical PK/SK/GSI builders. Add new access patterns here rather than constructing keys inline so the table+GSI shape stays consistent.

GSI conventions:
- `Tweets`: `QueryByQueryTime` (gsi1), `QueryByAuthor` (gsi2), `ByConversation` (gsi3). Stream is `new-and-old-images`.
- `Aggregates`: `TopK` (gsi1) — sort key is zero-padded score for lexicographic top-k scans.
- `Tokens`: `SpikingByDelta` (gsi1), `WatchlistByMentions` (gsi2).

### Auth — Clerk

`packages/application/proxy.ts` is the Clerk middleware (not `middleware.ts`); `createRouteMatcher` protects `/dashboard`, `/watchlist`, `/analytics`, `/alerts`, `/account`.

Two Clerk instances, selected by the Console environment:
- **Production** (`pk_live_…`): domain `app.tokenbuzz.app`. DNS wired in `infra/clerk.ts`.
- **Staging** (`pk_test_…`): domain `staging.tokenbuzz.app`. PR previews use `pr-<N>.staging.tokenbuzz.app` — add each as an allowed subdomain in the Clerk staging dashboard when needed.

Marketing has no Clerk and no DB. Its only server-side code is the contact form (`app/api/contact/route.ts`) which uses Cloudflare Turnstile + Resend; required envs are wired in `infra/marketing.ts`.

### Configuration — SST secrets + Console environments

Secrets are declared in `infra/secrets.ts` as `sst.Secret` and seeded via the SST Console. The same secret names are used for all stages; the Console's environment configuration supplies different values:

- **`production` environment**: production values for all secrets.
- **Fallback environment**: staging/dev values — automatically applies to all PR stages (`pr-<N>`).

`CLOUDFLARE_API_TOKEN` is the exception: it is read as `process.env` in `app()` (before secrets load) and must be set as a Console **environment variable**, not a secret, in both environments.

Secrets to configure in Console (same names for both environments, different values):
`WEB_DOMAIN`, `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET`, `RESEND_API_KEY`, `CONTACT_TO_ADDRESS`, `CONTACT_FROM_ADDRESS`

## CI/CD (SST Console Autodeploy)

Deployments run via `console.autodeploy` in `sst.config.ts`, executed by AWS CodeBuild.

- Push to `master` → deploys `production` stage.
- Open/update a PR → deploys ephemeral `pr-<number>` stage (fallback Console environment).
- Close a PR → removes `pr-<number>` stage (`sst unlock` first to clear any stuck lock, then `sst remove`).
- Any other branch push → ignored (no deploy).

Workflow: `n 22` (pin Node) → on remove: `sst unlock + sst remove`; otherwise: `npm ci → lint → typecheck → sst unlock + sst deploy`.

`.gitlab-ci.yml` has been deleted — all CI/CD now runs through SST Console Autodeploy.

## Conventions

- All cross-package imports go through workspace package names (`@monorepo-template/core/db`), not relative paths.
- New DynamoDB access patterns: add the key builder in `packages/core/src/db/keys.ts` first; never inline `pk`/`sk` strings in route handlers.
- New infra resources: create a module under `infra/` and import it from `sst.config.ts` in the right order (secrets → router → apps that attach to it). New configuration values go in `infra/secrets.ts` as `sst.Secret` and get seeded via the Console.
- Use `$app.stage === "production"` (the `isProd` pattern) to gate anything that should only run for the named stage — don't hardcode against ephemeral stage names.
