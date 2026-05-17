# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

npm workspaces monorepo under `packages/*`, deployed with **SST v3** on AWS.

- `packages/marketing` — public Next.js site (`@website/marketing`). Dev on port **3000**.
- `packages/application` — authed Next.js app (`@website/application`). Dev on port **3002**. Uses Clerk.
- `packages/core` — shared library (`@monorepo-template/core`). DynamoDB client + key builders for the single-table design. Consumed by `application` via `sst.Resource` bindings — never imported by `marketing`.
- `packages/scripts` — one-off SST-shell scripts (`sst shell tsx`).
- `infra/` — SST resource definitions, loaded in order by `sst.config.ts`: `secrets → router → marketing → application → clerk`.
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

# Sync local .env.local files into SST secrets for a stage
npm run set-sst-vars -- --stage dev
npm run set-sst-vars -- --stage production --dry-run
```

There is no root-level test command; only `packages/core` has tests.

## Architecture

### Routing — one CloudFront in front of both Next.js apps

`infra/router.ts` creates a single `sst.aws.Router` with the apex domain. `infra/marketing.ts` attaches the marketing Nextjs at the apex; `infra/application.ts` attaches the application Nextjs at `app.{webDomain}`. The router is only created with a custom domain when `$app.stage` is `production` or `dev` (`isNamedStage`); ephemeral PR stages get auto-generated URLs and no router domain. Don't add a second Router — both apps share this one.

### Stages

- `dev` and `production` are the only "named" stages with custom domains and Cloudflare DNS for Clerk (see `infra/clerk.ts`, which only runs in `production`).
- Any other stage name is treated as ephemeral.
- A scheduled `destroy:dev` GitLab job tears down the `dev` stage if no commits land within 4 hours (`.gitlab-ci.yml`).

### Persistence — DynamoDB single-table design

Four tables defined in `infra/application.ts`: `Tweets`, `Aggregates`, `Tokens`, `UserData`. The application binds to all four via `link:`. Access them only through `packages/core/src/db`:

- `client.ts` — exports the `ddb` DocumentClient and `TableNames` map (reads `Resource.X.name`).
- `keys.ts` — canonical PK/SK/GSI builders. Add new access patterns here rather than constructing keys inline so the table+GSI shape stays consistent.

GSI conventions:
- `Tweets`: `QueryByQueryTime` (gsi1), `QueryByAuthor` (gsi2), `ByConversation` (gsi3). Stream is `new-and-old-images`.
- `Aggregates`: `TopK` (gsi1) — sort key is zero-padded score for lexicographic top-k scans.
- `Tokens`: `SpikingByDelta` (gsi1), `WatchlistByMentions` (gsi2).

### Auth — Clerk

`packages/application/proxy.ts` is the Clerk middleware (not `middleware.ts`); `createRouteMatcher` protects `/dashboard`, `/watchlist`, `/analytics`, `/alerts`, `/account`. `packages/application/next.config.ts` remaps `DEV_CLERK_*` / `PROD_CLERK_*` env vars into the canonical `CLERK_SECRET_KEY` / `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` based on `NODE_ENV`. In SST, those canonical values come from `infra/secrets.ts`.

Marketing has no Clerk and no DB. Its only server-side code is the contact form (`app/api/contact/route.ts`) which uses Cloudflare Turnstile + Resend; required envs are wired in `infra/marketing.ts`.

### Secrets

All runtime secrets are SST secrets, declared in `infra/secrets.ts` (file is access-restricted in this workspace) and surfaced to apps through `environment:` blocks in `infra/marketing.ts` / `infra/application.ts`. To seed a stage, drop values in `.env.local` (root and/or package) and run `npm run set-sst-vars -- --stage <stage>`. `AWS_*` and `CLOUDFLARE_API_TOKEN` are skipped by the script.

## CI/CD (GitLab)

`.gitlab-ci.yml` stages: `install → validate (lint+typecheck) → deploy → teardown`.

- MRs: install + validate only.
- Push to `dev`: deploys via `sst deploy --stage dev` after assuming `AWS_ROLE_ARN` through GitLab OIDC.
- Tag `vX.Y.Z` on `master`: manual production deploy.
- Scheduled pipelines on `dev`: run the 4-hour-idle teardown check.

The OIDC role assumption is in the `.aws_oidc` template — extend it (not duplicate it) when adding new AWS-touching jobs.

## Conventions

- All cross-package imports go through workspace package names (`@monorepo-template/core/db`), not relative paths.
- New DynamoDB access patterns: add the key builder in `packages/core/src/db/keys.ts` first; never inline `pk`/`sk` strings in route handlers.
- New infra resources: create a module under `infra/` and import it from `sst.config.ts` in the right order (secrets must load before anything that reads them; router before the apps that attach to it).
- Use `$app.stage === "production" || $app.stage === "dev"` (the `isNamedStage` pattern) to gate anything that should only run for the two real stages — don't hardcode against ephemeral stage names.
