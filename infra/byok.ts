// Customer-managed KMS key for BYOK per-user API key encryption.
// SST v4 has no first-class KMS component, so we drop to the Pulumi AWS
// provider directly. This key is used by the application to encrypt and
// decrypt user-supplied provider API keys stored in DynamoDB.
//
// Jobs get KMS access in Phase 6 (#112) — do NOT link this key in infra/jobs.ts
// until that milestone to avoid merge conflicts.

export const byokKmsKey = new aws.kms.Key("ByokKey", {
  description: "BYOK per-user API key encryption",
  keyUsage: "ENCRYPT_DECRYPT",
  deletionWindowInDays: 30,
  enableKeyRotation: true,
});

new aws.kms.Alias("ByokKeyAlias", {
  name: $interpolate`alias/website-${$app.stage}-byok`,
  targetKeyId: byokKmsKey.id,
});
