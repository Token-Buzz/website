# Session handoff — TokenBuzz

## 2026-05-23 — Changelog shipped; Toggl time-tracking pending; M1.5 mobile milestone created

### TL;DR for the next session
- **Active branch:** `claude/determined-allen-QILYR` — **PR #81 is open** on it. The branch now carries three different workstreams (live-feed + release config + changelog) — see "PR #81 contents" below; consider splitting if you want clean PRs.
- **Just shipped (this session):** the public **Changelog** feature (GitHub Releases → marketing `/changelog`), browser-verified. A new **M1.5 mobile-friendly UI** milestone + epic/phases on the board. A decision to use **Toggl Track** for time tracking (build is **blocked on the user's Toggl API token**).
- **Top of the queue:** (1) **seed the `GITHUB_TOKEN` value** (the secret is wired in SST now — see gotcha) or `/changelog` shows empty in prod; (2) once the user provides the Toggl token, build the `track` CLI (#89); (3) finish **M1 Phase 4 — Alerts** (#22); then (4) start **M1.5 mobile** (#82).

### ⚠️ This handoff + the changelog work live on branch `claude/determined-allen-QILYR`
A session started from `master` won't see any of it. Start the next session on that branch (or merge PR #81 first).

---

## What this session shipped

### 1. Public Changelog (board issue #88 — effectively done)
Source of truth = **GitHub Releases**, notes auto-generated from merged PRs, rendered publicly.
- `.github/release.yml` — categorizes generated release notes by PR label (Features/Fixes/Docs/Maintenance/Other). **Only takes effect once on `master`.**
- `docs/releases.md` — how to cut a release (`gh release create vX.Y.Z --generate-notes`), semver `v`-tags.
- `packages/marketing/app/changelog/page.tsx` — Server Component, fetches `GET /repos/Token-Buzz/website/releases` **server-side** with `GITHUB_TOKEN ?? GH_TOKEN` (ISR 1h), renders markdown via `react-markdown` + `remark-gfm` (no raw HTML → XSS-safe), styled to the site design system. Nav + Footer links added; graceful empty state. Deps added to `packages/marketing`.
- **`v0.1.0` release created** (so the page has content) — the user can edit its wording.
- **Browser-verified** desktop + mobile → `docs/verification/changelog/` (PASS).

### 2. M1.5 — Mobile-friendly UI milestone (board)
Surfaced by M1 browser verification: the authed desktop sidebar doesn't collapse and data pages overflow at ~390px. Slotted **next after M1, before M2** (M2–M9 keep their numbers; the `M1.5` name sorts it between).
- Native **milestone #10** "M1.5 — Mobile-friendly UI"; **epic #82** (Status: Ready) with sub-issues **#83–#87** (P1 shell → P2 tables → P3 feed/dashboards → P4 forms/modals → P5 QA). P1 (#83) is Ready, rest Backlog. Authed app only; marketing out of scope.
- A `docs/milestones/M1.5-mobile-ui.md` doc was intentionally **deferred** (to avoid polluting PR #81) — add it on a fresh branch when starting the work.

### 3. Time tracking — decided: Toggl Track (board issue #89 — Ready, BLOCKED)
Requirements: human time = rough/daily via Toggl's start/stop; AI time = precise per task, logged by Claude via the Toggl API (tag `ai`, name `#<n> <title>`); both summable per period; "tasks/milestones closed in a range" comes free from GitHub `Closed` timestamps.
- **BLOCKED on the user:** create a Toggl account → generate API token + workspace ID → add as secrets `TOGGL_API_TOKEN` / `TOGGL_WORKSPACE_ID` (never commit) so AI logging is hands-free in sessions.
- Then build: a `track` CLI in `packages/scripts` (`ai-start <issue>` / `ai-stop <issue>` → Toggl API), the `human`/`ai` tagging convention, and a weekly combined report (Toggl totals + GitHub closed-by-milestone). Toggl's browser extension also gives the user a per-issue start button on GitHub.

### 4. PR-screenshot convention (DONE)
Images render in a PR conversation only when the **body/comment embeds** them via `https://github.com/Token-Buzz/website/blob/<sha>/<path>?raw=true` — committing PNGs is not enough.
- **#81 fixed:** rewritten with a real title/description + embedded live-feed & changelog screenshots.
- **Automated:** `.github/workflows/pr-screenshots.yml` — on every PR it finds added/modified `docs/verification/**` images and upserts a sticky comment embedding them (pinned to head SHA). No manual step going forward.

---

## PR #81 contents (branch `claude/determined-allen-QILYR`)
Commits since `master`: live-feed M1 Phase 3 (`9321188`, `a84a201`, `b33d7f4`) + release config (`7abdc42`) + changelog page (`065b8f7`) + verification (`02e2be3`) + handoff (`81aa767`) + GITHUB_TOKEN wiring (`c104ad0`) + PR-screenshot CI (`f35a5ce`). Several unrelated workstreams in one branch — split if you want clean PRs.

## ⚠️ Gotchas / must-do follow-ups
- **`/changelog` will be EMPTY in production until the token VALUE is seeded.** The `GITHUB_TOKEN` `sst.Secret` is now wired into the marketing app env (`infra/marketing.ts`). Remaining step: seed the value — a **fine-grained PAT scoped to `Token-Buzz/website` with `Contents: Read-only`** — via the Console (production + fallback envs) or `npx sst secret set GITHUB_TOKEN <pat> --stage <stage>`. Locally it works via the ambient `GH_TOKEN`. (Tracked in #88.)
- **`.github/release.yml` categorization** only activates once the file is merged to `master`.
- Don't commit `playwright`/`@clerk/testing` — install ad hoc for a run (this session installed then removed playwright).

## New-environment setup (what to have ready)
- **GitHub:** `gh` is authenticated via `GH_TOKEN` in the web env; GitHub MCP tools also available. Project board is org-owned under `Token-Buzz` (Project 1).
- **Changelog local dev:** ambient `GH_TOKEN` is enough — `npm run dev:marketing` (:3000) → `/changelog` renders live releases.
- **Authed-app UI testing:** Clerk dev keys are in env (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test…`, `CLERK_SECRET_KEY`, `CLERK_TEST_EMAIL`). Headless sign-in: `@clerk/testing/playwright` → `clerk.signIn({ strategy: 'email_code', identifier: CLERK_TEST_EMAIL })`, OTP `424242`. Point `client.ts` at local dynalite (copy `packages/core/test/integration-env.ts` + boot `dynalite-global.ts`) for real data with no AWS.
- **Time tracking:** needs the user's `TOGGL_API_TOKEN` / `TOGGL_WORKSPACE_ID` before #89 can be built/tested.

## Board state (GitHub Project 1, source of truth)
- M1 (Movers/Live feed/Alerts): Movers (#20) + Live feed (#21) done/verified; **#22 Alerts is the remaining M1 work.**
- **M1.5 mobile:** epic #82 (Ready) + #83 (Ready) + #84–87 (Backlog).
- **#88 Changelog** (In progress → mark Done once the prod token is wired) · **#89 Time tracking** (Ready, blocked on Toggl token).
- M2–M9 epics seeded.

## Conventions (full detail in CLAUDE.md + the project-conventions skill)
- Lead Opus = **orchestrator**; dispatch Sonnet/Haiku subagents for code edits; review the real diff before reporting done. Docs/config (`*.md`, `.claude/`) you may edit directly.
- New pure logic → unit test (`npm run test:unit`). New/changed DynamoDB access pattern → dynalite integration test (`npm run test:integration`). UI change → real browser test (screenshots under `docs/verification/`).
- Never commit/push to `master`; feature branch only. `npm run typecheck` + `npm run lint` before every commit; discard `packages/*/tsconfig.tsbuildinfo`. Never `--no-verify`. **Open PRs only when explicitly asked.**
