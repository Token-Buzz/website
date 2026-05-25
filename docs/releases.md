## Changelog & releases

### Versioning

Releases follow **semver** with a `v` prefix (e.g. `v0.1.0`, `v1.2.3`). Versions are derived automatically from Conventional Commits on `master` — no manual bumping. Pre-1.0 bump rules apply:

- `feat:` commit → **minor** bump (0.x → 0.x+1)
- `fix:` commit → **patch** bump (0.x.y → 0.x.y+1)

These rules are configured via `bump-minor-pre-major: true` and `bump-patch-for-minor-pre-major: false` in `release-please-config.json`.

### How releases work (automated)

Releases are managed by **release-please** (`.github/workflows/release.yml`). Every push to `master` updates an open "Release PR" that accumulates the version bump and CHANGELOG entries. No manual tagging or note-writing is needed.

**Release flow:**

1. Merge feature/fix PRs to `master` using Conventional Commit messages.
2. release-please automatically keeps the Release PR up to date.
3. Review the Release PR like any other PR — it shows the next version, the full CHANGELOG diff, and the manifest bump.
4. **Merging the Release PR** creates the `vX.Y.Z` git tag, publishes the GitHub Release, and triggers the production deploy.

Config files: `release-please-config.json` + `.release-please-manifest.json` at the repo root.

### Release notes categorization

release-please derives notes from commit **types**, not PR labels:

| Commit type(s) | Section |
|---|---|
| `feat`, `perf` | 🚀 Features |
| `fix` | 🐛 Fixes |
| `docs` | 📝 Documentation |
| `chore`, `refactor`, `ci`, `test`, `build` | 🧰 Maintenance |

> **Note:** this is distinct from `.github/release.yml`, which is GitHub's native label-based generator. That file is only used by the manual fallback (see below).

### Forcing a specific version

To override the next version for a one-off release, add a `Release-As` footer to any commit on `master`:

```
chore: prepare v1.0.0 release

Release-As: 1.0.0
```

release-please will use that version for the next Release PR regardless of what the commits would normally produce.

### Bootstrap note

The very first release is pinned to `v0.1.0` via a one-time `"release-as": "0.1.0"` entry in `release-please-config.json` (`.` package), with `.release-please-manifest.json` seeded to `0.0.0`.

**After v0.1.0 is published, remove the `"release-as"` line from `release-please-config.json` in a follow-up commit.** Leaving it in place would pin every subsequent release to `0.1.0` instead of deriving the version from commits.

### Public changelog

Published (non-draft) GitHub Releases are rendered at `/changelog` on the marketing site. The page uses ISR with a ~1 hour cache. Draft releases are not shown — only merge the Release PR once the release is ready for public visibility.

### Manual fallback

If you need to cut a release outside the normal flow (e.g. a hotfix bypassing release-please):

**Via CLI:**

```bash
gh release create vX.Y.Z --generate-notes --title "vX.Y.Z — <theme>"
```

**Via GitHub UI:** go to **Releases → Draft a new release**, choose a new tag, then click **Generate release notes**.

When using the manual path, the notes are categorized by PR labels via `.github/release.yml`:

| Label(s) | Section |
|---|---|
| `feature`, `enhancement` | 🚀 Features |
| `bug`, `fix` | 🐛 Fixes |
| `docs`, `documentation` | 📝 Documentation |
| `chore`, `refactor`, `ci`, `test`, `dependencies`, `deps` | 🧰 Maintenance |
| anything else | Other Changes |

PRs labelled `ignore-for-release` or `duplicate` are excluded entirely.

**After a manual release, update `.release-please-manifest.json`** to reflect the new version so release-please's next version calculation stays correct:

```json
{ ".": "X.Y.Z" }
```
