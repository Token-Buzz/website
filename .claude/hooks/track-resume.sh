#!/usr/bin/env bash
# UserPromptSubmit hook: resume the AI Toggl timer for the active issue.
#
# Part of the per-turn time-tracking model (issue #89): each turn the timer is
# resumed here and paused again by track-pause.sh (the Stop hook), so only AI
# active time is logged, not idle time while Claude waits for the next prompt.
#
# Silent no-op when Toggl creds OR the active-issue state file are absent, so it
# never disrupts contributors/sessions that aren't tracking. ALL output is
# discarded (UserPromptSubmit stdout would otherwise be injected into the prompt
# context) and the hook always exits 0 so it can never block a turn.
set -uo pipefail

DIR="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || echo .)}"
STATE="$DIR/.claude/.track-current.json"

# No creds → nothing to do.
[ -n "${TOGGL_API_TOKEN:-}" ] && [ -n "${TOGGL_WORKSPACE_ID:-}" ] || exit 0
# No active issue seeded by `track ai-start` → nothing to resume.
[ -f "$STATE" ] || exit 0

TRACK_STATE_FILE="$STATE" timeout 15 \
  npm run -s track --prefix "$DIR/packages/scripts" -- ai-resume >/dev/null 2>&1 || true

exit 0
