import { describe, it, expect } from 'vitest'
import {
  parseManifestVersion,
  resolvePreviousTag,
  parseCommitSubjects,
  buildNotesMessages,
  parsePrNumbers,
} from './release-notes-pure.js'

// ---------------------------------------------------------------------------
// parsePrNumbers
// ---------------------------------------------------------------------------
describe('parsePrNumbers', () => {
  it('returns PR numbers from a normal array', () => {
    expect(parsePrNumbers('[{"number":184},{"number":190}]')).toEqual([184, 190])
  })

  it('returns [] for empty string', () => {
    expect(parsePrNumbers('')).toEqual([])
  })

  it('returns [] for whitespace-only string', () => {
    expect(parsePrNumbers('   ')).toEqual([])
  })

  it('returns [] for empty array', () => {
    expect(parsePrNumbers('[]')).toEqual([])
  })

  it('returns [] for non-array input (object)', () => {
    expect(parsePrNumbers('{}')).toEqual([])
  })

  it('drops items missing a numeric number field', () => {
    expect(parsePrNumbers('[{"number":5},{"foo":1},{"number":"x"}]')).toEqual([5])
  })

  it('drops items where number is a float (non-integer)', () => {
    expect(parsePrNumbers('[{"number":5},{"number":1.5}]')).toEqual([5])
  })
})

// ---------------------------------------------------------------------------
// parseManifestVersion
// ---------------------------------------------------------------------------
describe('parseManifestVersion', () => {
  it('returns the version for the "." key', () => {
    const manifest = JSON.stringify({ '.': '0.7.0' })
    expect(parseManifestVersion(manifest)).toBe('0.7.0')
  })

  it('ignores other keys and returns only the "." value', () => {
    const manifest = JSON.stringify({ '.': '1.2.3', other: '9.9.9' })
    expect(parseManifestVersion(manifest)).toBe('1.2.3')
  })

  it('handles a patch version', () => {
    const manifest = JSON.stringify({ '.': '0.6.2' })
    expect(parseManifestVersion(manifest)).toBe('0.6.2')
  })

  it('throws when the "." key is missing', () => {
    const manifest = JSON.stringify({ 'packages/foo': '0.1.0' })
    expect(() => parseManifestVersion(manifest)).toThrow()
  })

  it('throws when the "." value is an empty string', () => {
    const manifest = JSON.stringify({ '.': '' })
    expect(() => parseManifestVersion(manifest)).toThrow()
  })

  it('throws when the "." value is not a string', () => {
    const manifest = JSON.stringify({ '.': 7 })
    expect(() => parseManifestVersion(manifest)).toThrow()
  })
})

// ---------------------------------------------------------------------------
// resolvePreviousTag
// ---------------------------------------------------------------------------
describe('resolvePreviousTag', () => {
  it('returns the highest semver tag strictly below currentVersion', () => {
    const tags = ['v0.6.2', 'v0.6.1', 'v0.6.0', 'v0.5.3']
    expect(resolvePreviousTag(tags, '0.7.0')).toBe('v0.6.2')
  })

  it('returns null when there are no prior tags', () => {
    expect(resolvePreviousTag([], '0.1.0')).toBeNull()
  })

  it('returns null when all tags are >= currentVersion', () => {
    const tags = ['v0.7.0', 'v0.8.0']
    expect(resolvePreviousTag(tags, '0.7.0')).toBeNull()
  })

  it('uses numeric semver order: v0.6.10 > v0.6.9', () => {
    const tags = ['v0.6.9', 'v0.6.10', 'v0.6.2']
    // currentVersion is 0.7.0; highest strictly below is v0.6.10
    expect(resolvePreviousTag(tags, '0.7.0')).toBe('v0.6.10')
  })

  it('handles minor version ordering: v0.10.0 > v0.9.0', () => {
    const tags = ['v0.9.0', 'v0.10.0', 'v0.8.0']
    expect(resolvePreviousTag(tags, '0.11.0')).toBe('v0.10.0')
  })

  it('handles major version ordering', () => {
    const tags = ['v1.0.0', 'v2.0.0', 'v0.9.0']
    expect(resolvePreviousTag(tags, '3.0.0')).toBe('v2.0.0')
  })

  it('ignores tags that do not match vX.Y.Z format', () => {
    const tags = ['latest', 'v0.6.2', 'v0.7.0-alpha', 'v0.5.0']
    expect(resolvePreviousTag(tags, '0.7.0')).toBe('v0.6.2')
  })

  it('does not return the tag for currentVersion itself', () => {
    const tags = ['v0.7.0', 'v0.6.9']
    // v0.7.0 == current, so it is excluded; v0.6.9 is the previous
    expect(resolvePreviousTag(tags, '0.7.0')).toBe('v0.6.9')
  })

  it('returns null when only one tag exists and it equals currentVersion', () => {
    expect(resolvePreviousTag(['v1.0.0'], '1.0.0')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// parseCommitSubjects
// ---------------------------------------------------------------------------
describe('parseCommitSubjects', () => {
  it('splits a multi-line git log output into subjects', () => {
    const input = 'feat: add watchlist\nfix: correct delta calculation\n'
    expect(parseCommitSubjects(input)).toEqual([
      'feat: add watchlist',
      'fix: correct delta calculation',
    ])
  })

  it('trims whitespace from each subject', () => {
    const input = '  feat: add watchlist  \n  fix: typo  '
    expect(parseCommitSubjects(input)).toEqual(['feat: add watchlist', 'fix: typo'])
  })

  it('drops blank lines', () => {
    const input = 'feat: one\n\n\nfix: two\n'
    expect(parseCommitSubjects(input)).toEqual(['feat: one', 'fix: two'])
  })

  it('drops chore: release lines (release-please automated commits)', () => {
    const input = 'feat: new feature\nchore: release 0.7.0\nfix: bug'
    expect(parseCommitSubjects(input)).toEqual(['feat: new feature', 'fix: bug'])
  })

  it('drops chore(release): release lines', () => {
    const input = 'feat: cool thing\nchore(release): release v0.7.0\nfix: something'
    expect(parseCommitSubjects(input)).toEqual(['feat: cool thing', 'fix: something'])
  })

  it('is case-insensitive when dropping release commits', () => {
    const input = 'Chore: Release 0.6.2\nfeat: real commit'
    expect(parseCommitSubjects(input)).toEqual(['feat: real commit'])
  })

  it('returns empty array for empty input', () => {
    expect(parseCommitSubjects('')).toEqual([])
  })

  it('returns empty array for whitespace-only input', () => {
    expect(parseCommitSubjects('   \n  \n')).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// buildNotesMessages
// ---------------------------------------------------------------------------
describe('buildNotesMessages', () => {
  const subjects = ['feat: add token alerts', 'fix: correct price display', 'chore: upgrade deps']

  it('includes the version in the user message', () => {
    const { user } = buildNotesMessages('0.7.0', subjects)
    expect(user).toContain('v0.7.0')
  })

  it('includes each commit subject in the user message', () => {
    const { user } = buildNotesMessages('0.7.0', subjects)
    for (const s of subjects) {
      expect(user).toContain(s)
    }
  })

  it('system prompt instructs Claude never to produce a "What\'s Changed" heading', () => {
    const { system } = buildNotesMessages('0.7.0', subjects)
    // The system prompt lists "What's Changed" / "Other Changes" as forbidden — it must
    // mention the forbidden heading inside a "never include" rule so Claude knows to omit it.
    expect(system.toLowerCase()).toMatch(/never|what to never include/)
    expect(system).toMatch(/What's Changed/i)
  })

  it('system prompt forbids HTML comments', () => {
    const { system } = buildNotesMessages('0.7.0', subjects)
    expect(system).toContain('<!--')
    // The rule text mentions them; let's check it actually says to avoid them
    expect(system.toLowerCase()).toMatch(/never|no.*html comment|html comment/)
  })

  it('system prompt contains the reference example with TokenBuzz and emoji headers', () => {
    const { system } = buildNotesMessages('0.7.0', subjects)
    expect(system).toContain('TokenBuzz')
    expect(system).toContain('## 🚀 Highlights')
  })

  it('system prompt instructs output of only the markdown body', () => {
    const { system } = buildNotesMessages('0.7.0', subjects)
    expect(system.toLowerCase()).toMatch(/only.*markdown|markdown.*body/)
  })

  it('returns an object with both system and user keys', () => {
    const result = buildNotesMessages('1.0.0', ['feat: something'])
    expect(result).toHaveProperty('system')
    expect(result).toHaveProperty('user')
    expect(typeof result.system).toBe('string')
    expect(typeof result.user).toBe('string')
  })

  it('handles an empty commit subjects array gracefully', () => {
    const { user } = buildNotesMessages('0.7.0', [])
    expect(user).toContain('v0.7.0')
  })
})
