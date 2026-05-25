---
name: tf-checks
description: On-demand Terraform audit. Scans the current branch diff for changed .tf, runs fmt/validate (+ tflint/checkov if present) and a no-apply plan, and reports findings. Use when the user asks to check Terraform, validate changes, or verify before pushing. Advisory only — never applies.
---

# tf-checks — Terraform Change Audit

> Advisory only. This skill reads the diff, runs read-only checks, and reports. It NEVER runs `terraform apply`/`destroy` or any state-mutating command.

## Step 1 — Find what changed on this branch

```bash
git diff --name-only main...HEAD -- '*.tf' '*.tfvars' '*.tf.json'
```

Then inspect the full diff for the changed files:

```bash
git diff main...HEAD -- '*.tf' '*.tfvars'
```

Note which root modules / environments the changes live under — you'll run
`validate`/`plan` from each affected root, not from the repo root blindly.

## Step 2 — Format & static validation

From each changed module/root:

```bash
terraform fmt -recursive -check        # report formatting drift (don't auto-fix in audit mode)
terraform init -backend=false -input=false   # if .terraform is absent on a fresh clone
terraform validate                     # syntax + internal consistency
```

If configured in the repo, also run the linters/policy scanners and capture their summaries:

```bash
tflint
checkov -d .        # or: tfsec .
```

## Step 3 — No-apply plan (only if backend creds are available)

```bash
terraform plan -input=false -lock=false -var-file=<env>.tfvars
```

- Use the correct `-var-file` for the environment being changed.
- This is read-only. If credentials/backend access aren't available in-session,
  **skip this step and say so** — do not invent a plan result.
- Read the plan for surprises: resources being **replaced/destroyed**, unexpected
  drift, or changes outside the intended blast radius.

## Step 4 — Report findings

Structure the report as:

### Formatting
- `terraform fmt -check` → clean, or list the files with drift.

### Validation
- `terraform validate` per affected root → pass/fail with the error if any.
- `tflint` / `checkov` / `tfsec` → counts of findings by severity, with the notable ones.

### Plan summary
- One line: `N to add, M to change, K to destroy` (or "skipped — no backend access").
- **Call out any destroy/replace explicitly** — that's the highest-risk signal.

### Untested logic (if any)
- Note any non-trivial computed locals/expressions or modules that would benefit from
  a `terratest`/native `terraform test` (`*.tftest.hcl`) check, with `file:line`.

## Step 5 — Advisory close

End with an offer, not an action:

> "I can fix the formatting / address the lint+policy findings / add `*.tftest.hcl` coverage for the gaps above. Per this repo's conventions (CLAUDE.md), the actual writing would be dispatched to a Sonnet subagent, and I will NOT run `terraform apply` — you review the plan and apply. Want me to proceed?"

Do not modify any `.tf` files or run any apply/state command unless the user explicitly says yes after reading this report.
