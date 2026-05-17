# Global Stop Hook Zed Activation Design

## Goal

Make the global Codex `Stop` hook notification clickable so a click brings the Zed application to the foreground.

## Current Context

The global hook entry in `/Users/theo/.codex/hooks.json` runs `/Users/theo/.codex/hooks/zed-task-complete.sh` on `Stop`. That script already builds a concise summary from the payload, shows a macOS notification with `osascript`, and plays a sound. The current notification API does not define a click action.

## Approach Options

### Recommended: `terminal-notifier` with Zed activation

Use `terminal-notifier` instead of `osascript` for the notification path when the binary exists. Attach a click action that activates Zed, while keeping the existing summary extraction and sound playback code unchanged. This is the smallest change and matches the user's requested behavior directly.

### Alternative: Always activate Zed without click

Call `open -a Zed` immediately when the hook runs and keep the notification informational only. This is simpler but changes behavior and ignores the user's explicit click requirement.

## Selected Design

The hook script will prefer `terminal-notifier` and send a notification with the same title/body as today plus a click action that activates Zed. If `terminal-notifier` is unavailable, the script will fall back to the current `osascript display notification` behavior so the hook still emits a notification.

Activation will use the installed Zed application bundle through `open -a Zed`, because Zed is present at `/Applications/Zed.app` and this avoids coupling to a shell-specific CLI path.

## Error Handling

- If `terminal-notifier` is missing, use the current `osascript` notification path.
- If `open -a Zed` fails on click, the notification still appears and the hook still exits successfully.
- The existing payload parsing remains best-effort and must not make the hook fail.

## Verification

- Trigger the hook script directly and confirm a notification appears.
- Click the notification and verify Zed becomes the foreground app.
- Re-run once with the payload path to confirm the summary text still renders.
