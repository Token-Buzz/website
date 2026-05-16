/**
 * Set all variables from .env.local files (root and subpackages) as SST secrets.
 * Skips AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.
 *
 * Usage:
 *   tsx scripts/set-sst-vars.ts --stage dev
 *   tsx scripts/set-sst-vars.ts --stage production --dry-run
 *
 * npm run:
 *   npm run set-sst-vars -- --stage dev
 *   npm run set-sst-vars -- --stage production --dry-run
 */

import { readFileSync, readdirSync, statSync } from 'fs'
import { resolve, join, relative } from 'path'
import { spawnSync } from 'child_process'

const SKIP_KEYS = new Set(['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_DEFAULT_REGION', 'AWS_ROLE_ARN'])
const IGNORE_DIRS = new Set(['node_modules', '.sst', '.git', '.next', 'dist', '.turbo'])

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
function parseArgs(): { named: Record<string, string>; flags: Set<string> } {
  const args = process.argv.slice(2)
  const named: Record<string, string> = {}
  const flags = new Set<string>()

  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2)
      const next = args[i + 1]
      if (next !== undefined && !next.startsWith('--')) {
        named[key] = next
        i++
      } else {
        flags.add(key)
      }
    }
  }

  return { named, flags }
}

// ---------------------------------------------------------------------------
// .env file parser
// ---------------------------------------------------------------------------
function parseEnvFile(filePath: string): Record<string, string> {
  const content = readFileSync(filePath, 'utf-8')
  const vars: Record<string, string> = {}

  for (const raw of content.split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue

    const eqIdx = line.indexOf('=')
    if (eqIdx === -1) continue

    const key = line.slice(0, eqIdx).trim()
    if (!key) continue

    let value = line.slice(eqIdx + 1).trim()

    const isDoubleQuoted = value.startsWith('"') && value.endsWith('"')
    const isSingleQuoted = value.startsWith("'") && value.endsWith("'")

    if (isDoubleQuoted || isSingleQuoted) {
      value = value.slice(1, -1)
    } else {
      value = value.replace(/\s+#.*$/, '')
    }

    vars[key] = value
  }

  return vars
}

// ---------------------------------------------------------------------------
// Recursively find all .env.local files, skipping ignored directories
// ---------------------------------------------------------------------------
function findEnvFiles(dir: string): string[] {
  const results: string[] = []

  const envPath = join(dir, '.env.local')
  try {
    statSync(envPath)
    results.push(envPath)
  } catch {
    // no .env.local here
  }

  for (const entry of readdirSync(dir)) {
    if (IGNORE_DIRS.has(entry)) continue
    const fullPath = join(dir, entry)
    try {
      if (statSync(fullPath).isDirectory()) {
        results.push(...findEnvFiles(fullPath))
      }
    } catch {
      // skip unreadable entries
    }
  }

  return results
}

// ---------------------------------------------------------------------------
// SST secret set
// ---------------------------------------------------------------------------
function sstSecretSet(key: string, value: string, stage: string): { ok: boolean; error?: string } {
  const result = spawnSync('npx', ['sst', 'secret', 'set', key, value, '--stage', stage], {
    encoding: 'utf-8',
    stdio: 'pipe',
    shell: true,
  })

  if (result.status === 0) return { ok: true }

  const error = (result.error?.message || result.stderr || result.stdout || 'unknown error').trim()
  return { ok: false, error }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const { named, flags } = parseArgs()

  const stage = named['stage']
  const dryRun = flags.has('dry-run')
  const rootDir = resolve(process.cwd())

  if (!stage) {
    console.error('Error: --stage is required (e.g. --stage dev)')
    process.exit(1)
  }

  const envFiles = findEnvFiles(rootDir)

  if (envFiles.length === 0) {
    console.log('No .env.local files found.')
    process.exit(0)
  }

  console.log(`\nSetting SST secrets for stage: ${stage}`)
  if (dryRun) console.log('(dry-run — no changes will be made)')

  const set: string[] = []
  const skipped: string[] = []
  const failed: { key: string; error?: string }[] = []

  for (const envFile of envFiles) {
    const relPath = relative(rootDir, envFile)
    const vars = parseEnvFile(envFile)
    const varCount = Object.keys(vars).length

    if (varCount === 0) continue

    console.log(`\n${relPath} (${varCount} variable(s))`)

    for (const [key, value] of Object.entries(vars)) {
      if (SKIP_KEYS.has(key)) {
        console.log(`  [SKIPPED]  ${key}`)
        skipped.push(key)
        continue
      }

      if (!value) {
        console.log(`  \x1b[90m[EMPTY]\x1b[0m    ${key}`)
        skipped.push(key)
        continue
      }

      if (dryRun) {
        console.log(`  [dry-run]  ${key}`)
        continue
      }

      const { ok, error } = sstSecretSet(key, value, stage)
      if (ok) {
        console.log(`  \x1b[32m[SET]\x1b[0m      ${key}`)
        set.push(key)
      } else {
        console.log(`  \x1b[31m[FAILED]\x1b[0m   ${key} — ${error}`)
        failed.push({ key, error })
      }
    }
  }

  if (!dryRun) {
    console.log(`\nDone. ${set.length} set, ${skipped.length} skipped, ${failed.length} failed.`)
    if (failed.length > 0) {
      console.log('\nFailures:')
      for (const { key, error } of failed) {
        console.log(`  \x1b[31m• ${key}\x1b[0m — ${error}`)
      }
      process.exitCode = 1
    }
  }
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
