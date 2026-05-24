import { spawnSync } from 'child_process'

function gh(args: string[]): string {
  const result = spawnSync('gh', args, { encoding: 'utf-8' })
  if (result.status !== 0) {
    const msg = (result.stderr || result.stdout || result.error?.message || 'unknown error').trim()
    throw new Error(`gh CLI error: ${msg}`)
  }
  return result.stdout
}

export function getIssueTitle(repo: string, issueNumber: number): string {
  return gh(['api', `repos/${repo}/issues/${issueNumber}`, '--jq', '.title']).trim()
}

export interface ClosedIssue {
  number: number
  title: string
  closedAt: string | null
  milestone: string | null
}

export function listClosedIssues(repo: string): ClosedIssue[] {
  const raw = gh([
    'issue',
    'list',
    '--repo',
    repo,
    '--state',
    'closed',
    '--json',
    'number,title,closedAt,milestone',
    '--limit',
    '500',
  ])
  const parsed = JSON.parse(raw) as Array<{
    number: number
    title: string
    closedAt: string | null
    milestone: { title: string } | null
  }>
  return parsed.map(i => ({
    number: i.number,
    title: i.title,
    closedAt: i.closedAt ?? null,
    milestone: i.milestone?.title ?? null,
  }))
}

export interface ClosedMilestone {
  number: number
  title: string
  closedAt: string | null
}

export function listClosedMilestones(repo: string): ClosedMilestone[] {
  const raw = gh(['api', `repos/${repo}/milestones?state=closed&per_page=100`])
  const parsed = JSON.parse(raw) as Array<{
    number: number
    title: string
    closed_at: string | null
  }>
  return parsed.map(m => ({
    number: m.number,
    title: m.title,
    closedAt: m.closed_at ?? null,
  }))
}
