# compliance-cis-6.0 — sibling repository overview

Context dump for Claude sessions running in `Token-Buzz/website`. The compliance work lives in a sibling repo, [`Token-Buzz/compliance-cis-6.0`](https://github.com/Token-Buzz/compliance-cis-6.0), and the two need to stay coordinated. Read this before suggesting changes that touch IAM, S3 policies, CloudFront TLS, KMS, CloudTrail, account-wide settings, or anything else that might overlap with a CIS control.

The repo's own [`README.md`](https://github.com/Token-Buzz/compliance-cis-6.0/blob/main/README.md) is the authoritative entrypoint inside that tree — this file is a pointer + a cheat sheet so a fresh session here doesn't have to clone it to know what's there.

## What it is

Security & compliance artifacts for Token-Buzz, aligned to the **CIS AWS Foundations Benchmark v6.0.0**. It is the deliverable of milestone **M12 — Security & Compliance** (epic: [Token-Buzz/website#130](https://github.com/Token-Buzz/website/issues/130); both repos share GitHub Project #1).

It contains:

- **Terraform** for the account/org-wide CIS guardrails (the only IaC in either repo that runs from the org-management / delegated-admin account).
- The **controls matrix** — every CIS v6.0 control mapped to its owner and its IaC file.
- **Security policies** (access control, change mgmt, logging, IR, vendor).
- **Dated baselines** — Prowler v4 scans (HTML + JSON) used as point-in-time evidence.
- **Dated evidence** — SBOMs, attestations, scan exports.
- A scheduled **CIS re-scan workflow** + scorecard for continuous monitoring.

Out of scope on purpose: OS/host CIS baselines (the stack is serverless — no long-lived hosts).

## Ownership boundary — who owns which CIS control

This is the part that matters when working in `website`. The split is enforced by `controls-matrix.md` in the compliance repo.

| Owner tag | Lives in | Examples |
| --- | --- | --- |
| **TF-account** | `compliance-cis-6.0` (`modules/*` wired by `environments/org-foundation/`) | CloudTrail (org trail), IAM Access Analyzer, IAM password policy, account contacts, account-level S3 Block Public Access, default-SG lockdown, EBS default encryption, support role |
| **SST-app** | `Token-Buzz/website` (`infra/*.ts`) | Per-bucket S3 settings (TLS-only policy, encryption), CloudFront TLS / viewer policy, DynamoDB encryption, per-resource IAM, app-side KMS keys, VPC flow logs on app VPCs (if any) |
| **Manual** | `compliance-cis-6.0/docs/policies/` + evidence | Root MFA, root key rotation, per-user MFA enrollment, federation choices, behavioral controls |
| **Split** | both | S3 BPA (account + per-bucket), CMK rotation (account-side + app-side), VPC flow logs (default VPC + app VPCs), `*:*` policy detection (TF-managed vs. detect-elsewhere) |

**Rule of thumb when working in `website`:** if a control is **resource-scoped** (a property of an `sst.aws.Bucket`, `sst.aws.Router`, `sst.aws.Dynamo`, etc.), it belongs in `infra/*.ts` next to the resource — don't try to enforce it from the compliance repo or it will drift. If it is **account/org-wide**, it belongs in the compliance repo's `modules/`. If you're unsure, the `controls-matrix.md` in the compliance repo is authoritative.

## Repo layout (high level)

```
compliance-cis-6.0/
├── controls-matrix.md            # Every CIS v6.0.0 control → owner + IaC file (authoritative)
├── modules/                      # Reusable TF modules — the account/org guardrails
│   ├── iam-baseline/             # Password policy, contacts, support role, account S3 BPA
│   ├── cloudtrail/               # Multi-region org trail (SSE-S3 by default; CMK toggle)
│   ├── access-analyzer/          # Per-region ORGANIZATION-type analyzer
│   ├── config/                   # AWS Config (off by default — cost)
│   ├── security-hub/             # Security Hub (off by default — cost)
│   ├── guardduty/                # GuardDuty (cost-gated)
│   ├── monitoring-events/        # CIS §5.1–5.15 via free EventBridge → SNS
│   ├── cloudwatch-metric-alarms/ # Paid §5 alternative (opt-in)
│   ├── vpc-baseline/             # Default-VPC lockdown + flow logs
│   └── regional/                 # Per-region fanout glue
├── environments/
│   └── org-foundation/           # The root that wires modules together (apply target)
├── global/backend-bootstrap/     # One-time S3 + DDB (or S3 native lock) remote-state setup
├── docs/policies/                # Security policy set (right-sized for a small SaaS)
│   ├── README.md
│   └── accepted-risks.md         # SSE-S3 vs CMK, Config off, Security Hub off, etc.
├── baselines/<date>/             # Dated Prowler runs (HTML + JSON) + run config
├── evidence/<date>/              # SBOMs, attestations, exports
└── .github/workflows/
    ├── terraform.yml             # PR gate: fmt + validate + lint (credential-free)
    └── terraform-deploy.yml      # plan on PR (comment), apply on merge (OIDC)
```

## Cost posture (important context)

The default deployment targets **< $1/month**. It does this by keeping the **free** controls fully enabled and substituting **compensating controls** for the paid ones:

- **AWS Config**: off by default → covered by the scheduled Prowler scan + `terraform plan` drift.
- **Security Hub**: off by default → same compensating coverage.
- **CloudTrail KMS CMK (CIS 4.5)**: uses **SSE-S3** by default (free, encrypted at rest, not a CMK). `create_kms_key=true` flips it to a CMK (+~$1/mo).
- **CIS §5 monitoring (5.1–5.15)**: free **EventBridge → SNS** rules instead of paid CloudWatch metric-filter alarms (~$1.50/mo + Logs ingest). The paid alarm variant is in `modules/cloudwatch-metric-alarms/`, toggled by the `ENABLE_CLOUDWATCH_ALARMS` repo variable + `MONITORING_TRAIL_LOG_BUCKET_NAME` (flips §5 from FAIL → PASS at ~$2–3/mo).

The accepted-risk register is `compliance-cis-6.0/docs/policies/accepted-risks.md`. The "Cost posture" section of `controls-matrix.md` lists the toggles in one place.

## Apply model (read-only-by-default safety)

- Applied from the AWS **Organization management or delegated-admin** account (org CloudTrail, ORGANIZATION-type Access Analyzer, Config aggregator).
- Home region is `us-east-1`.
- CIS 4.9 (S3 **read** data-event logging) is scoped to `s3_read_event_bucket_arns` to cap cost — don't add buckets blindly.
- **`terraform apply` / `destroy` and state surgery (`state rm`/`mv`, `import`, `taint`) are never run without explicit user confirmation.** `fmt` / `validate` / `plan` are safe.
- Apply path:

  ```bash
  # 1. one-time: create the remote-state backend (uses local state)
  cd global/backend-bootstrap && terraform init && terraform apply   # CONFIRM FIRST

  # 2. the guardrails (run from the Org management / delegated-admin account)
  cd environments/org-foundation
  terraform init -backend-config=backend.hcl
  cp terraform.tfvars.example terraform.tfvars   # fill required values; never commit it
  terraform plan -var-file=terraform.tfvars      # review before any apply
  ```

## CI/CD

Two workflows, split by whether they touch the cloud:

- **`.github/workflows/terraform.yml`** — credential-free gate on every PR + push to `main`/`claude/**`: `fmt -check` + `validate` (`-backend=false`) + `tflint`/`checkov` (soft-fail). `permissions: contents: read` only.
- **`.github/workflows/terraform-deploy.yml`** — authenticated via **GitHub OIDC** (`id-token: write`) assuming the role in the `AWS_ROLE_ARN` secret. PR → `terraform plan` posted as a collapsed PR comment. Merge to `main` → `terraform apply -auto-approve`. Applies are serialized via `concurrency` and never cancelled mid-run.

Required repo settings (Settings → Secrets and variables → Actions):
- Secret: `AWS_ROLE_ARN` — trust policy must allow `token.actions.githubusercontent.com` for `Token-Buzz/compliance-cis-6.0`.
- Variables: `TF_STATE_BUCKET`, `TRAIL_LOG_BUCKET_NAME`, `CONFIG_LOG_BUCKET_NAME`.
- Optional: `ENABLE_CLOUDWATCH_ALARMS`, `MONITORING_TRAIL_LOG_BUCKET_NAME` (CIS §5 paid-alarm opt-in).

State locking is S3-native (`use_lockfile`) — no DynamoDB lock-table variable needed.

## Benchmark / evidence tool

**Prowler v4** (CIS AWS Foundations) — a single read-only IAM-role run, CIS-native with per-check severity + remediation, emitting JSON reused by the continuous-monitoring scorecard. Baselines drop into `baselines/<date>/`, evidence (SBOMs, attestations) into `evidence/<date>/`.

## Cross-repo coordination

- The **M12 spec** is meant to live at `docs/milestones/M12-security-compliance.md` here in `website` (not yet written as of this note). The compliance repo's README links to it.
- The **M12 epic** (live status, phase checklist, next steps) is [Token-Buzz/website#130](https://github.com/Token-Buzz/website/issues/130) — *not* in the compliance repo. Both repos' work is tracked on shared GitHub Project #1.
- When a CIS control owner changes (e.g. a new app bucket gains a TLS-only policy in `infra/`), update `controls-matrix.md` in the compliance repo in the same change — it is the source of truth for "who enforces what."
- Per-resource controls added in this repo's `infra/*.ts` should reference the CIS control ID in a brief comment so a reviewer can trace `controls-matrix.md` → IaC without grepping.

## When to defer to the compliance repo

Open a PR (or at least an issue) on `compliance-cis-6.0` instead of changing things here when:

- The control is account/org-wide (CloudTrail, Config, Access Analyzer, password policy, account contacts, default-SG, default EBS encryption, account-level S3 BPA).
- You need to flip a cost toggle (Config on, Security Hub on, CMK for CloudTrail, paid §5 alarms).
- You're adjusting which buckets get S3 **read** data-event logging.
- You're touching the `AWS_ROLE_ARN` role's trust policy or permissions used by either repo's GitHub Actions.

Everything resource-scoped stays here in `website/infra/*.ts`.
