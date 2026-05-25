#!/bin/bash
# SessionStart hook.
# 1. In remote (web) containers, prepare the workspace so plan/lint work on a fresh clone.
# 2. Always print GitHub orientation so a new conversation knows where things stand
#    (its stdout is injected into the session context).
set -uo pipefail

REPO="<FILL IN: owner/repo>"   # e.g. "Token-Buzz/infra"

# --- 1. Bootstrap (remote web only; local devs manage their own tree) ---
# Terraform: init providers/modules WITHOUT touching remote state so a fresh
# clone can `validate`/`fmt`/`plan` offline. Drop `-backend=false` if you need
# a real backend in-session (and have credentials wired up).
if [ "${CLAUDE_CODE_REMOTE:-}" = "true" ]; then
  if command -v terraform >/dev/null 2>&1 && ls ./*.tf >/dev/null 2>&1; then
    terraform init -backend=false -input=false >/tmp/session-tf-init.log 2>&1 \
      || echo "WARNING: terraform init failed — see /tmp/session-tf-init.log"
  fi
fi

# --- 2. Orientation (best-effort; never fail the hook on these) ---
echo "## Session orientation — $(date -u '+%Y-%m-%d %H:%M UTC')"
echo
echo "### Recent commits"
git log --oneline -8 2>/dev/null || true
echo
echo "### Open PRs"
gh pr list --repo "$REPO" --state open \
  --json number,title,headRefName \
  --jq '.[] | "#\(.number) \(.title)  [\(.headRefName)]"' 2>/dev/null || echo "(gh unavailable)"
echo
echo "### Open milestones"
gh api "repos/$REPO/milestones?state=open" \
  --jq 'sort_by(.title) | .[] | "\(.title) — \(.open_issues) open / \(.closed_issues) closed"' 2>/dev/null || true
echo
echo "### Recently updated open issues"
gh issue list --repo "$REPO" --state open --limit 12 \
  --json number,title,milestone \
  --jq '.[] | "#\(.number) \(.title)\(if .milestone then "  ("+.milestone.title+")" else "" end)"' 2>/dev/null || true
echo
echo "### Where to look"
echo "- Live status: the current milestone's epic issue (Status section) + the GitHub Project board."
echo "- Plans/specs: docs/milestones/*.md"
echo "- Continuity model + active gotchas: the milestone's epic issue (Status section)"
