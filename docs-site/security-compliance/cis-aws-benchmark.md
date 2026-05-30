# CIS AWS Foundations Benchmark

TokenBuzz's AWS account is configured against the **CIS AWS Foundations Benchmark v6.0.0**, an industry-standard set of prescriptive security controls for AWS environments published by the Center for Internet Security.

## What the benchmark covers

The CIS AWS Foundations Benchmark defines security best practices across five domains:

| Domain | Examples |
|---|---|
| Identity & Access Management | IAM password policy, MFA enforcement, root account restrictions, Access Analyzer |
| Logging & CloudTrail | Multi-region org-level CloudTrail, log file integrity validation, S3 access logging |
| Monitoring & alerting | Real-time event detection for high-risk API calls (e.g. root sign-in, IAM policy changes, network ACL changes) |
| Networking | Default VPC lockdown, default security group restrictions |
| Storage encryption | S3 Block Public Access, per-bucket TLS-only policies, DynamoDB encryption at rest, EBS default encryption |

## How TokenBuzz implements the benchmark

Controls are divided between two ownership layers:

- **Account/org-wide guardrails** — enforced via Terraform applied from the AWS Organization management account. This covers controls that apply to the whole account: the org-level CloudTrail trail, IAM password policy, IAM Access Analyzer (organization type, deployed per region), default security group lockdown, account-level S3 Block Public Access, and EBS default encryption.
- **Per-resource application controls** — enforced in the application's infrastructure code (SST/Pulumi). This covers controls scoped to specific resources: TLS-only bucket policies, CloudFront HTTPS enforcement, DynamoDB encryption, per-resource IAM roles, and application-side KMS keys.

A controls matrix maintained alongside the infrastructure code maps every CIS v6.0 control to its owner, the file that enforces it, and the current pass/fail status.

## Scope note — serverless architecture

Because TokenBuzz runs entirely on AWS managed services with no long-lived hosts, **OS-level CIS baselines do not apply**. There are no virtual machines, no container hosts to patch, and no SSH access to harden. CIS host-level benchmarks (for Linux, Windows, etc.) are out of scope by design.

## Continuous monitoring

CIS posture is verified continuously using automated benchmark scanning against the live AWS account. Scans:

- Run on a scheduled basis (at minimum, weekly)
- Produce a scored report that maps each check to its CIS control ID, severity, and remediation guidance
- Generate dated evidence artifacts (scan exports and baselines) stored for audit reference
- Feed a scorecard that tracks pass/fail counts over time and surfaces regressions

The baseline scan used as a point-in-time evidence anchor is updated when controls are added or the benchmark version changes.

## Cost-aware control choices

A small number of CIS controls involve paid AWS services. Where the cost is not justified at the current scale, TokenBuzz uses accepted compensating controls in place of the default:

| CIS control area | Default approach | TokenBuzz's compensating control |
|---|---|---|
| Continuous drift detection (CIS Config controls) | AWS Config (per-item recording cost) | Scheduled CIS benchmark scan + Terraform plan-based drift review |
| §5 monitoring alerts (5.1–5.15) | CloudWatch metric-filter alarms | EventBridge rules → SNS (equivalent detection, lower cost) |
| CloudTrail log encryption | AWS KMS CMK | SSE-S3 (server-side encryption still applied; CMK is a toggle available on request) |

These choices are documented in an accepted-risk register. Controls that are bypassed without a compensating measure are not accepted.
