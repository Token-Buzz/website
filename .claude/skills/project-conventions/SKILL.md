---
name: project-conventions
description: Working in this repo. Loads on any non-trivial task — captures workflow rules (branches, commits, subagent dispatch), the technology stack, and common debugging recipes so a fresh session doesn't relearn them.
---

# Project Conventions

> Read this first. It encodes the rules every session should follow regardless of which feature you're working on.

## Coding workflow

- **Never commit or push directly to `master`.** Always work on a feature branch. If somehow checked out on `master`, branch off before staging anything.
- **Push only at the end** of a logical unit of work, not after every micro-commit. Avoids redeploy churn on stages with auto-deploy.
- **Don't open PRs from Claude.** The human opens PRs manually after reviewing the branch. Do not run `gh pr create`, `mcp__github__create_pull_request`, or equivalents unless the user has just typed "open the PR".
- **Static checks must pass before every commit.** Run `npm run typecheck` and `npm run lint` from the repo root; both must exit 0. If they don't, fix it before staging — never use `--no-verify` to bypass hooks.
- **Discard build cache files before staging.** `git checkout -- packages/*/tsconfig.tsbuildinfo` (or equivalent for your toolchain). These are local-only artifacts that pollute diffs.
- **Best practices over cleverness.** Match the patterns already in the codebase. Don't invent abstractions for hypothetical reuse. Don't add comments that just restate the code — only document non-obvious WHY.

## Commit messages

- One concise subject line; expand in the body only if the WHY isn't obvious from the diff.
- Reference the file/feature, not the task ID. The PR description is for task context.
- The harness expects the session URL as the final line — keep that footer.

## Subagent dispatch

Use subagents for any work that fits — they keep the main context window clean and they're cheaper for routine work.

- **Sonnet** — moderate scope: a new component, a refactor that touches 3-5 files, a focused bug investigation. Default choice.
- **Haiku** — trivial scope: porting one more component to match an existing pattern, a tiny test fix, a single-line config tweak.
- **Opus** (this model) — orchestration, complex multi-step planning, the actual decision-making. Don't delegate judgement; delegate execution.

When dispatching, write the prompt as if briefing a smart colleague who just walked in cold:
- State the goal in one sentence.
- List which files to touch and which not to touch.
- Point at the existing pattern to mirror.
- Require: typecheck + lint pass, build cache discarded, single push at end, no PR.
- Cap the report length (e.g. "Report under 250 words").

Parallel agents when work is independent. Use `run_in_background: true` to keep the conversation responsive.

## Technology stack

| Component | Version / detail |
|---|---|
| Monorepo | npm workspaces (`packages/*`) |
| Node | 22 (`@tsconfig/node22`) |
| TypeScript | ^5 |
| Next.js | 16.2.6 (`latest` in both `packages/application` and `packages/marketing`) |
| SST | 4.14.1 |
| Cloudflare provider (Pulumi) | 6.15.0 |
| Deployment | AWS via SST, with Cloudflare DNS for some domains |
| CI/CD | SST Console Autodeploy (no `.gitlab-ci.yml`, no `.github/workflows/` for deploy) |

## Architecture overview

<!-- FILL IN: replace this block with a short description of how the packages relate.
     Keep it under 10 lines — deep links go in CLAUDE.md, not here.
     Example questions to answer:
       - Which package depends on which?
       - Which package owns the data layer?
       - Which package is public-facing vs internal?
       - Where does the deployment infrastructure live? -->

## Development environment

<!-- FILL IN: the commands a fresh session needs to actually run things.
     Examples:
       - `npm run dev:application`  → run the authed app locally on :3002
       - `npm run dev:marketing`    → run the public marketing site on :3000
       - `npx sst deploy --stage <stage>`  → deploy a specific SST stage
       - `npx sst shell --stage <stage> tsx <script>`  → run a one-off with SST env
     Include the port numbers and any setup steps (e.g. "must have CLOUDFLARE_API_TOKEN in env"). -->

## Debugging recipes

<!-- FILL IN over time. Whenever a session finds a useful diagnostic command, add it here.
     Suggested categories:
       - AWS / SST: how to find the current stage's resources, tail Lambda logs, check throttles
       - Database: common DDB / SQL queries used during debugging
       - Frontend: where to look in DevTools when something silently breaks
       - Deploys: how to confirm the latest commit actually shipped (Lambda LastModified vs commit time)
     Keep each recipe as a runnable snippet, not prose. -->

## Things this repo has tripped over before

<!-- FILL IN as bugs get diagnosed. The format should be:
       - **Symptom**: what the user sees
       - **Cause**: the actual underlying issue
       - **Fix**: the change that resolved it
     The point of this section is to recognise repeats. Don't paste full investigations;
     summarise in 2-3 lines per item. -->

## Things to keep out of this file

- Implementation details about specific features. Those go in CLAUDE.md or a feature-specific skill.
- Anything that changes per session (current branch, current PR number, the active phase of work). Those rot — keep this file evergreen.
- Secrets, credentials, or anything you'd be uncomfortable seeing on GitHub.
