# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ HIGHEST PRIORITY — Orchestrate via subagents, do not write code yourself

**READ THIS FIRST AND DO NOT SKIP IT. This rule overrides default behavior and applies to every coding task.**

The lead Claude (Opus) acts as an **orchestrator / project manager**, NOT as the person typing code. The user does NOT want Opus writing implementation code directly. For essentially all coding work, **dispatch Sonnet and Haiku subagents** (via the `Agent` tool) to do the actual writing, and supervise them.

- **Always use subagents when possible.** This is not optional. Before writing code yourself, the default question is "which subagent should do this?" — only fall back to writing code directly if a task genuinely cannot be delegated, and say so explicitly.
- **Opus's job is orchestration:** break work into well-scoped tasks, brief each subagent thoroughly, dispatch them (in parallel when the work is independent), review what they produce, integrate it, and keep the overall implementation running smoothly.
- **Model selection:**
  - **Sonnet** — non-trivial coding tasks: feature work, refactors, bug fixes, anything requiring judgment.
  - **Haiku** — small, mechanical, well-defined tasks: simple edits, renames, boilerplate, quick lookups.
- **Verify, don't assume.** A subagent's summary describes intent, not what actually landed. Review the real diff before reporting work as done.
- **PR readiness — manual test plan.** For any major implementation (not small code edits), when the code is ready to open a PR, **provide the user with a concrete set of tests they can perform directly on the website** to confirm everything is running smoothly. List the exact pages/flows to exercise and the expected result for each.

## Repository layout

npm workspaces monorepo under `packages/*`, deployed with **SST v4** on AWS.

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
npm run test:unit            # pure unit tests, no SST stage needed (also runs in CI)
npm run test:integration       # dynalite (in-memory DynamoDB) integration tests, no AWS (also runs in CI)
npm test -w packages/core      # vitest under `sst shell` (needs an SST stage)

# SST
npx sst deploy --stage <stage>
npx sst remove --stage <stage>
npx sst shell --stage <stage> <cmd>   # any cmd with Resource/env bindings

```

Root `test:unit` runs the pure unit suite (no SST stage) and gates CI; `npm run test:integration` runs DB-bound tests against an in-memory DynamoDB (dynalite) — no AWS, no `sst shell`, and also gates CI; `npm test -w packages/core` runs the full suite under `sst shell` for tests that need a live stage.

### Integration tests — dynalite (in-memory DynamoDB)

`packages/core/test/` holds a dynalite-backed integration layer that exercises the real `packages/core/src/db` functions (the actual `ddb` client, key builders, and GSI queries) against a local in-memory DynamoDB — so it catches bugs unit tests can't, e.g. a write that omits a GSI key and is therefore invisible to the index query. It runs fully offline (no AWS, no `sst shell`): the harness boots dynalite, recreates the `infra/db.ts` tables/GSIs, and points the production `client.ts` at it purely via env vars (`AWS_ENDPOINT_URL_DYNAMODB` + `SST_RESOURCE_*`) — `client.ts` is never modified.

- Files are named `*.integration.test.ts`; `vitest.config.ts` (unit) excludes them, `vitest.integration.config.ts` includes them and wires the dynalite `globalSetup` + env `setupFiles`.
- **When you add or change a DynamoDB access pattern** (a `keys.ts` builder, a new GSI query, an upsert that maintains index keys), add or extend an integration test that does the real write→read round-trip — don't rely on unit-testing the pure parts alone.

### Local UI / browser testing (authed pages)

**Always attempt a real browser UI test when you change UI** (any page/component in `packages/application` or `packages/marketing`). Typecheck and unit tests don't prove a page renders or a flow works — render it in a browser and observe it (the `/verify` skill captures evidence/screenshots). If something genuinely blocks an in-browser test, say so explicitly rather than claiming success.

The web environment is wired for this fully offline:

- **Clerk dev keys** are present as env vars: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (`pk_test…`, the dev instance), `CLERK_SECRET_KEY` (`sk_test…`), and `CLERK_TEST_EMAIL` (a `+clerk_test@…` address). Note `CLERK_PUBLISHABLE_KEY` holds the prod `pk_live` value — Next reads the `NEXT_PUBLIC_` one (the dev key), so just inherit the ambient env.
- **Real data, no AWS:** `dev:application` is plain `next dev -p 3002` (not `sst dev`), so point `client.ts` at a local dynalite exactly like the integration harness — set `AWS_ENDPOINT_URL_DYNAMODB` + the five `SST_RESOURCE_*` vars (copy `packages/core/test/integration-env.ts`), boot dynalite and recreate the tables (`packages/core/test/dynalite-global.ts`), seed through the real `packages/core/src/db` functions, then launch `next dev` with those same env vars set.
- **Headless sign-in:** the custom sign-in form (`app/sign-in/[[...sign-in]]`) uses `signIn.password()` — email **+ password** (email-code is only a 2nd factor). The reliable path is `@clerk/testing/playwright`: `clerkSetup()` → `setupClerkTestingToken({ page })` → `clerk.signIn({ page, signInParams: { strategy: 'email_code', identifier: <CLERK_TEST_EMAIL> } })`. Clerk's fixed dev OTP `424242` for `+clerk_test` addresses is handled internally — no password or real inbox needed. (To drive the real password form instead, first create a `+clerk_test` user with a password via the Clerk Backend API using `CLERK_SECRET_KEY`.)
- `playwright` and `@clerk/testing` are **not** committed deps — install them ad hoc for a run (`npm i -D playwright @clerk/testing && npx playwright install chromium`) and don't commit the install or the throwaway harness scripts.

## Architecture

### Routing — one CloudFront in front of both Next.js apps

`infra/router.ts` creates a single `sst.aws.Router` with the apex domain. `infra/marketing.ts` attaches the marketing Next.js at the apex; `infra/application.ts` attaches the application Next.js at `app.{WEB_DOMAIN}`. Don't add a second Router — both production apps share this one.

PR stages (`pr-<N>`): both the application and marketing get their own CloudFront distributions at `pr-<N>.{WEB_DOMAIN}` (e.g. `pr-5.staging.tokenbuzz.app`) with **DNS-only (grey cloud) Cloudflare records** so ACM issues the cert directly — Cloudflare's free Universal SSL doesn't cover second-level wildcards.

### Stages

- `production` is the only named stage — it gets the custom domain and Cloudflare DNS for Clerk (see `infra/clerk.ts`).
- All other stage names are ephemeral (`pr-<N>`); they get auto-generated URLs and use the PR Console env vars for Clerk and all other config.
- CI/CD runs via GitHub Actions (`.github/workflows/deploy.yml` + `.github/workflows/teardown.yml`): push to `master` deploys `production`; opening / updating a PR deploys `pr-<number>`; closing the PR tears that stage down.

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
`WEB_DOMAIN`, `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET`, `RESEND_API_KEY`, `CONTACT_TO_ADDRESS`, `CONTACT_FROM_ADDRESS`, `TWITTER_API_KEY`, `CHANGELOG_GITHUB_TOKEN`

`CHANGELOG_GITHUB_TOKEN` is read server-side by the marketing `/changelog` page to fetch this (private) repo's GitHub Releases. Use a **fine-grained PAT scoped to only `Token-Buzz/website` with `Contents: Read-only`** (least privilege). It's wired into the marketing app's `environment` in `infra/marketing.ts` (not `NEXT_PUBLIC_`, so it stays server-side).

All `sst.Secret` names must use `SCREAMING_SNAKE_CASE` (e.g. `TWITTER_API_KEY`, not `TwitterApiKey`). This keeps secret names consistent with environment variable conventions and makes it obvious when a name needs updating.

**Never give a required secret/config value an empty or placeholder fallback.** A missing required value (an `sst.Secret`, env var, etc.) must fail loudly at deploy/build/startup — do NOT paper over it with `new sst.Secret("X", "")` or any default that lets the app run misconfigured. Empty fallbacks hide misconfiguration and resurface as confusing runtime bugs later. The fix for an unset secret is to **seed the real value** (in both Console environments — production and the fallback env used by `pr-<N>` stages), never to soften the failure.

## CI/CD (GitHub Actions)

Deployments run from `.github/workflows/deploy.yml` and `.github/workflows/teardown.yml`. SST is still the deploy tool — only the pipeline trigger moved off SST Console.

- Push to `master` → deploys `production` stage.
- Open / update / reopen a PR → deploys ephemeral `pr-<number>` stage.
- Close a PR → removes `pr-<number>` stage (`sst unlock` → `sst refresh` → `sst remove`).
- Concurrency group per stage; in-progress runs are cancelled when a newer commit lands.

Steps for a deploy run: checkout → setup Node 22 → `npm ci` → `npm run lint` → `npm run typecheck` → `npm run test:unit` → `npm run test:integration` → `aws-actions/configure-aws-credentials` → `npx sst unlock` (best-effort) → `npx sst deploy --stage <stage>`. The lint/typecheck/unit/integration steps all run before AWS credentials are configured, so they gate the deploy without needing AWS (dynalite is in-memory).

### Required GitHub repository secrets

Set under **Settings → Secrets and variables → Actions → Secrets** before the first run:

- `AWS_ROLE_ARN` — ARN of the IAM role the workflows assume via GitHub OIDC, e.g. `arn:aws:iam::421219980711:role/github-actions-deploy`. The role's trust policy must allow `token.actions.githubusercontent.com` for this repo; the role itself needs permissions to deploy this SST app.
- `CLOUDFLARE_API_TOKEN` — same token previously held as a Console env var (used by Cloudflare DNS records).

The workflows authenticate to AWS via OIDC (`aws-actions/configure-aws-credentials@v4` with `role-to-assume`), so no long-lived AWS access keys are stored in GitHub.

SST application secrets (`sst.Secret` entries in `infra/secrets.ts`: `WEB_DOMAIN`, `CLERK_*`, `TURNSTILE_*`, `RESEND_API_KEY`, `CONTACT_*`, `TWITTER_API_KEY`, `OPENCAGE_API_KEY`, `CHANGELOG_GITHUB_TOKEN`) are stored in AWS SSM Parameter Store, not in GitHub. Seed them per stage with `npx sst secret set <NAME> <value> --stage <stage>` (or use the `npm run set-sst-vars` script with a `.env.local`).

## GitHub tooling

In Claude Code on the web, `gh` is installed and **authenticated** (as `jasonp2323` via `GH_TOKEN`) and github.com is reachable — so the full `gh` CLI is available, not just the MCP tools. Use the right tool for the job:

- **GitHub Projects (v2)**: use the `gh` CLI (`gh project ...`). The GitHub MCP server has no Projects tool, so `gh` is the only option.
- **PRs, issues, comments, CI status, reviews, branches, releases, code search**: prefer the GitHub MCP tools (`mcp__github__*`) — they integrate with the PR-activity webhook subscriptions used to watch/autofix PRs. `gh` is a fine fallback for anything the MCP tools don't cover.

**Keep the GitHub Project current as we make progress.** The ClickUp→GitHub migration is done — GitHub Projects/Issues is now the source of truth for the 9 milestones and their phases. When a phase or milestone moves forward (work starts, lands, or gets verified), update the matching Project item / issue in the same session — status column, checklists, and close the issue on completion — so the board reflects reality instead of drifting.

## Session continuity & memory model

Each milestone is large and spans many fresh (often ephemeral web) sessions. Memory is **layered by how often it changes** — do NOT recreate a monolithic handoff doc each session:

- **Durable knowledge** (architecture, conventions, testing, deploy, secrets) lives here in `CLAUDE.md` + the `project-conventions` skill.
- **Per-milestone plans/specs** live in `docs/milestones/M*.md` and the milestone's **epic issue**.
- **Live status** (done / in-flight / blockers / next steps / gotchas) lives in the **epic issue's "Status / Next steps / Gotchas" section** + the GitHub Project board Status column — that is the source of truth. Update the epic issue as work lands; don't let status drift into scratch files.
- `handoff.md` is only a **pointer** to the above, never a status log.
- A **SessionStart hook** (`.claude/hooks/session-start.sh`) auto-prints orientation (recent commits, open PRs, open milestones, recent issues) at the start of every session.

## Conventions

- All cross-package imports go through workspace package names (`@monorepo-template/core/db`), not relative paths.
- New DynamoDB access patterns: add the key builder in `packages/core/src/db/keys.ts` first; never inline `pk`/`sk` strings in route handlers.
- New infra resources: create a module under `infra/` and import it from `sst.config.ts` in the right order (secrets → router → apps that attach to it). New configuration values go in `infra/secrets.ts` as `sst.Secret` and get seeded via the Console.
- Use `$app.stage === "production"` (the `isProd` pattern) to gate anything that should only run for the named stage — don't hardcode against ephemeral stage names.
- Any new pure logic (calculations, parsers, data transforms, DB key builders) ships with unit tests in the same change. CI runs these via `npm run test:unit`.
- Any new or changed DynamoDB access pattern (GSI query, index-maintaining upsert) ships with a dynalite integration test (`*.integration.test.ts` in `packages/core/test/`) that does the real write→read round-trip. CI runs these via `npm run test:integration`. See "Integration tests — dynalite" above.
- Any UI change (a page or component) gets a real browser UI test — render the page, drive the changed flow, and observe it; don't rely on typecheck/unit tests alone for UI. See "Local UI / browser testing" above.

## Git Workflow

- Provide a commit message to the user for any changes made to code.
- Never commit or push directly to `master`. Always work on a feature branch; if checked out on `master`, branch off before staging.
- Run `npm run typecheck` and `npm run lint` from the repo root before every commit and before the final push. Both must exit 0. Never use `--no-verify` to bypass hooks — the same checks run in CI.
- Discard build cache files before staging: `git checkout -- packages/*/tsconfig.tsbuildinfo`. They're local-only artifacts that pollute diffs.
- Don't open PRs unless the user explicitly asks ("open the PR"). The human opens PRs manually after reviewing the branch.