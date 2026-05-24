## Changelog & releases

### Versioning

Releases follow **semver** with a `v` prefix (e.g. `v0.1.0`, `v1.2.3`). Cut a release when a milestone (or meaningful slice of a milestone) ships to production.

### Cutting a release

**Via CLI:**

```bash
gh release create vX.Y.Z --generate-notes --title "vX.Y.Z — <theme>"
```

**Via GitHub UI:** go to **Releases → Draft a new release**, choose a new tag, then click **Generate release notes**.

### Auto-categorization

Release notes are automatically categorized using `.github/release.yml`. PRs are sorted into sections based on their labels:

| Label(s) | Section |
|---|---|
| `feature`, `enhancement` | 🚀 Features |
| `bug`, `fix` | 🐛 Fixes |
| `docs`, `documentation` | 📝 Documentation |
| `chore`, `refactor`, `ci`, `test`, `dependencies`, `deps` | 🧰 Maintenance |
| anything else | Other Changes |

PRs labelled `ignore-for-release` or `duplicate` are excluded entirely.

> **Note:** `.github/release.yml` must be on the `master` branch for auto-categorization to take effect. PRs merged before the file existed will fall into "Other Changes" (no label match).

### Public changelog

Published GitHub releases are rendered at `/changelog` on the marketing site. Draft releases are not shown — only publish a release once it is ready for public visibility.
