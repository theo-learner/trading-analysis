# Global Stop Hook Zed Activation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the global Codex `Stop` hook notification clickable so clicking it activates the Zed application.

**Architecture:** Keep the existing global hook entry and payload-summary logic intact, but replace the notification transport in the hook script with a `terminal-notifier` path that supports click actions. Preserve the current macOS notification behavior as a fallback so the hook still works when `terminal-notifier` is unavailable.

**Tech Stack:** Bash, macOS `open`, `terminal-notifier`, `osascript`, jq, python3

---

### Task 1: Update the Global Stop Hook Notification Path

**Files:**
- Modify: `/Users/theo/.codex/hooks/zed-task-complete.sh`

- [ ] **Step 1: Re-read the existing hook script before editing**

Run: `sed -n '1,240p' /Users/theo/.codex/hooks/zed-task-complete.sh`
Expected: The script shows payload parsing, `osascript` notification output, and `afplay` sound playback.

- [ ] **Step 2: Replace the notification section with a clickable `terminal-notifier` path and `osascript` fallback**

Apply this change to `/Users/theo/.codex/hooks/zed-task-complete.sh`:

```bash
#!/usr/bin/env bash

set -u

payload=''
if [ ! -t 0 ]; then
  payload="$(cat 2>/dev/null || true)"
fi

title='Codex task complete'
body='The current Codex task finished.'
sound_file='/System/Library/Sounds/Glass.aiff'

if [ -n "$payload" ] && command -v jq >/dev/null 2>&1 && command -v python3 >/dev/null 2>&1; then
  extracted_message="$(
    printf '%s' "$payload" | jq -r '.last_assistant_message // empty' 2>/dev/null || true
  )"

  if [ -n "$extracted_message" ]; then
    summary="$(
      MESSAGE="$extracted_message" python3 -c '
import os
import re

message = os.environ.get("MESSAGE", "").strip()
if not message:
    raise SystemExit(0)

message = re.sub(r"```.*?```", " ", message, flags=re.S)
lines = []
for raw in message.splitlines():
    line = raw.strip()
    if not line:
        continue
    line = re.sub(r"^(#{1,6}\s*|[-*+]\s+|\d+\.\s+|>\s*)", "", line).strip()
    line = re.sub(r"`([^`]+)`", r"\1", line)
    line = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", line)
    line = re.sub(r"\s+", " ", line).strip(" -")
    if line:
        lines.append(line)

meta_patterns = [
    r"^(작업|구현|수정|변경|반영).{0,20}(완료|했습니다|됨)[.!]?$",
    r"^(done|completed|finished|implemented|updated)[.!]?$",
]

summary = ""
for line in lines:
    if any(re.match(pattern, line, re.I) for pattern in meta_patterns):
        continue
    summary = line
    break

if not summary and lines:
    summary = lines[0]

summary = summary[:140].rstrip()
print(summary)
'
    )"

    if [ -n "$summary" ]; then
      body="$summary"
    fi
  fi
fi

if command -v terminal-notifier >/dev/null 2>&1; then
  terminal-notifier \
    -title "$title" \
    -message "$body" \
    -activate 'dev.zed.Zed' \
    >/dev/null 2>&1 || true
else
  osascript -e "display notification \"$body\" with title \"$title\"" >/dev/null 2>&1 || true
fi

if command -v afplay >/dev/null 2>&1 && [ -f "$sound_file" ]; then
  afplay "$sound_file" >/dev/null 2>&1 || true
fi

exit 0
```

- [ ] **Step 3: Re-read the updated hook script to confirm the click-action path**

Run: `sed -n '1,240p' /Users/theo/.codex/hooks/zed-task-complete.sh`
Expected: The script now prefers `terminal-notifier` with `-activate 'dev.zed.Zed'` and falls back to `osascript`.

### Task 2: Verify Notification Delivery and Zed Activation

**Files:**
- Verify: `/Users/theo/.codex/hooks/zed-task-complete.sh`

- [ ] **Step 1: Run the hook without payload**

Run: `bash /Users/theo/.codex/hooks/zed-task-complete.sh`
Expected: A macOS notification appears and the script exits successfully.

- [ ] **Step 2: Run the hook with payload summary input**

Run:

```bash
printf '%s' '{"last_assistant_message":"# Done\n\nUpdated the stop hook so clicking the alert opens Zed."}' | bash /Users/theo/.codex/hooks/zed-task-complete.sh
```

Expected: The notification body uses `Updated the stop hook so clicking the alert opens Zed.` or a shortened equivalent.

- [ ] **Step 3: Click the notification**

Manual check: Click the most recent notification banner or Notification Center entry.
Expected: Zed becomes the foreground application.

- [ ] **Step 4: Capture the diff for review**

Run: `git diff -- docs/todo.md docs/superpowers/specs/2026-04-18-global-stop-hook-zed-activation-design.md docs/superpowers/plans/2026-04-18-global-stop-hook-zed-activation.md`
Expected: Repo docs changes are visible. The global hook file change will not appear in repo diff because it is outside the repository.
