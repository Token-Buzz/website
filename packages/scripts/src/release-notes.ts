/**
 * release-notes — create a GitHub release with AI-generated notes.
 *
 * Usage (in CI):
 *   npx tsx packages/scripts/src/release-notes.ts
 *
 * Requires:
 *   - `gh` CLI authenticated (GH_TOKEN env var, as provided by GITHUB_TOKEN in CI)
 *   - `git` available (full history + tags via fetch-depth: 0)
 *   - ANTHROPIC_API_KEY (optional — falls back to a plain notes body if absent or erroring)
 *
 * Behaviour:
 *   1. Reads .release-please-manifest.json from CWD to get the current version.
 *   2. Lists existing git tags. If v{version} already exists → exits 0 (idempotent).
 *   3. Determines the previous semver tag (for the git log range).
 *   4. Collects commit subjects since the previous tag.
 *   5. Generates release notes via Claude Haiku (with fallback).
 *   6. Creates the GitHub release via `gh release create`.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync, spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Anthropic from '@anthropic-ai/sdk'
import {
  parseManifestVersion,
  resolvePreviousTag,
  parseCommitSubjects,
  buildNotesMessages,
} from './release-notes-pure.js'

// ---------------------------------------------------------------------------
// Git / shell helpers — use execFileSync/spawnSync with arg arrays (no shell
// string interpolation of untrusted data).
// ---------------------------------------------------------------------------

function git(args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf-8' }).trim()
}

function ghRelease(args: string[]): void {
  const result = spawnSync('gh', args, { encoding: 'utf-8', stdio: 'inherit' })
  if (result.status !== 0) {
    throw new Error(`gh release failed with status ${result.status ?? 'null'}`)
  }
}

// ---------------------------------------------------------------------------
// Notes generation
// ---------------------------------------------------------------------------

async function generateNotesWithClaude(version: string, commitSubjects: string[]): Promise<string> {
  const client = new Anthropic()
  const { system, user } = buildNotesMessages(version, commitSubjects)

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1500,
    system: [
      {
        type: 'text',
        text: system,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: user }],
  })

  const block = response.content[0]
  if (!block || block.type !== 'text') {
    throw new Error('Unexpected response shape from Claude API')
  }
  return block.text.trim()
}

function fallbackNotes(version: string, commitSubjects: string[]): string {
  const lines = commitSubjects.length > 0
    ? commitSubjects.map(s => `- ${s}`).join('\n')
    : '- Various improvements and fixes.'
  return `Release v${version}.\n\n## Changes\n${lines}`
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  // 1. Determine current version from manifest.
  const manifestPath = join(process.cwd(), '.release-please-manifest.json')
  const manifestText = readFileSync(manifestPath, 'utf-8')
  const version = parseManifestVersion(manifestText)
  const tag = `v${version}`

  console.log(`Current version from manifest: ${version}`)

  // 2. List existing git tags.
  const tagsRaw = git(['tag', '--list', 'v*'])
  const allTags = tagsRaw.length > 0 ? tagsRaw.split('\n').map(t => t.trim()).filter(Boolean) : []

  // 3. Idempotency guard — if tag already exists, nothing to do.
  if (allTags.includes(tag)) {
    console.log(`Release ${tag} already exists; nothing to do.`)
    process.exit(0)
  }

  console.log(`Tag ${tag} does not exist yet — proceeding to create release.`)

  // 4. Determine previous tag and collect commit subjects.
  const prevTag = resolvePreviousTag(allTags, version)
  console.log(prevTag ? `Previous tag: ${prevTag}` : 'No previous tag found — using all commits.')

  const logArgs = prevTag
    ? ['log', '--no-merges', '--pretty=%s', `${prevTag}..HEAD`]
    : ['log', '--no-merges', '--pretty=%s']
  const gitLogOutput = git(logArgs)
  const commitSubjects = parseCommitSubjects(gitLogOutput)

  console.log(`Found ${commitSubjects.length} commit(s) to summarise.`)

  // 5. Generate release notes (Claude Haiku, with fallback).
  let notes: string
  const apiKey = process.env['ANTHROPIC_API_KEY']

  if (!apiKey) {
    console.log('ANTHROPIC_API_KEY not set — using fallback notes.')
    notes = fallbackNotes(version, commitSubjects)
  } else {
    try {
      console.log('Generating release notes with Claude Haiku…')
      notes = await generateNotesWithClaude(version, commitSubjects)
      console.log('Claude notes generated successfully.')
    } catch (err) {
      console.warn(
        'Claude API call failed; falling back to plain notes.',
        err instanceof Error ? err.message : String(err),
      )
      notes = fallbackNotes(version, commitSubjects)
    }
  }

  // 6. Get HEAD SHA for --target.
  const headSha = git(['rev-parse', 'HEAD'])
  console.log(`HEAD SHA: ${headSha}`)

  // Write notes to a temp file (avoids shell interpolation of notes content).
  const tmpFile = join(tmpdir(), `release-notes-${version}-${Date.now()}.md`)
  writeFileSync(tmpFile, notes, 'utf-8')

  // Create the GitHub release.
  console.log(`Creating GitHub release ${tag}…`)
  ghRelease([
    'release',
    'create',
    tag,
    '--target',
    headSha,
    '--title',
    tag,
    '--latest',
    '--notes-file',
    tmpFile,
  ])

  console.log(`Release ${tag} created successfully.`)
}

main().catch(err => {
  console.error('Fatal error in release-notes script:', err instanceof Error ? err.message : err)
  process.exit(1)
})
