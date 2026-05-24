# Changelog page (marketing) — verification screenshots

Captured 2026-05-23 in a real browser against `next dev` on `:3000`, with the page fetching live GitHub Releases from `Token-Buzz/website` via a server-side token. Confirms the `/changelog` route end to end: the `v0.1.0` release renders with its title, tag badge, date, and markdown body (headings, bold, bullet list), styled to match the site, with working Nav/Footer links. **Verdict: PASS.**

- `changelog-desktop.png` — 1280×900. `v0.1.0 — Initial release` with the `🚀 Highlights` / `📝 Notes` markdown sections rendered via react-markdown.
- `changelog-mobile.png` — 390×844. Single-column reflow; release content and footer remain readable.

Notes:
- Private repo, so releases are fetched **server-side** (`CHANGELOG_GITHUB_TOKEN`/`GH_TOKEN`); the token is never exposed to the client. ISR `revalidate: 3600`.
- Empty/error state (`No releases yet — check back soon.`) renders when the token is missing or zero published releases exist; drafts are excluded.
