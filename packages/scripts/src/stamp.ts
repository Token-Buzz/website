/**
 * stamp — GitHub-native cycle-time stamping helper.
 *
 * Usage:
 *   npm run -s stamp --prefix packages/scripts -- <issue-number> start|done
 *
 * Requires: `gh` CLI authenticated (GH_TOKEN or gh auth login).
 * Project: Token-Buzz / project #1.
 *
 * start:
 *   If `Actual Start` is empty for that item, sets:
 *     - Actual Start = today (YYYY-MM-DD)
 *     - Started At   = now (ISO-8601)
 *   Idempotent: no-op if already set.
 *
 * done:
 *   Sets:
 *     - Actual Finish  = today (YYYY-MM-DD)
 *     - Completed At   = now (ISO-8601)
 *   Then reads `Started At` from the item, computes:
 *     - Cycle Minutes  = whole minutes from start to finish
 *     - Cycle Time     = human-readable duration (e.g. "1d 4h 30m")
 *   If `Started At` is missing, still sets the finish stamps and warns.
 */

import { spawnSync } from 'node:child_process'
import { computeCycleTime, fieldJsonKey } from './stamp-pure.js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROJECT_NUMBER = 1
const PROJECT_OWNER = 'Token-Buzz'

// ---------------------------------------------------------------------------
// gh CLI helper
// ---------------------------------------------------------------------------

function gh(args: string[]): string {
  const result = spawnSync('gh', args, { encoding: 'utf-8' })
  if (result.status !== 0) {
    const msg = (result.stderr || result.stdout || result.error?.message || 'unknown error').trim()
    throw new Error(`gh CLI error: ${msg}`)
  }
  return result.stdout
}

// ---------------------------------------------------------------------------
// Project resolution helpers
// ---------------------------------------------------------------------------

interface ProjectField {
  id: string
  name: string
  type: string
}

interface ProjectItem {
  id: string
  content?: {
    number?: number
    type?: string
  }
  [key: string]: unknown
}

function getProjectNodeId(): string {
  const raw = gh(['project', 'view', String(PROJECT_NUMBER), '--owner', PROJECT_OWNER, '--format', 'json'])
  const parsed = JSON.parse(raw) as { id?: string }
  if (!parsed.id) throw new Error('Could not find project node ID')
  return parsed.id
}

function getProjectFields(): Map<string, ProjectField> {
  const raw = gh([
    'project',
    'field-list',
    String(PROJECT_NUMBER),
    '--owner',
    PROJECT_OWNER,
    '--format',
    'json',
  ])
  const parsed = JSON.parse(raw) as { fields?: ProjectField[] }
  const fields = parsed.fields ?? []
  const map = new Map<string, ProjectField>()
  for (const f of fields) {
    map.set(f.name, f)
  }
  return map
}

function getProjectItem(issueNumber: number): ProjectItem {
  // Paginate: fetch up to 500 items to find the matching one.
  const raw = gh([
    'project',
    'item-list',
    String(PROJECT_NUMBER),
    '--owner',
    PROJECT_OWNER,
    '--format',
    'json',
    '--limit',
    '500',
  ])
  const parsed = JSON.parse(raw) as { items?: ProjectItem[] }
  const items = parsed.items ?? []
  const item = items.find(
    i => i.content?.type === 'Issue' && i.content?.number === issueNumber,
  )
  if (!item) {
    throw new Error(
      `Issue #${issueNumber} not found in project ${PROJECT_OWNER}/#${PROJECT_NUMBER}. ` +
        `Make sure it has been added to the project.`,
    )
  }
  return item
}

// ---------------------------------------------------------------------------
// Field-value reader (from in-memory item data)
// ---------------------------------------------------------------------------

function getFieldTextValue(item: ProjectItem, fieldName: string): string | null {
  const value = (item as Record<string, unknown>)[fieldJsonKey(fieldName)]
  if (value === undefined || value === null) return null
  return String(value)
}

// ---------------------------------------------------------------------------
// Field-value setters via gh project item-edit
// ---------------------------------------------------------------------------

function setDateField(projectId: string, itemId: string, fieldId: string, value: string): void {
  gh(['project', 'item-edit', '--id', itemId, '--project-id', projectId, '--field-id', fieldId, '--date', value])
}

function setTextField(projectId: string, itemId: string, fieldId: string, value: string): void {
  gh(['project', 'item-edit', '--id', itemId, '--project-id', projectId, '--field-id', fieldId, '--text', value])
}

function setNumberField(projectId: string, itemId: string, fieldId: string, value: number): void {
  gh([
    'project',
    'item-edit',
    '--id',
    itemId,
    '--project-id',
    projectId,
    '--field-id',
    fieldId,
    '--number',
    String(value),
  ])
}

// ---------------------------------------------------------------------------
// Date/time helpers
// ---------------------------------------------------------------------------

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function nowISO(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
}

// ---------------------------------------------------------------------------
// Subcommands
// ---------------------------------------------------------------------------

function cmdStart(issueNumber: number): void {
  console.log(`Fetching project data for issue #${issueNumber}…`)
  const projectId = getProjectNodeId()
  const fields = getProjectFields()
  const item = getProjectItem(issueNumber)

  const actualStartField = fields.get('Actual Start')
  const startedAtField = fields.get('Started At')

  if (!actualStartField) throw new Error('Project field "Actual Start" not found')
  if (!startedAtField) throw new Error('Project field "Started At" not found')

  const existingStart = getFieldTextValue(item, 'Actual Start')
  if (existingStart) {
    console.log(`No-op: "Actual Start" is already set to ${existingStart} for issue #${issueNumber}.`)
    return
  }

  const today = todayISO()
  const now = nowISO()

  console.log(`Setting Actual Start = ${today}`)
  setDateField(projectId, item.id, actualStartField.id, today)

  console.log(`Setting Started At = ${now}`)
  setTextField(projectId, item.id, startedAtField.id, now)

  console.log(`Done. Issue #${issueNumber} stamped as started.`)
}

function cmdDone(issueNumber: number): void {
  console.log(`Fetching project data for issue #${issueNumber}…`)
  const projectId = getProjectNodeId()
  const fields = getProjectFields()
  const item = getProjectItem(issueNumber)

  const actualFinishField = fields.get('Actual Finish')
  const completedAtField = fields.get('Completed At')
  const cycleMinutesField = fields.get('Cycle Minutes')
  const cycleTimeField = fields.get('Cycle Time')

  if (!actualFinishField) throw new Error('Project field "Actual Finish" not found')
  if (!completedAtField) throw new Error('Project field "Completed At" not found')
  if (!cycleMinutesField) throw new Error('Project field "Cycle Minutes" not found')
  if (!cycleTimeField) throw new Error('Project field "Cycle Time" not found')

  const today = todayISO()
  const now = nowISO()

  console.log(`Setting Actual Finish = ${today}`)
  setDateField(projectId, item.id, actualFinishField.id, today)

  console.log(`Setting Completed At = ${now}`)
  setTextField(projectId, item.id, completedAtField.id, now)

  const startedAt = getFieldTextValue(item, 'Started At')
  if (!startedAt) {
    console.warn(
      `Warning: "Started At" is not set for issue #${issueNumber}. ` +
        `Finish stamps written but Cycle Time/Minutes cannot be computed.`,
    )
    return
  }

  const cycle = computeCycleTime(startedAt, now)

  console.log(`Setting Cycle Minutes = ${cycle.minutes}`)
  setNumberField(projectId, item.id, cycleMinutesField.id, cycle.minutes)

  console.log(`Setting Cycle Time = "${cycle.human}"`)
  setTextField(projectId, item.id, cycleTimeField.id, cycle.human)

  console.log(`Done. Issue #${issueNumber} stamped as completed. Cycle time: ${cycle.human}`)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  const args = process.argv.slice(2)
  if (args.length < 2) {
    console.error('Usage: stamp <issue-number> start|done')
    process.exit(1)
  }

  const [issueArg, subcommand] = args

  const issueNumber = parseInt(issueArg!, 10)
  if (!issueArg || isNaN(issueNumber) || issueNumber <= 0) {
    console.error(`Error: invalid issue number "${issueArg}". Expected a positive integer.`)
    process.exit(1)
  }

  if (subcommand !== 'start' && subcommand !== 'done') {
    console.error(`Error: unknown subcommand "${subcommand}". Expected "start" or "done".`)
    process.exit(1)
  }

  try {
    if (subcommand === 'start') {
      cmdStart(issueNumber)
    } else {
      cmdDone(issueNumber)
    }
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err))
    process.exit(1)
  }
}

main()
