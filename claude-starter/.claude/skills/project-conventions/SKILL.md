---
name: project-conventions
description: Working in this repo. Loads on any non-trivial task — captures workflow rules (branches, commits, subagent dispatch), the technology stack, and common debugging recipes so a fresh session doesn't relearn them.
---

# Project Conventions

> Read this first. It encodes the rules every session should follow regardless of which area you're working on.

## Coding workflow

- **Never commit or push directly to `main`.** Always work on a feature branch. If somehow checked out on `main`, branch off before staging anything.
- **Push only at the end** of a logical unit of work, not after every micro-commit.
- **Don't open PRs from Claude.** The human opens PRs manually after reviewing the branch. Do not run `gh pr create`, `mcp__github__create_pull_request`, or equivalents unless the user has just typed "open the PR".
- **Run the formatter and validators before every commit AND before the final push.** They must pass clean:
  - `terraform fmt -recursive -check` (and `terraform fmt -recursive` to fix)
  - `terraform validate` in each module/root that changed
  - `tflint` and `checkov`/`tfsec` if configured
  Never bypass hooks with `--no-verify` — CI runs the same checks; a push that breaks them blocks the pipeline.
- **Never auto-apply.** `terraform plan` is fine to run; `terraform apply` / `destroy` change real infrastructure — always show the plan and get explicit user confirmation before applying. Treat state operations (`state rm`, `state mv`, `import`, `taint`) as destructive too.
- **Don't commit local-only artifacts.** Keep `.terraform/`, `*.tfstate`, `*.tfstate.backup`, `.terraform.lock.hcl` conflicts, and crash logs out of the diff. Commit `.terraform.lock.hcl` intentionally (it pins providers) but never `*.tfstate`.
- **Best practices over cleverness.** Match the patterns already in the codebase. Don't invent module abstractions for hypothetical reuse. Don't add comments that just restate the HCL — only document non-obvious WHY.

## Commit messages

- One concise subject line; expand in the body only if the WHY isn't obvious from the diff.
- Reference the resource/module/feature, not the task ID. The PR description is for task context.
- The harness expects the session URL as the final line — keep that footer.

## Subagent dispatch

Use subagents for any work that fits — they keep the main context window clean and they're cheaper for routine work.

- **Sonnet** — moderate scope: a new module, a refactor that touches several resources, a focused investigation. Default choice.
- **Haiku** — trivial scope: porting one more resource to match an existing pattern, a tiny variable/output fix, a single-line config tweak.
- **Opus** (this model) — orchestration, complex multi-step planning, the actual decision-making. Don't delegate judgement; delegate execution.

When dispatching, write the prompt as if briefing a smart colleague who just walked in cold:
- State the goal in one sentence.
- List which files/modules to touch and which not to touch.
- Point at the existing pattern to mirror.
- Require: `fmt` + `validate` (+ lint) pass, no `apply`, single push at end, no PR.
- Cap the report length (e.g. "Report under 250 words").

Parallel agents when work is independent. Use `run_in_background: true` to keep the conversation responsive.

## Project board & cycle-time stamping

The GitHub Project (<FILL IN: number + owner>) is the source of truth for status. Keep it current as work lands, and stamp cycle time whenever you change an item's Status:

- **Leaving `Backlog`** (work starts): stamp `Actual Start` (date) + `Started At` (ISO), only if not already stamped.
- **Reaching `Done`**: stamp `Actual Finish` + `Completed At` and compute `Cycle Time` / `Cycle Minutes` from the start stamp.

> The source repo shipped a `gh`-based stamp helper script. Re-implement an equivalent small script here, or delete this section if you won't track cycle time. Manual Status changes made in the GitHub UI won't be stamped — stamp from the session when you move an item.

## Technology stack

<!-- FILL IN with the new repo's real versions. Example shape: -->

| Component | Version / detail |
|---|---|
| IaC | Terraform `<x.y>` |
| Provider(s) | `<aws / google / azurerm / ...>` `<version>` |
| Module layout | `<modules/ + environments/{dev,prod} / Terragrunt / flat>` |
| State backend | `<s3 + dynamodb lock / gcs / tfc>` |
| Lint / policy | `<tflint / checkov / tfsec / OPA>` |
| CI/CD | `<GitHub Actions workflow names>` |

> Architecture, module layout, and exact commands live in `CLAUDE.md` — don't duplicate them here.

## Debugging recipes

<!-- FILL IN over time. Whenever a session finds a useful diagnostic command, add it here.
     Suggested categories:
       - State: inspecting/listing/moving state, finding drift (terraform plan -refresh-only)
       - Providers: pinning, lockfile regen (terraform providers lock), auth errors
       - Plan reading: targeting a single resource, -var-file selection per env
       - CI: how to reproduce a failing pipeline check locally
     Keep each recipe as a runnable snippet, not prose. -->

## Things this repo has tripped over before

<!-- FILL IN as bugs get diagnosed. The format should be:
       - **Symptom**: what the user sees
       - **Cause**: the actual underlying issue
       - **Fix**: the change that resolved it
     The point of this section is to recognise repeats. Don't paste full investigations;
     summarise in 2-3 lines per item. -->

## Things to keep out of this file

- Implementation details about specific modules/resources. Those go in CLAUDE.md or a feature-specific skill.
- Anything that changes per session (current branch, current PR number, the active phase of work). Those rot — keep this file evergreen.
- Secrets, credentials, state contents, or anything you'd be uncomfortable seeing on GitHub.
