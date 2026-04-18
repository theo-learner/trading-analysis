# 2026-04-16 EW+ICT Unified Tab

## Plan

- [x] Expand `PAIRS` analysis data for BTC/ETH/SOL/HYPE with unified-tab fields.
- [x] Replace separate Elliott Wave / ICT tabs with a single analysis tab UI.
- [x] Update project guidance to reflect the unified analysis tab structure.
- [x] Verify the dashboard renders without runtime errors and record the result.
- [x] Capture implementation review notes and lessons learned.

## Review

- Unified the dashboard tab structure to `Overview / Macro / 분석 / Orderflow / Scenarios / Risk` and removed legacy EW/ICT component paths.
- Implemented a single analysis surface with pair selection, shared TF selector, TF alignment bar, EW wave stepper, ICT summary grid, confluence tags, and expandable source text.
- Updated root guidance with the analysis-tab schema contract so future dashboard generations keep the new data shape and null-handling rules.
- Verified the HTML in Chromium runtime at desktop and mobile widths with no console errors during tab, pair, TF, and text-toggle interactions.

# 2026-04-16 Overview Strategy Recommendation

## Plan

- [x] Add reusable helpers that rank scenarios and derive entry/TP/SL levels from existing pair data.
- [x] Render a strategy recommendation grid in `Overview` with Primary and Alternate blocks for all pairs.
- [x] Verify desktop/mobile rendering and confirm Wait fallback paths do not throw runtime errors.
- [x] Capture review notes and lessons learned.

## Review

- Added overview-only strategy derivation helpers that convert scenario probabilities and existing price levels into actionable Primary/Alternate plans without changing the `PAIRS` schema.
- Inserted a responsive strategy grid between the pair summary cards and market EMA overview so each pair now exposes action, entry, TP, SL, and rationale at a glance.
- Verified the dashboard in desktop and mobile layouts with no runtime errors and confirmed fallback `Wait` rendering remains stable when numeric inputs are unavailable.

# 2026-04-18 AGENTS Contributor Guide

## Plan

- [x] Inspect the repository layout, npm scripts, and existing documentation patterns.
- [x] Draft a concise contributor guide covering structure, commands, style, testing, and delivery expectations.
- [x] Add `AGENTS.md` at the repository root with repository-specific examples and guardrails.
- [x] Verify the document content against the current repo state and capture a reusable lesson.

## Review

- Documented the operational layout around `scripts/`, `reports/`, `screenshots/`, `sessions/`, `references/`, and `docs/`.
- Listed the actual setup and workflow commands from `package.json` and session setup guidance instead of generic placeholders.
- Clarified that this repo uses focused Playwright verification scripts rather than a formal Jest/Vitest test suite.
- Recorded commit/PR guidance from recent Conventional Commit history and added a security note for ignored session/config artifacts.

# 2026-04-18 Unified Analysis Tab Regression Fix

## Plan

- [x] Add a focused regression check that fails when a dashboard reverts to separate `Elliott Wave` and `ICT` tabs.
- [x] Update the generation instructions in `run-analysis.md` to require the unified `분석` tab and its data contract.
- [x] Replace outdated mobile snippet guidance that still teaches separate EW/ICT tab components.
- [x] Regenerate or repair `reports/20260418_dashboard.html` so it matches the unified-tab implementation.
- [x] Re-run verification and record the root cause plus prevention notes.

## Review

- Added `scripts/verify-unified-analysis-dashboard.js` and confirmed the original `reports/20260418_dashboard.html` failed before the fix.
- Updated `run-analysis.md` so the generator now requires `AnalysisTab` and forbids separate `EWTab` / `ICTTab` routes.
- Replaced the stale mobile snippet guidance with the selected-pair unified analysis pattern and clarified that section 5 and section 6 must be applied together.
- Reworked `reports/20260418_dashboard.html` to use a single `분석` tab with `TFAlignmentBar`, `EWWaveStep`, `ICTGrid`, and `AnalysisTab` routing while preserving the existing 4/18 macro/orderflow/scenario/risk content.
- Verified the repaired dashboard with the regression script and browser rendering; Playwright showed `분석` tab rendering with 0 runtime errors and only the expected Babel warning.

# 2026-04-18 Global Stop Hook Zed Activation

## Plan

- [x] Inspect the global stop-hook implementation and confirm how notification clicks can trigger actions on macOS.
- [x] Write and review a short design for activating Zed when the stop-hook notification is clicked.
- [x] Update the global hook script under `~/.codex/hooks/` with a clickable-notification path and a safe fallback.
- [x] Verify the hook manually and record the result plus any reusable lesson.

## Review

- Updated the global `Stop` hook implementation in `/Users/theo/.codex/hooks/zed-task-complete.sh` to prefer `terminal-notifier` with `-activate dev.zed.Zed`, while preserving `osascript` as a fallback when clickable notifications are unavailable.
- Kept the existing payload-to-summary behavior and sound playback, but rewrote the Python summary extraction from a fragile heredoc form to a `python3 -c` form so `bash -n` passes reliably.
- Verified the hook exits successfully with and without payload input, confirmed `open -b dev.zed.Zed` resolves the installed Zed bundle, and intercepted the notifier invocation to prove it sends the expected `-message` summary plus `-activate dev.zed.Zed`.

# 2026-04-18 Dashboard Design Direction Review

## Plan

- [x] Inspect the current dashboard UI structure, tokens, and responsive patterns in `reports/20260418_dashboard.html`.
- [x] Review TypeUI design skill candidates and compare them against this repo's data-dense trading dashboard use case.
- [x] Choose a recommended design direction plus fallback options with explicit fit / risk reasoning.
- [x] Write a phased application plan that can be executed without breaking the existing tab and data contracts.

## Review

- Recommended `Dashboard` as the base visual system because its cloud-platform dark theme, modular grids, semantic tokens, and data hierarchy align with this project's tabbed analytics dashboard structure.
- Rejected `Perspective` as the primary system even though its layered hierarchy is strong, because the single green accent model conflicts with the existing bull / bear / neutral trading semantics. Kept it as a secondary influence for depth and section emphasis only.
- Rejected `Paper` as the primary system because its white-surface, whitespace-heavy language would require a larger visual reset and works against the current long-session dark dashboard usage.
- Planned a three-phase rollout:
  1. Foundation pass: extract the current inline hex values into a richer token object, swap the system font for an engineering-grade family, and unify spacing / radius / stroke rules.
  2. Structural pass: redesign header, tab bar, card shells, and section headers around stronger hierarchy while preserving the existing `Overview / Macro / 분석 / Orderflow / Scenarios / Risk` contract.
  3. Accent pass: add restrained gradients, panel depth, and purposeful emphasis states to analysis, scenario, and risk surfaces without harming readability or mobile density.
- Defined success criteria for the future implementation: faster tab scanning, clearer pair selection state, stronger separation between summary and detail zones, preserved mobile usability, and zero regression in existing dashboard data rendering.

# 2026-04-18 Dashboard Redesign

## Plan

- [x] Align the dashboard token system and typography with the approved redesign direction.
- [x] Rework shared controls and shell-level layout without changing the tab contract.
- [x] Refresh tab-specific cards and emphasis states while preserving data rendering behavior.
- [x] Verify desktop/mobile rendering and capture review notes plus lessons learned.

## Review

- Applied TypeUI Clean light theme: white surfaces, Poppins/Roboto/Inconsolata, #3B82F6 primary, underline tab active state.
- Token swap + primitive updates handled 80% of the change; dark-only inset shadows and gradients required manual neutralization.
- All tab contracts, data rendering, and mobile layout preserved.
