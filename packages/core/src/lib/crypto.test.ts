import { beforeEach, describe, expect, test, vi } from 'vitest'

// vi.hoisted ensures the mock send fn is initialised before vi.mock() runs
// (vi.mock is hoisted to the top of the file by Vite's transform, so any
// const in module scope that it references would be uninitialized TDZ).
const mockSend = vi.hoisted(() => vi.fn())

// Mock @aws-sdk/client-kms BEFORE importing crypto.ts so the module-level
// KMSClient constructor is replaced immediately.
vi.mock('@aws-sdk/client-kms', async (importActual) => {
  const actual = await importActual<typeof import('@aws-sdk/client-kms')>()
  return {
    ...actual,
    KMSClient: vi.fn().mockImplementation(() => ({
      send: mockSend,
    })),
  }
})

// Import after mock so the module-level `new KMSClient({})` uses the mock.
import { encryptSecret, decryptSecret } from './crypto'
import { EncryptCommand, DecryptCommand } from '@aws-sdk/client-kms'

const FAKE_KEY_ID = 'arn:aws:kms:us-east-1:123456789012:key/fake-key-id'
const PLAINTEXT = 'my-secret-api-key'
const CIPHERTEXT_BYTES = Buffer.from('fake-ciphertext-bytes')
const CIPHERTEXT_B64 = CIPHERTEXT_BYTES.toString('base64')

beforeEach(() => {
  vi.clearAllMocks()
  process.env.BYOK_KMS_KEY_ID = FAKE_KEY_ID
})

describe('encryptSecret', () => {
  test('issues an EncryptCommand with the correct KeyId and Plaintext', async () => {
    mockSend.mockResolvedValueOnce({ CiphertextBlob: CIPHERTEXT_BYTES })

    const result = await encryptSecret(PLAINTEXT)

    expect(mockSend).toHaveBeenCalledOnce()
    const [cmd] = mockSend.mock.calls[0]
    expect(cmd).toBeInstanceOf(EncryptCommand)
    expect(cmd.input.KeyId).toBe(FAKE_KEY_ID)
    // Plaintext is sent as a Buffer; compare as string.
    expect(Buffer.from(cmd.input.Plaintext).toString('utf-8')).toBe(PLAINTEXT)
    expect(result).toBe(CIPHERTEXT_B64)
  })

  test('throws if BYOK_KMS_KEY_ID is not set', async () => {
    delete process.env.BYOK_KMS_KEY_ID
    await expect(encryptSecret(PLAINTEXT)).rejects.toThrow('BYOK_KMS_KEY_ID')
  })

  test('throws if KMS returns no ciphertext blob', async () => {
    mockSend.mockResolvedValueOnce({ CiphertextBlob: undefined })
    await expect(encryptSecret(PLAINTEXT)).rejects.toThrow('no ciphertext')
  })
})

describe('decryptSecret', () => {
  test('issues a DecryptCommand with the correct CiphertextBlob and returns plaintext', async () => {
    const plaintextBytes = Buffer.from(PLAINTEXT, 'utf-8')
    mockSend.mockResolvedValueOnce({ Plaintext: plaintextBytes })

    const result = await decryptSecret(CIPHERTEXT_B64)

    expect(mockSend).toHaveBeenCalledOnce()
    const [cmd] = mockSend.mock.calls[0]
    expect(cmd).toBeInstanceOf(DecryptCommand)
    // CiphertextBlob passed in is the base64-decoded bytes.
    expect(Buffer.from(cmd.input.CiphertextBlob).toString('base64')).toBe(CIPHERTEXT_B64)
    expect(result).toBe(PLAINTEXT)
  })

  test('throws if KMS returns no plaintext', async () => {
    mockSend.mockResolvedValueOnce({ Plaintext: undefined })
    await expect(decryptSecret(CIPHERTEXT_B64)).rejects.toThrow('no plaintext')
  })
})
