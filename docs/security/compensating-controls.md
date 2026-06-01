# Compensating Controls — Deferred CIS AWS Foundations Benchmark v6.0 Level 2

## Purpose

TokenBuzz's AWS account is hardened to and has **passed the CIS AWS Foundations
Benchmark v6.0 Level 1** (verified by a passing Prowler scan). We have made a
**deliberate, cost-based decision not to pursue CIS Level 2.**

This document is the auditable record of that decision. For every Level 2 (or
beyond-Level-1 best-practice) control we are deferring, it states:

- the **residual risk** the control would have mitigated,
- the **compensating control(s)** already in place (largely from the L1
  baseline) that reduce that risk to an acceptable level, and
- a **formal risk acceptance** (owner, date, review cadence).

"We did not implement control X" is an audit finding. "We did not implement X
because compensating control Y reduces the risk, formally accepted by the
Security Lead on a given date and reviewed annually" is a defensible, auditable
risk-treatment decision — which is what SOC 2 Type II and ISO 27001 assessors
expect. This register exists so the posture stays auditable even though we stop
at Level 1.

## Scope & framework

- **Framework:** CIS AWS Foundations Benchmark **v6.0**.
- **Level 1:** achieved and certified (passing Prowler scan) — the baseline.
- **Level 2:** **declined** on cost/effort grounds; risk-treated via the
  compensating controls below.
- **Review cadence:** this register is revisited on the **next annual Prowler
  re-scan**, or sooner if a customer, contract, or new compliance commitment
  (SOC 2 / ISO 27001 / regulated data) requires Level 2 controls.

## L1 baseline already in place (the compensating controls referenced below)

| Domain | Controls in place |
|---|---|
| Logging | CloudTrail (multi-region, log-file validation), S3 access logging, VPC flow logs |
| Config & posture | AWS Config (all regions), AWS Security Hub with the CIS standard, Prowler scheduled scans |
| Threat detection | Amazon GuardDuty, SNS alerting to the ops channel |
| Identity | IAM password policy, **MFA enforced for all human access**, least-privilege IAM roles, no long-lived keys where avoidable |
| Data protection | KMS with automatic key rotation, S3 default encryption, TLS everywhere, secrets in SSM / Secrets Manager |
| Network | VPC segmentation (no public DB), security-group least privilege, AWS Shield Standard, CloudFront edge |
| Availability | DynamoDB Point-in-Time Recovery (PITR) |

## How to read the register

Each entry has:

- **Deferred control** — the CIS v6.0 section/control and short title, marked
  *L2* (or *beyond-L1* for best-practice items not scored at L1).
- **Reason for deferral** — why we are not implementing it (typically cost or
  operational overhead disproportionate to our risk profile).
- **Residual risk** — what the control would have mitigated, i.e. the exposure
  we are accepting.
- **Compensating control(s)** — the L1 baseline controls (and any other
  mitigations) that already reduce that risk.
- **Risk acceptance** — owner, acceptance date, and review trigger.

> Default risk-acceptance attribution for every entry below, unless stated
> otherwise — **Owner:** Security Lead · **Accepted:** 2026-06-01 ·
> **Review:** next annual Prowler scan.

---

## Register

### 1. S3 object-level CloudTrail data-event logging (CIS §3 — L2)

- **Reason for deferral:** Object-level (read + write) data-event logging on S3
  generates high event volume and incremental CloudTrail/S3 storage cost that is
  disproportionate to our data footprint.
- **Residual risk:** Reduced forensic granularity into individual S3
  object access (who read/wrote a specific object) during an investigation.
- **Compensating control(s):** Multi-region **CloudTrail** management-event
  logging with log-file validation captures all control-plane S3 actions
  (bucket policy, ACL, configuration changes); **S3 server-access logging** is
  enabled; **GuardDuty S3 protection** flags anomalous access patterns;
  least-privilege IAM tightly scopes who can reach each bucket.
- **Risk acceptance:** default.

### 2. Centralized logging to a dedicated, separate logging account (CIS §3 — L2)

- **Reason for deferral:** A dedicated log-archive account / multi-account
  Organizations structure is operational overhead beyond our single-account
  footprint and budget.
- **Residual risk:** Logs share the same account as workloads, so an account
  compromise could in principle target log integrity.
- **Compensating control(s):** CloudTrail **log-file validation** detects
  tampering; the log bucket is access-logged with restrictive bucket policies
  and least-privilege IAM; **Security Hub** + **Config** continuously monitor
  the logging configuration for drift; CloudTrail is multi-region so a
  single-region disablement is detectable.
- **Risk acceptance:** default.

### 3. AWS Config full recording in all regions incl. global resources (CIS §2/§3 — L2)

- **Reason for deferral:** Continuous recording of every resource type in every
  region (including idle regions) and an expanded conformance-pack rule set adds
  per-region Config cost with little benefit given our concentrated regional
  footprint.
- **Residual risk:** Slower or absent drift detection for resources created in
  unused regions.
- **Compensating control(s):** **AWS Config** is enabled in the regions we
  operate in; **region guardrails** discourage resource creation in unused
  regions; **Security Hub CIS standard** + **scheduled Prowler scans** would
  surface unexpected resources account-wide; **GuardDuty** is multi-region.
- **Risk acceptance:** default.

### 4. Hardware MFA for the root account (CIS §1 — L2)

- **Reason for deferral:** L1 requires MFA on root; L2 prefers a *hardware*
  token. Procuring, registering, and securely storing a hardware key for a
  rarely-used root account is operational overhead we are deferring.
- **Residual risk:** Virtual MFA is marginally more exposed than a hardware
  token (e.g. if the seed device is compromised).
- **Compensating control(s):** Root has **virtual MFA enforced** (L1), root
  access keys are removed, root is not used for day-to-day operations, and
  **CloudTrail + a CloudWatch alarm** flag any root login. Day-to-day access is
  via least-privilege IAM with MFA.
- **Risk acceptance:** default.

### 5. IAM Access Analyzer + automated unused-credential / access reviews (CIS §1 — L2)

- **Reason for deferral:** L2-depth continuous access analysis and an automated
  periodic access-review workflow are deferred until the GRC program (M12 Phase
  11, #279) formalizes review cadence.
- **Residual risk:** Over-permissive or stale IAM grants could persist longer
  between manual reviews.
- **Compensating control(s):** Least-privilege IAM roles are the default; **MFA
  enforced**; long-lived keys avoided; **CloudTrail** records all IAM changes;
  **Security Hub** flags credential-hygiene findings (unused credentials, old
  keys). Formal periodic access reviews are scheduled under Phase 11 (#279).
- **Risk acceptance:** default.

### 6. Extended VPC flow-log retention + dedicated SIEM (CIS §5 — L2)

- **Reason for deferral:** A dedicated SIEM and long flow-log retention carry
  recurring ingestion/storage cost disproportionate to our current scale.
- **Residual risk:** Shorter network-telemetry retention and no centralized
  correlation layer reduce long-tail investigative depth.
- **Compensating control(s):** **VPC flow logs** are enabled; **GuardDuty**
  performs continuous network-threat detection on VPC/DNS/flow telemetry;
  **Security Hub** aggregates findings; **SNS alerting** routes findings to ops.
  Security Hub effectively serves as a lightweight findings aggregator.
- **Risk acceptance:** default.

### 7. Customer-managed CMKs for every service (CIS §2 — L2)

- **Reason for deferral:** L1 is satisfied with encryption-at-rest using
  AWS-managed keys where appropriate; mandating customer-managed CMKs (with the
  associated key policies and rotation management) for *every* service adds key
  administration overhead and per-key cost.
- **Residual risk:** Less granular per-service key isolation and key-policy
  control than full CMK coverage would provide.
- **Compensating control(s):** **Encryption at rest is enabled everywhere**
  (S3, DynamoDB, logs); **KMS with automatic rotation** is in use; **customer-
  managed CMKs are used for the most sensitive stores**; key usage is logged via
  CloudTrail and monitored by Security Hub/Config.
- **Risk acceptance:** default.

### 8. CloudFront WAF managed rule sets + rate-based rules (beyond-L1 edge protection)

- **Reason for deferral:** AWS WAF web ACLs with managed rule groups and
  rate-based rules carry per-request and per-rule cost; this is best-practice
  edge protection rather than a scored L1 control, and is deferred on cost.
- **Residual risk:** Reduced automated mitigation of layer-7 attacks (common web
  exploits, bot floods, application-layer DDoS).
- **Compensating control(s):** **AWS Shield Standard** (automatic L3/L4 DDoS
  protection) is in place at the CloudFront edge; **Clerk** provides
  authentication/authorization on protected routes; application routes apply
  per-user gating; **GuardDuty** + **CloudWatch/SNS alerting** surface anomalous
  traffic. *Partial:* edge delivery and Shield Standard are active; the advanced
  WAF rule layer is the deferred portion.
- **Risk acceptance:** default — revisit if traffic profile or abuse warrants.

### 9. Restrict every VPC default security group + stricter egress filtering (CIS §5 — L2)

- **Reason for deferral:** Tightening egress to an explicit allow-list across all
  VPCs (and continuously maintaining it) is operational overhead beyond the L1
  ingress least-privilege posture.
- **Residual risk:** Broader-than-necessary outbound paths could ease data
  exfiltration if a workload were compromised.
- **Compensating control(s):** **Security-group least privilege on ingress**
  (L1); **no public database / VPC segmentation**; **VPC flow logs** +
  **GuardDuty** detect anomalous egress; **Config** monitors security-group
  drift. The default security group is unused by workloads.
- **Risk acceptance:** default.

### 10. Extended CloudTrail log metric filters & alarms (CIS §4 — L2)

- **Reason for deferral:** L1 covers the core metric-filter alarms; the full L2
  alarm set (e.g. additional API-call and configuration-change alarms) adds
  CloudWatch alarm volume/cost for lower-frequency events.
- **Residual risk:** Some lower-severity configuration-change events are detected
  on the next scan rather than alarmed in near-real-time.
- **Compensating control(s):** Core **CloudWatch metric-filter alarms** (root
  login, unauthorized API calls, IAM/policy changes) are in place (L1);
  **Security Hub CIS standard** continuously evaluates the broader control set;
  **scheduled Prowler scans** catch drift; **GuardDuty** covers threat-class
  events; alerts route via **SNS**.
- **Risk acceptance:** default.

### 11. S3 MFA Delete on critical buckets (CIS §2 — L2)

- **Reason for deferral:** MFA Delete requires root-credential management to
  toggle and complicates automated lifecycle operations; the overhead is
  disproportionate for our bucket set.
- **Residual risk:** Object versions in critical buckets could be deleted without
  a second MFA factor by a sufficiently privileged principal.
- **Compensating control(s):** **S3 versioning** + restrictive **bucket
  policies** + **least-privilege IAM** limit who can delete; **CloudTrail**
  records all delete actions; **default encryption** + **server-access logging**
  are enabled; DynamoDB (our primary store) has **PITR**.
- **Risk acceptance:** default.

---

## Aggregate risk-acceptance statement

Across the deferred Level 2 controls above, the **overall residual risk is
assessed as LOW.** TokenBuzz operates a hardened, **CIS v6.0 Level 1-certified**
AWS account with **continuous monitoring** (Prowler scheduled scans, AWS
Security Hub with the CIS standard, AWS Config drift detection, and Amazon
GuardDuty threat detection), enforced **MFA**, **least-privilege IAM**,
**encryption at rest and in transit**, **network segmentation**, and **tested
backups (DynamoDB PITR)**. The deferred L2 controls would add incremental
defense-in-depth and forensic depth but are not required to keep residual risk
within tolerance at our current scale and data sensitivity.

This residual risk is **formally accepted by the Security Lead on 2026-06-01**,
to be **reviewed at the next annual Prowler re-scan** — or sooner upon a
contractual or regulatory requirement for CIS Level 2, SOC 2 Type II, ISO 27001,
or regulated-data handling, at which point the relevant entries above will be
re-evaluated and remediated as needed.

---

_Tracked in M12 Phase 10 (issue #357)._
