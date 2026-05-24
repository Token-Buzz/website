#!/usr/bin/env bash
# Stop hook: pause the AI Toggl timer at the end of each turn.
#
# Part of the per-turn time-tracking model (issue #89): track-resume.sh (the
# UserPromptSubmit hook) starts the timer when you send a prompt; this pauses it
# when Claude finishes the turn. The active-issue state file is KEPT so the next
# prompt resumes the same issue — only `track ai-stop` clears it.
#
# `ai-pause` only stops entries tagged `ai`, so a human timer started in the
# Toggl app is never auto-stopped. Silent no-op when Toggl creds are absent; all
# output discarded; always exits 0 so it can never block.
set -uo pipefail

DIR="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || echo .)}"
STATE="$DIR/.claude/.track-current.json"

[ -n "${TOGGL_API_TOKEN:-}" ] && [ -n "${TOGGL_WORKSPACE_ID:-}" ] || exit 0
# No active issue → nothing we started could be running; skip the API call.
[ -f "$STATE" ] || exit 0

TRACK_STATE_FILE="$STATE" timeout 15 \
  npm run -s track --prefix "$DIR/packages/scripts" -- ai-pause >/dev/null 2>&1 || true

exit 0
