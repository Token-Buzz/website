import { KMSClient, EncryptCommand, DecryptCommand } from '@aws-sdk/client-kms'

// Module-level client: created once, mockable via vi.mock('@aws-sdk/client-kms')
// or by replacing the exported `kmsClient` in tests that need constructor-level
// control. We never log plaintext or ciphertext.
export let kmsClient = new KMSClient({})

/** Replace the KMS client — for tests only. */
export function _setKmsClient(client: KMSClient): void {
  kmsClient = client
}

function keyId(): string {
  const id = process.env.BYOK_KMS_KEY_ID
  if (!id) throw new Error('BYOK_KMS_KEY_ID env var is not set')
  return id
}

/**
 * Encrypts a short plaintext secret (< 4 KB) with the BYOK KMS key using
 * direct Encrypt (no data-key envelope). Returns the ciphertext as a
 * base64-encoded string.
 */
export async function encryptSecret(plaintext: string): Promise<string> {
  const { CiphertextBlob } = await kmsClient.send(
    new EncryptCommand({
      KeyId: keyId(),
      Plaintext: Buffer.from(plaintext, 'utf-8'),
    }),
  )
  if (!CiphertextBlob) throw new Error('KMS Encrypt returned no ciphertext')
  return Buffer.from(CiphertextBlob).toString('base64')
}

/**
 * Decrypts a base64-encoded ciphertext produced by {@link encryptSecret}.
 * Returns the original plaintext string.
 */
export async function decryptSecret(ciphertext: string): Promise<string> {
  const { Plaintext } = await kmsClient.send(
    new DecryptCommand({
      CiphertextBlob: Buffer.from(ciphertext, 'base64'),
    }),
  )
  if (!Plaintext) throw new Error('KMS Decrypt returned no plaintext')
  return Buffer.from(Plaintext).toString('utf-8')
}
