# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> Starter ported from a Next.js/SST repo and re-pointed at Terraform. Search for
> `<FILL IN>` and replace each with this repo's real details.

## ⚠️ HIGHEST PRIORITY — Orchestrate via subagents, do not write code yourself

**READ THIS FIRST AND DO NOT SKIP IT. This rule overrides default behavior and applies to every task that changes files.**

The lead Claude (Opus) acts as an **orchestrator / project manager**, NOT as the person typing code. The user does NOT want Opus writing implementation code directly. For essentially all work, **dispatch Sonnet and Haiku subagents** (via the `Agent` tool) to do the actual writing, and supervise them.

- **Always use subagents when possible.** This is not optional. Before writing code yourself, the default question is "which subagent should do this?" — only fall back to writing it directly if a task genuinely cannot be delegated (e.g. editing this file or other docs/config), and say so explicitly.
- **Opus's job is orchestration:** break work into well-scoped tasks, brief each subagent thoroughly, dispatch them (in parallel when the work is independent), review what they produce, integrate it, and keep the overall implementation running smoothly.
- **Model selection:**
  - **Sonnet** — non-trivial work: a new module, a refactor, anything requiring judgment.
  - **Haiku** — small, mechanical, well-defined tasks: simple edits, renames, boilerplate, quick lookups.
- **Verify, don't assume.** A subagent's summary describes intent, not what actually landed. Review the real diff (and the `terraform plan`) before reporting work as done.
- **PR readiness — plan review.** For any non-trivial change, when the code is ready to open a PR, **show the user the `terraform plan`** and a concrete list of what will change in each environment so they can confirm before applying. Never apply on the user's behalf without explicit confirmation.

## ⚠️ Never apply without confirmation

`terraform apply` and `terraform destroy` change real infrastructure and are hard to reverse. State surgery (`state rm`/`mv`, `import`, `taint`, `untaint`) is equally risky. **Always present the plan and get explicit user confirmation before running any of these.** `fmt`, `validate`, and `plan` are safe to run freely.

## Repository layout

<!-- FILL IN: describe the real module/environment layout. Common shape: -->

- `modules/<name>/` — reusable modules (`main.tf`, `variables.tf`, `outputs.tf`, `versions.tf`).
- `environments/<env>/` — per-environment roots (`dev`, `staging`, `prod`) that instantiate modules with environment `*.tfvars`.
- `<global / bootstrap>/` — state backend bootstrap (the S3 bucket + lock table / GCS bucket that holds everyone else's state).
- `.github/workflows/` — CI/CD (plan on PR, apply on merge to `main`).

## Common commands

<!-- FILL IN exact invocations / wrappers (Makefile, Terragrunt). Baseline: -->

```bash
terraform fmt -recursive            # format all .tf
terraform fmt -recursive -check     # CI gate: fail on drift
terraform init                      # init providers + backend (omit -backend=false for real state)
terraform validate                  # syntax + internal consistency
terraform plan  -var-file=<env>.tfvars   # preview changes (safe)
terraform apply -var-file=<env>.tfvars   # CONFIRM WITH USER FIRST
tflint                              # lint (if configured)
checkov -d .                        # policy scan (if configured); or: tfsec .
terraform test                      # native tests (*.tftest.hcl), if present
```

## Architecture

<!-- FILL IN: the real design. Capture the things a fresh session keeps needing:
     - State backend: where state lives, how locking works, one state per env vs. workspaces.
     - Provider/auth model: how credentials reach Terraform locally vs. in CI (OIDC role? profile?).
     - Module boundaries: what each module owns, what's shared, dependency direction.
     - Environment promotion: how a change flows dev → staging → prod.
     - Anything load-bearing and non-obvious (a remote_state data source wiring, a provider alias scheme, etc.). -->

## Configuration & secrets

<!-- FILL IN. Keep this PRINCIPLE verbatim — it is stack-neutral and important: -->

**Never give a required config value an empty or placeholder default.** A missing
required value (a variable, a secret, a backend setting) must fail loudly at
`plan`/`apply` — do NOT paper over it with an empty `default = ""` or any value
that lets Terraform run misconfigured. Empty fallbacks hide misconfiguration and
resurface as confusing drift or partially-built infrastructure later. The fix for
an unset value is to **supply the real value** (via `*.tfvars`, CI secret, or a
secrets manager data source), never to soften the failure.

- Sensitive inputs: `<FILL IN: how secrets are sourced — TF_VAR_*, SSM/Secrets Manager data sources, sops, etc.>`
- Never commit `*.tfstate` (it can contain secrets) or real `*.tfvars` with secrets in them.

## CI/CD

<!-- FILL IN with the real workflow names and triggers. Typical shape: -->

- Open / update a PR → `fmt -check` + `validate` + `tflint`/`checkov` + `terraform plan`, plan posted to the PR.
- Merge to `main` → `terraform apply` for the affected environment(s).
- Auth to the cloud via OIDC (no long-lived keys in CI) — `<FILL IN: role ARN / WIF provider>`.
- CI gates run before any cloud credentials are configured where possible, so lint/format failures block fast.

## GitHub tooling

In Claude Code on the web, `gh` is installed and authenticated and github.com is reachable. Use the right tool for the job:

- **GitHub Projects (v2)**: use the `gh` CLI (`gh project ...`). The GitHub MCP server has no Projects tool.
- **PRs, issues, comments, CI status, reviews, branches, releases, code search**: prefer the GitHub MCP tools (`mcp__github__*`) — they integrate with the PR-activity webhook subscriptions used to watch/autofix PRs. `gh` is a fine fallback.

**Keep the GitHub Project current as we make progress.** When a phase or milestone moves forward (work starts, lands, or gets verified), update the matching Project item / issue in the same session — Status column, checklists, and close the issue on completion. Whenever you change an item's Status, also stamp cycle time (see below).

## Session continuity & memory model

Work spans many fresh (often ephemeral web) sessions. Memory is **layered by how often it changes** — do NOT recreate a monolithic handoff doc each session:

- **Durable knowledge** (architecture, conventions, commands, backend, secrets) lives here in `CLAUDE.md` + the `project-conventions` skill.
- **Per-milestone plans/specs** live in `docs/milestones/M*.md` and the milestone's **epic issue**.
- **Live status** (done / in-flight / blockers / next steps / gotchas) lives in the **epic issue's "Status / Next steps / Gotchas" section** + the GitHub Project board Status column — that is the source of truth. Update the epic issue as work lands; don't let status drift into scratch files.
- A **SessionStart hook** (`.claude/hooks/session-start.sh`) auto-prints orientation (recent commits, open PRs, open milestones, recent issues) at the start of every session.

## Cycle-time tracking (GitHub-native)

Cycle time is tracked in the GitHub Project. The board has per-issue fields for
`Actual Start` / `Actual Finish` (DATE), `Started At` / `Completed At` (ISO TEXT),
and derived `Cycle Minutes` / `Cycle Time`.

### Stamping rule

- **When an issue's Status first leaves `Backlog`** (work starts): set `Actual Start` = today and `Started At` = now, **only if `Actual Start` is currently empty** (idempotent).
- **When an issue moves to `Done`**: set `Actual Finish` = today and `Completed At` = now; compute `Cycle Minutes` and the human-readable `Cycle Time` from the start stamp. If `Started At` was never set, write the finish stamps anyway and skip cycle time with a warning.

> `<FILL IN: re-implement the gh-based stamp helper, or delete this section if not tracking cycle time.>`

## Conventions

- New modules: follow the existing module shape (`main.tf` / `variables.tf` / `outputs.tf` / `versions.tf`); pin provider versions in `versions.tf` and commit `.terraform.lock.hcl`.
- Don't inline magic values; use variables/locals and document non-obvious WHY only.
- Use `<FILL IN: the prod-gating pattern — e.g. a `var.environment == "prod"` guard or workspace check>` to gate anything that should only run for production.
- Any non-trivial computed logic (locals, complex `for`/`dynamic` expressions, a reusable module's contract) ships with a `*.tftest.hcl` (or `terratest`) check in the same change where practical.
- Any change that alters real infra ships only after the `terraform plan` has been reviewed with the user.

## Git Workflow

- Provide a commit message to the user for any changes made.
- Never commit or push directly to `main`. Always work on a feature branch; if checked out on `main`, branch off before staging.
- Run `terraform fmt -recursive -check` and `terraform validate` (+ `tflint`/`checkov` if configured) before every commit and before the final push. All must pass. Never use `--no-verify` to bypass hooks — the same checks run in CI.
- Keep local-only artifacts out of the diff: `.terraform/`, `*.tfstate*`, crash logs. Commit `.terraform.lock.hcl` deliberately; never commit state.
- Don't open PRs unless the user explicitly asks ("open the PR"). The human opens PRs manually after reviewing the branch.
