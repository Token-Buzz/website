# claude-starter — portable Claude Code config for a new (Terraform) repo

This directory is a **starter set** ported from the `Token-Buzz/website` repo,
stripped of that project's Next.js/SST/DynamoDB/Clerk specifics and re-pointed at
a Terraform stack. Copy it into the root of the new repo and fill in the
`<FILL IN>` markers.

## What's here

```
claude-starter/
├── CLAUDE.md                                  # project guidance (Terraform-adapted)
└── .claude/
    ├── settings.json                          # hook wiring (+ empty permission allow-list)
    ├── hooks/
    │   ├── remind-delegate.sh                 # nudge: orchestrator delegates code edits
    │   └── session-start.sh                   # dep bootstrap + GitHub orientation
    └── skills/
        ├── project-conventions/SKILL.md       # evergreen workflow rules
        └── tf-checks/SKILL.md                 # fmt/validate/plan/lint/policy audit
```

## How to use

1. Copy `CLAUDE.md` and `.claude/` into the new repo root:
   ```bash
   cp claude-starter/CLAUDE.md  /path/to/new-repo/CLAUDE.md
   cp -r claude-starter/.claude /path/to/new-repo/.claude
   chmod +x /path/to/new-repo/.claude/hooks/*.sh
   ```
   (Note: `.claude` is a hidden directory — `cp -r claude-starter/.claude` copies it
   correctly; just don't forget it when eyeballing the source tree.)

2. Search the copied files for `<FILL IN>` and replace each:
   - `CLAUDE.md` — repo layout, exact commands, backend/state config, secrets list.
   - `.claude/hooks/session-start.sh` — the `REPO=` slug and the bootstrap command.
   - `.claude/skills/project-conventions/SKILL.md` — the technology-stack table.

3. Add `/.claude/settings.local.json` to the new repo's `.gitignore` — that file is
   per-developer (machine paths, personal MCP tokens) and was intentionally **not**
   ported.

4. Decide on the cycle-time stamp helper: the source repo shipped a
   `packages/scripts` stamp script for GitHub Projects. The conventions reference it,
   but the script itself is not portable. Either re-implement a small `gh`-based
   stamp helper in the new repo or delete the stamping bullets from
   `project-conventions/SKILL.md`.
