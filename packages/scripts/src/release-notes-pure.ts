// Pure logic for the release-notes CLI — no I/O, no process, no network.
// All functions here are deterministic and unit-testable.

/**
 * Parse the text of `.release-please-manifest.json` and return the version
 * string for the `"."` key (e.g. `"0.7.0"`).
 *
 * Throws if the key is missing or the value is not a non-empty string.
 */
export function parseManifestVersion(manifestText: string): string {
  const parsed = JSON.parse(manifestText) as Record<string, unknown>
  const version = parsed['.']
  if (typeof version !== 'string' || version.length === 0) {
    throw new Error(
      `Expected a non-empty string at key "." in release-please manifest, got: ${JSON.stringify(version)}`,
    )
  }
  return version
}

/**
 * Given a list of existing git tags (e.g. `["v0.6.2","v0.6.1","v0.6.0",...]`)
 * and the current version string (e.g. `"0.7.0"`), return the highest semver
 * tag **strictly less than** `v{currentVersion}`, or `null` if there is none.
 *
 * Only tags matching the pattern `v{major}.{minor}.{patch}` are considered.
 * Comparison is numeric (semver order), not lexicographic, so v0.6.10 > v0.6.9.
 */
export function resolvePreviousTag(allTags: string[], currentVersion: string): string | null {
  // Parse a vX.Y.Z tag into numeric parts, or null if not matching.
  function parseSemver(tag: string): [number, number, number] | null {
    const m = /^v(\d+)\.(\d+)\.(\d+)$/.exec(tag)
    if (!m) return null
    return [parseInt(m[1]!, 10), parseInt(m[2]!, 10), parseInt(m[3]!, 10)]
  }

  function semverLt(a: [number, number, number], b: [number, number, number]): boolean {
    if (a[0] !== b[0]) return a[0] < b[0]
    if (a[1] !== b[1]) return a[1] < b[1]
    return a[2] < b[2]
  }

  function semverEq(a: [number, number, number], b: [number, number, number]): boolean {
    return a[0] === b[0] && a[1] === b[1] && a[2] === b[2]
  }

  const current = parseSemver(`v${currentVersion}`)
  if (!current) {
    throw new Error(`Invalid currentVersion: "${currentVersion}" — expected X.Y.Z format`)
  }

  let best: { tag: string; parts: [number, number, number] } | null = null

  for (const tag of allTags) {
    const parts = parseSemver(tag)
    if (!parts) continue
    // Must be strictly less than current
    if (!semverLt(parts, current) || semverEq(parts, current)) continue
    if (best === null || semverLt(best.parts, parts)) {
      best = { tag, parts }
    }
  }

  return best ? best.tag : null
}

/**
 * Split raw `git log --pretty=%s` output (one commit subject per line) into an
 * array of trimmed, non-empty subjects. Drops lines that are release-please
 * automated release commits (`chore: release …` / `chore(release): …`).
 */
export function parseCommitSubjects(gitLogOutput: string): string[] {
  return gitLogOutput
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .filter(line => !/^chore(\(release\))?:\s*release/i.test(line))
}

/**
 * Parse the JSON output of `gh pr list --json number` (an array of objects
 * each with a numeric `number` field) and return the PR numbers. Returns []
 * for empty/blank input; ignores non-array input and items lacking a numeric
 * `number`.
 */
export function parsePrNumbers(jsonText: string): number[] {
  const trimmed = jsonText.trim()
  if (trimmed.length === 0) return []
  const parsed = JSON.parse(trimmed) as unknown
  if (!Array.isArray(parsed)) return []
  return parsed
    .map((item) => (item && typeof item === 'object' ? (item as Record<string, unknown>)['number'] : undefined))
    .filter((n): n is number => typeof n === 'number' && Number.isInteger(n))
}

/**
 * Build the system + user messages for calling Claude to generate release notes.
 *
 * The system prompt encodes style rules and a reference example (v0.1.0).
 * The user message lists the version and the commit subjects.
 */
export function buildNotesMessages(
  version: string,
  commitSubjects: string[],
): { system: string; user: string } {
  const system = `You write release notes for TokenBuzz, a crypto-analytics SaaS product.

## Style rules

- Start with ONE short framing sentence that captures what the release is about.
- Then write 1–3 sections using emoji headers:
  - ## 🚀 Highlights — user-facing improvements and new features
  - ## 🐛 Fixes — bug fixes
  - ## 🧰 Under the hood — internal, infra, or docs changes, phrased in accessible language
- Omit a section entirely if there is nothing meaningful to put in it.
- Use **bold lead-ins** followed by a short explanation on each bullet.
- Translate technical commit messages into product-meaningful language.
- Group related commits into a single bullet; don't list every commit separately.
- Be concise. Prefer fewer, higher-quality bullets over an exhaustive list.

## What to NEVER include

- HTML comments (<!-- -->)
- A "What's Changed" or "Other Changes" heading
- Raw PR numbers (e.g. #123)
- Author @handles
- Commit hashes

Output ONLY the markdown body. No preamble, no sign-off.

## Reference example (v0.1.0)

The first public cut of **TokenBuzz**.

## 🚀 Highlights
- **Marketing site** — landing, pricing, FAQ, and contact.
- **Authenticated app** with Clerk sign-in.
- **Movers** — the top tokens by buzz delta across 1H / 24H / 7D windows.`

  const subjectList = commitSubjects.map(s => `- ${s}`).join('\n')
  const user = `Generate release notes for version v${version}.

Commits included in this release:
${subjectList}`

  return { system, user }
}
