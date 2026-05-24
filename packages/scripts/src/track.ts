/**
 * track — AI time-tracking CLI for GitHub issues via Toggl Track.
 *
 * Required environment variables:
 *   TOGGL_API_TOKEN      — your Toggl Track API token (from toggl.com/profile)
 *   TOGGL_WORKSPACE_ID   — your Toggl workspace ID (from toggl.com/workspaces)
 *
 * Optional environment variables:
 *   TRACK_REPO           — GitHub repo in "owner/name" form (default: Token-Buzz/website)
 *   TRACK_STATE_FILE     — override path for the active-issue state file
 *                          (default: <repoRoot>/.claude/.track-current.json)
 *
 * Tagging convention:
 *   This CLI writes the "ai" tag on every entry it starts. To mark an entry
 *   as human time, add the "human" tag manually via the Toggl app. Entries
 *   without either tag are counted as "other" in reports.
 *
 * Entry naming: "#<issueNumber> <issueTitle>"
 *
 * Per-turn timing model:
 *   AI time is measured per Claude Code turn. A UserPromptSubmit hook calls
 *   `ai-resume` at the start of each turn and a Stop hook calls `ai-pause` at
 *   the end. This produces several short Toggl entries per issue, all tagged
 *   "ai", whose durations sum in the `report` command.
 *
 *   The active issue persists in .claude/.track-current.json between turns.
 *   `ai-start` seeds it; `ai-stop` clears it. The per-turn hooks are silent
 *   no-ops when the state file is absent.
 *
 * Subcommands:
 *   ai-start <issue> [--repo owner/name]
 *       Start timing AI work on an issue. Automatically stops any running entry.
 *       Persists the active issue to the state file so per-turn hooks can resume.
 *       <issue> accepts "83", "#83", or "#83 anything after".
 *
 *   ai-stop [issue] [--repo owner/name]
 *       Stop the currently running time entry and clear the active-issue state.
 *       If [issue] is given, warns if the running entry doesn't match that issue,
 *       but stops it anyway.
 *
 *   ai-resume
 *       Resume timing the active issue (no-op if none or already running).
 *       Called automatically by the per-turn UserPromptSubmit hook.
 *
 *   ai-pause
 *       Pause the running AI timer, keeping the active issue for the next turn.
 *       Called automatically by the per-turn Stop hook.
 *
 *   report [--since YYYY-MM-DD] [--until YYYY-MM-DD] [--days N] [--repo owner/name] [--json]
 *       Print a weekly combined report. Defaults to the last 7 days.
 *       --since / --until override the date range; --days changes the lookback window.
 *       --json outputs the raw report model as JSON.
 *
 *   status
 *       Show the currently running time entry, or "No running time entry."
 *
 * Examples:
 *   TOGGL_API_TOKEN=xxx TOGGL_WORKSPACE_ID=yyy tsx src/track.ts ai-start 83
 *   tsx src/track.ts ai-stop
 *   tsx src/track.ts ai-resume
 *   tsx src/track.ts ai-pause
 *   tsx src/track.ts report --days 14
 *   tsx src/track.ts report --since 2025-05-01 --until 2025-05-15 --json
 *   tsx src/track.ts status
 */

import { execSync } from 'node:child_process'
import { existsSync, readFileSync, mkdirSync, writeFileSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { getCurrentEntry, startEntry, stopEntry, listEntries } from './toggl.js'
import { getIssueTitle, listClosedIssues, listClosedMilestones } from './github.js'
import {
  parseIssueArg,
  formatEntryName,
  formatDuration,
  getDefaultRange,
  buildReport,
  renderReport,
  serializeTrackState,
  parseTrackState,
  type TrackState,
} from './time-tracking.js'

const USAGE = `
Usage: tsx src/track.ts <subcommand> [options]

Subcommands:
  ai-start <issue> [--repo owner/name]          Start AI time entry for an issue
  ai-stop [issue] [--repo owner/name]           Stop the current time entry and clear active issue
  ai-resume                                     Resume timing the active issue (no-op if none / already running)
  ai-pause                                      Pause the running AI timer, keeping the active issue
  report [--since DATE] [--until DATE]          Weekly combined report
         [--days N] [--repo owner/name] [--json]
  status                                        Show running entry
  help                                          Show this message
`.trim()

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------

interface ParsedArgs {
  subcommand: string | undefined
  positional: string[]
  named: Record<string, string>
  flags: Set<string>
}

function parseArgs(): ParsedArgs {
  const argv = process.argv.slice(2)
  const positional: string[] = []
  const named: Record<string, string> = {}
  const flags = new Set<string>()
  let subcommand: string | undefined

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg.startsWith('--')) {
      const key = arg.slice(2)
      const next = argv[i + 1]
      if (next !== undefined && !next.startsWith('--')) {
        named[key] = next
        i++
      } else {
        flags.add(key)
      }
    } else if (subcommand === undefined) {
      subcommand = arg
    } else {
      positional.push(arg)
    }
  }

  return { subcommand, positional, named, flags }
}

// ---------------------------------------------------------------------------
// Env helpers
// ---------------------------------------------------------------------------

function requireTogglEnv(): { token: string; workspaceId: string } {
  const token = process.env['TOGGL_API_TOKEN']
  const workspaceId = process.env['TOGGL_WORKSPACE_ID']

  if (!token || !workspaceId) {
    const missing = [!token && 'TOGGL_API_TOKEN', !workspaceId && 'TOGGL_WORKSPACE_ID']
      .filter(Boolean)
      .join(', ')
    console.error(
      `Error: missing required environment variable(s): ${missing}\n` +
        'Set them before running:\n' +
        '  export TOGGL_API_TOKEN=your_token\n' +
        '  export TOGGL_WORKSPACE_ID=your_workspace_id',
    )
    process.exit(1)
  }

  return { token, workspaceId }
}

function resolveRepo(named: Record<string, string>): string {
  return named['repo'] ?? process.env['TRACK_REPO'] ?? 'Token-Buzz/website'
}

// ---------------------------------------------------------------------------
// State-file I/O  (NOT pure — side-effects, kept in track.ts)
// ---------------------------------------------------------------------------

/** Return the path of the active-issue state file. */
function stateFilePath(): string {
  const envOverride = process.env['TRACK_STATE_FILE']
  if (envOverride) return envOverride

  let repoRoot: string
  try {
    repoRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' }).trim()
  } catch {
    repoRoot = process.cwd()
  }
  return join(repoRoot, '.claude', '.track-current.json')
}

/** Read and parse the state file. Returns null if missing or malformed. */
function readState(): TrackState | null {
  const filePath = stateFilePath()
  if (!existsSync(filePath)) return null
  const contents = readFileSync(filePath, 'utf-8')
  return parseTrackState(contents)
}

/** Write state to the state file, creating the parent directory if needed. */
function writeState(state: TrackState): void {
  const filePath = stateFilePath()
  mkdirSync(join(filePath, '..'), { recursive: true })
  writeFileSync(filePath, serializeTrackState(state), 'utf-8')
}

/** Delete the state file if it exists. Never throws. */
function clearState(): void {
  const filePath = stateFilePath()
  if (existsSync(filePath)) {
    unlinkSync(filePath)
  }
}

// ---------------------------------------------------------------------------
// Subcommands
// ---------------------------------------------------------------------------

async function cmdAiStart(positional: string[], named: Record<string, string>): Promise<void> {
  const { token, workspaceId } = requireTogglEnv()
  const repo = resolveRepo(named)

  const issueArg = positional[0]
  if (!issueArg) {
    console.error('Error: ai-start requires an issue number, e.g. "83" or "#83".')
    process.exit(1)
  }

  const issueNumber = parseIssueArg(issueArg)
  const title = getIssueTitle(repo, issueNumber)
  const description = formatEntryName(issueNumber, title)

  const running = await getCurrentEntry(token)
  if (running) {
    console.log(`Stopping current entry: "${running.description}"`)
  }

  const entry = await startEntry({ token, workspaceId, description, tags: ['ai'] })
  writeState({ issue: issueNumber, repo, description })
  console.log(`Started: "${entry.description}" (id: ${entry.id})`)
}

async function cmdAiStop(positional: string[], named: Record<string, string>): Promise<void> {
  const { token, workspaceId } = requireTogglEnv()

  const running = await getCurrentEntry(token)
  if (!running) {
    clearState()
    console.log('No running time entry.')
    console.log('Cleared active issue.')
    return
  }

  if (positional[0]) {
    const issueNumber = parseIssueArg(positional[0])
    const expectedPrefix = `#${issueNumber} `
    if (!running.description?.startsWith(expectedPrefix)) {
      console.warn(
        `Warning: running entry "${running.description}" does not match issue #${issueNumber}. Stopping anyway.`,
      )
    }
  }

  const stopped = await stopEntry({ token, workspaceId, entryId: running.id })
  clearState()
  console.log(`Stopped: "${stopped.description}" — ${formatDuration(stopped.duration)}`)
}

async function cmdAiResume(): Promise<void> {
  const token = process.env['TOGGL_API_TOKEN']
  const workspaceId = process.env['TOGGL_WORKSPACE_ID']
  if (!token || !workspaceId) return

  const state = readState()
  if (!state) return

  const running = await getCurrentEntry(token)
  if (running) return

  const entry = await startEntry({ token, workspaceId, description: state.description, tags: ['ai'] })
  console.log(`Resumed: "${entry.description}"`)
}

async function cmdAiPause(): Promise<void> {
  const token = process.env['TOGGL_API_TOKEN']
  const workspaceId = process.env['TOGGL_WORKSPACE_ID']
  if (!token || !workspaceId) return

  const running = await getCurrentEntry(token)
  if (!running) return

  if (!running.tags.includes('ai')) return

  const stopped = await stopEntry({ token, workspaceId, entryId: running.id })
  console.log(`Paused: "${stopped.description}" — ${formatDuration(stopped.duration)}`)
}

async function cmdReport(named: Record<string, string>, flags: Set<string>): Promise<void> {
  const { token } = requireTogglEnv()
  const repo = resolveRepo(named)

  const now = new Date()
  let since: Date
  let until: Date

  if (named['since'] || named['until']) {
    until = named['until'] ? new Date(named['until']) : now
    since = named['since'] ? new Date(named['since']) : getDefaultRange(now, 7).since
  } else {
    const days = named['days'] ? parseInt(named['days'], 10) : 7
    ;({ since, until } = getDefaultRange(now, days))
  }

  const [entries, closedIssues, closedMilestones] = await Promise.all([
    listEntries({ token, since, until }),
    Promise.resolve(listClosedIssues(repo)),
    Promise.resolve(listClosedMilestones(repo)),
  ])

  const model = buildReport({ entries, closedIssues, closedMilestones, since, until })

  if (flags.has('json')) {
    console.log(JSON.stringify(model, null, 2))
  } else {
    console.log(renderReport(model))
  }
}

async function cmdStatus(): Promise<void> {
  const { token } = requireTogglEnv()

  const running = await getCurrentEntry(token)
  if (!running) {
    console.log('No running time entry.')
    return
  }

  const elapsed = (Date.now() - new Date(running.start).getTime()) / 1000
  console.log(`Running: "${running.description}" — ${formatDuration(elapsed)}`)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const { subcommand, positional, named, flags } = parseArgs()

  switch (subcommand) {
    case 'ai-start':
      await cmdAiStart(positional, named)
      break
    case 'ai-stop':
      await cmdAiStop(positional, named)
      break
    case 'ai-resume':
      await cmdAiResume()
      break
    case 'ai-pause':
      await cmdAiPause()
      break
    case 'report':
      await cmdReport(named, flags)
      break
    case 'status':
      await cmdStatus()
      break
    case 'help':
    case undefined:
      console.log(USAGE)
      break
    default:
      console.error(`Unknown subcommand: "${subcommand}"\n\n${USAGE}`)
      process.exit(1)
  }
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
