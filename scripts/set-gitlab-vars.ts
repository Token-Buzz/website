/**
 * Provision all variables from .env.local to a GitLab project's CI/CD settings.
 * Existing variables are updated; new ones are created.
 *
 * Usage (direct):
 *   tsx scripts/set-gitlab-vars.ts --token <api-token> --project <id>
 *
 * Usage (npm run):
 *   npm run set-gitlab-vars -- --token <api-token> --project <id>
 *   npm run set-gitlab-vars -- --token <api-token> --project <id> --pkg packages/web
 *
 * Options:
 *   --gitlab-url  Base URL (default: https://gitlab.com)
 *   --pkg         Package/directory to read env file from (e.g. packages/web)
 *   --env         Env filename or path (default: .env.local); resolved relative to --pkg if set
 *   --dry-run     Print what would happen without making changes
 *
 * Env var fallbacks: GITLAB_TOKEN, GITLAB_PROJECT_ID, GITLAB_URL
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'

// ---------------------------------------------------------------------------
// CLI arg parser — supports both named flags and positional fallback.
// npm run strips --flag names and forwards only the values as positional args,
// so we collect both and let callers decide which to prefer.
// ---------------------------------------------------------------------------
function parseArgs(): { named: Record<string, string>; flags: Set<string>; positional: string[] } {
  const args = process.argv.slice(2)
  const named: Record<string, string> = {}
  const flags = new Set<string>()
  const positional: string[] = []

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
    } else {
      positional.push(args[i])
    }
  }

  return { named, flags, positional }
}

// ---------------------------------------------------------------------------
// .env file parser — handles comments, blank lines, quoted values, inline =
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
// GitLab API
// GitLab returns 400 with "has already been taken" (not 409) when the variable
// exists, so we treat both as conflict and fall back to GET-then-PUT.
// ---------------------------------------------------------------------------
async function fetchExistingValue(
    variablesUrl: string,
    headers: Record<string, string>,
    key: string,
): Promise<string | null> {
  const res = await fetch(`${variablesUrl}/${encodeURIComponent(key)}`, { method: 'GET', headers })
  if (!res.ok) return null
  const data = (await res.json()) as { value?: string }
  return data.value ?? null
}

type UpsertResult =
    | { result: 'created' }
    | { result: 'updated'; oldValue: string | null }
    | { result: 'unchanged' }

async function upsertVariable(
    variablesUrl: string,
    headers: Record<string, string>,
    key: string,
    value: string,
): Promise<UpsertResult> {
  const body = JSON.stringify({ key, value, protected: false, masked: false, variable_type: 'env_var' })

  const createRes = await fetch(variablesUrl, { method: 'POST', headers, body })
  if (createRes.ok) return { result: 'created' }

  const errText = await createRes.text()
  const alreadyExists =
      createRes.status === 409 ||
      (createRes.status === 400 && errText.includes('has already been taken'))

  if (!alreadyExists) {
    throw new Error(`Failed to create ${key} (${createRes.status}): ${errText}`)
  }

  const oldValue = await fetchExistingValue(variablesUrl, headers, key)

  if (oldValue === value) return { result: 'unchanged' }

  const updateRes = await fetch(`${variablesUrl}/${encodeURIComponent(key)}`, {
    method: 'PUT',
    headers,
    body,
  })
  if (!updateRes.ok) {
    const text = await updateRes.text()
    throw new Error(`Failed to update ${key} (${updateRes.status}): ${text}`)
  }
  return { result: 'updated', oldValue }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const { named, flags, positional } = parseArgs()

  // Named flags take precedence; positional args are the fallback for npm run,
  // which strips --flag names and passes only the values through.
  const token =
      named['token'] ||
      named['gitlab-token'] ||
      positional[0] ||
      process.env.GITLAB_TOKEN ||
      process.env.GITLAB_API_TOKEN

  const projectId =
      named['project'] ||
      named['gitlab-project'] ||
      positional[1] ||
      process.env.GITLAB_PROJECT_ID

  const baseUrl = (named['gitlab-url'] || process.env.GITLAB_URL || 'https://gitlab.com').replace(/\/$/, '')
  const baseDir = named['pkg'] ? resolve(process.cwd(), named['pkg']) : process.cwd()
  const envPath = resolve(baseDir, named['env'] ?? '.env.local')
  const dryRun = flags.has('dry-run')

  if (!token) {
    console.error('Error: GitLab API token required.\n  --token <token>  or  GITLAB_TOKEN env var')
    process.exit(1)
  }

  if (!projectId) {
    console.error('Error: GitLab project ID required.\n  --project <id>  or  GITLAB_PROJECT_ID env var')
    process.exit(1)
  }

  const envVars = parseEnvFile(envPath)
  const varCount = Object.keys(envVars).length

  if (varCount === 0) {
    console.log(`No variables found in ${envPath}`)
    process.exit(0)
  }

  console.log(`\nProvisioning ${envPath} → GitLab project ${projectId}`)
  if (dryRun) console.log('(dry-run — no changes will be made)')
  console.log(`\nFound ${varCount} variable(s)\n`)

  const variablesUrl = `${baseUrl}/api/v4/projects/${encodeURIComponent(projectId)}/variables`
  const headers = { 'PRIVATE-TOKEN': token, 'Content-Type': 'application/json' }

  const created: string[] = []
  const updated: { key: string; oldValue: string | null; newValue: string }[] = []
  const unchanged: string[] = []
  const failed: { key: string; message: string }[] = []

  for (const [key, value] of Object.entries(envVars)) {
    if (dryRun) {
      console.log(`  [dry-run] ${key}`)
      continue
    }

    try {
      const res = await upsertVariable(variablesUrl, headers, key, value)
      if (res.result === 'created') {
        console.log(`  \x1b[32m[CREATED]\x1b[0m ${key}`)
        created.push(key)
      } else if (res.result === 'unchanged') {
        console.log(`  \x1b[90m[UNCHANGED]\x1b[0m ${key}`)
        unchanged.push(key)
      } else {
        console.log(`  \x1b[33m[UPDATED]\x1b[0m ${key}`)
        console.log(`    \x1b[90mold:\x1b[0m ${res.oldValue ?? '(unable to fetch)'}`)
        console.log(`    \x1b[90mnew:\x1b[0m ${value}`)
        updated.push({ key, oldValue: res.oldValue, newValue: value })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.log(`  \x1b[31m[FAILED]\x1b[0m ${key} — ${message}`)
      failed.push({ key, message })
    }
  }

  if (!dryRun) {
    console.log(`\nDone. ${created.length} created, ${updated.length} updated, ${unchanged.length} unchanged, ${failed.length} failed.`)
    if (updated.length > 0) {
      console.log(`\nOverwritten variables:`)
      for (const { key } of updated) {
        console.log(`  \x1b[33m• ${key}\x1b[0m`)
      }
    }
    if (failed.length > 0) {
      console.log(`\nFailures:`)
      for (const { key, message } of failed) {
        console.log(`  \x1b[31m• ${key}\x1b[0m — ${message}`)
      }
      process.exitCode = 1
    }
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
