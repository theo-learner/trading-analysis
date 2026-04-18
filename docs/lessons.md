# Lessons Learned

- When tab contracts change in this dashboard, update both the rendered `tabs` array and the root `CLAUDE.md` generation rules in the same change to avoid drift.
- For standalone React/Babel HTML dashboards, keep new UI state aligned with existing top-level selectors (`selectedPair`, `activeTab`) instead of introducing duplicate sources of truth.
- Preserve legacy descriptive analysis text behind a toggle when replacing dense text tabs with summary components; this reduces UI noise without discarding analyst context.
- For this standalone dashboard, derive new overview summaries from existing structured analysis fields instead of introducing duplicate strategy data into `PAIRS`; this keeps analyst-authored inputs single-sourced.
- For contributor guides in this automation repo, document both tracked outputs (`reports/`, `docs/`) and ignored runtime state (`sessions/`, `screenshots/`, `logs/`) so contributors know what must never be committed.
- For generated dashboards, keep `CLAUDE.md`, `run-analysis.md`, and `reports/_mobile_snippet.md` on the same tab contract; updating only one source-of-truth guarantees the next auto-generated report will regress.
- For macOS hook notifications that need click behavior, prefer `terminal-notifier` over `osascript display notification`; the latter is fine for passive alerts but does not provide a reliable click action contract.
- In Bash hook scripts, avoid embedding large heredocs inside nested command substitutions when a `python3 -c` or helper function can express the same logic more simply; the flatter form is easier to syntax-check and less brittle during future edits.
- For this trading dashboard, prefer design systems that preserve semantic bull/bear/neutral color roles and data-density readability; styles built around a single accent or bright light surfaces are better used as secondary influence, not the primary visual contract.
- Dark-theme dashboards generated from templates carry hardcoded dark-only patterns (inset white shadows, dark gradients) that live outside the token object. When retheming, always grep for `rgba(255,255,255,0.0` and `linear-gradient.*C.card` after token swap.
