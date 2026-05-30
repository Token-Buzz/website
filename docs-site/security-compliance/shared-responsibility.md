# Shared Responsibility Model

Security in a cloud-based SaaS product is a joint responsibility: AWS secures the physical infrastructure, TokenBuzz secures the application and its configuration, and users are responsible for their own credentials and account access. This page makes those boundaries explicit.

## Summary table

| Layer | Responsible party | Examples |
|---|---|---|
| Physical data centers, hardware, and network fabric | **AWS** | Facility security, hardware failure, network isolation between customers |
| Managed service availability and durability | **AWS** | DynamoDB replication, Lambda execution environment, CloudFront edge |
| Hypervisor and host OS patching | **AWS** | Patches applied by AWS; TokenBuzz has no OS-level access |
| Account-wide security guardrails | **TokenBuzz** | IAM password policy, root MFA, CloudTrail, IAM Access Analyzer, default VPC lockdown |
| Application security configuration | **TokenBuzz** | Per-resource IAM roles, CloudFront TLS enforcement, S3 TLS-only policies, DynamoDB encryption |
| Application code and dependency security | **TokenBuzz** | Dependency updates, secure coding practices, input validation |
| Secrets and credentials management | **TokenBuzz** | SSM Parameter Store for application secrets; KMS encryption for BYOK credentials |
| Compliance monitoring | **TokenBuzz** | Automated CIS benchmark scanning, controls matrix, accepted-risk register |
| User login credentials and password choice | **User** | Creating a strong password, not sharing account access |
| Multi-factor authentication enrollment | **User** | Enabling and maintaining MFA on the TokenBuzz account |
| Security of BYOK provider keys | **User** | Generating keys with the minimum required permissions, revoking compromised keys promptly |
| Security of the device used to access TokenBuzz | **User** | Keeping the browser and OS up to date, using a trusted device |

## What AWS is responsible for

AWS operates the underlying infrastructure that TokenBuzz runs on. Under the [AWS Shared Responsibility Model](https://aws.amazon.com/compliance/shared-responsibility-model/), AWS is responsible for the security *of* the cloud — the physical facilities, hardware, networking, and the managed service layer. This includes:

- Physical access controls at AWS data centers
- Durability and availability of managed services (DynamoDB, Lambda, CloudFront, S3)
- Hypervisor security and isolation between AWS customers
- Patching the host operating system for managed compute (Lambda runs without an OS visible to TokenBuzz)
- Hardware-level encryption and key management for SSE-managed keys

## What TokenBuzz is responsible for

TokenBuzz is responsible for the security *in* the cloud — how it configures AWS services, how it writes and deploys its application, and how it protects data it holds on behalf of users. Specifically:

**Account and org-wide controls**
- Root account MFA is enforced; root credentials are not used for day-to-day operations.
- Multi-region CloudTrail is enabled at the AWS Organizations level, logging all API activity.
- IAM Access Analyzer (organization type) is deployed per region to surface overly permissive policies.
- IAM password policy enforces minimum complexity and rotation requirements.
- Default VPC is locked down; default security groups have no inbound rules.

**Per-resource application controls**
- CloudFront enforces HTTPS for all traffic; HTTP is not accepted on authenticated routes.
- S3 buckets have TLS-only bucket policies that reject unencrypted connections.
- DynamoDB tables use AWS-managed server-side encryption at rest.
- User-supplied BYOK credentials are additionally encrypted at the application layer using a dedicated AWS KMS customer-managed key before being written to storage.
- Each application component (web server, background jobs) has a scoped IAM role with only the permissions it requires — no wildcard policies.
- Application secrets (API keys, service credentials) are stored in AWS SSM Parameter Store and never committed to the codebase.

**Monitoring and compliance**
- AWS account configuration is continuously verified against the CIS AWS Foundations Benchmark v6.0.0 using automated scanning.
- A controls matrix documents every CIS control, its enforcement mechanism, and its current status.
- Cost-justified compensating controls are documented in an accepted-risk register; no control is silently bypassed.

## What users are responsible for

Users are responsible for the security of their own account access and the credentials they choose to supply to TokenBuzz.

**Account credentials**
- Choose a strong, unique password for your TokenBuzz account (or use social OAuth sign-in).
- Enable multi-factor authentication (MFA) in Account settings. MFA is available to all users; TokenBuzz strongly recommends it.
- Do not share your account credentials with others.
- Sign out of shared or untrusted devices when you are done.

**BYOK provider keys**
- When generating API keys for third-party providers (Twitter/X, Reddit, Telegram), grant only the permissions your use case requires — do not supply admin-level keys.
- Rotate or revoke compromised keys promptly. You can remove a stored key from Account settings at any time; deletion takes effect immediately.
- TokenBuzz encrypts the keys you supply and never displays them in full, but you remain the generator and owner of those credentials. If a provider key is exposed outside TokenBuzz, the remediation is to revoke and replace the key at the provider.

**Device and browser security**
- Keep your operating system, browser, and any authenticator app up to date.
- Use a trusted, malware-free device to access your account.

## Incident reporting

If you suspect unauthorized access to your account or discover a security vulnerability in the TokenBuzz platform, please report it immediately through the contact form at [tokenbuzz.app](https://tokenbuzz.app). For account compromise, also change your password and revoke any active sessions from Account settings.
