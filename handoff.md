# Session handoff — TokenBuzz

This repo uses a **layered memory model**, not a rolling handoff doc. Don't rewrite this
file with status each session — put status in the relevant **issue**. Look here, in order:

## Where things live
1. **Durable knowledge** (architecture, conventions, testing, deploy, secrets) → `CLAUDE.md` + the `project-conventions` skill.
2. **Per-milestone plans/specs** → `docs/milestones/M*.md` + the milestone's **epic issue** (GitHub Project 1, org `Token-Buzz`).
3. **Live status** (done / in-flight / blockers / next steps / gotchas) → the epic issue's **"Status / Next steps / Gotchas"** section + the board's Status column. **This is the source of truth — not this file.**

## Starting a new session
The **SessionStart hook** (`.claude/hooks/session-start.sh`) auto-prints orientation at the
top of every conversation: recent commits, open PRs, open milestones, recently-updated issues.
Read it, then open the epic issue for whichever milestone is active.

## Current focus (pointer only — details live in the issues)
- **M1** — `#22 Alerts` is the remaining phase.
- **M1.5 (mobile)** — epic `#82`, next after M1.
- **#88 Changelog** — shipped (merged in #81); only open item is seeding the `GITHUB_CHANGELOG_TOKEN` value in prod.
- **#89 Time tracking (Toggl)** — blocked on the user's `TOGGL_API_TOKEN`.

> Keep this file a pointer. Status updates go in the relevant **issue**, not here.
