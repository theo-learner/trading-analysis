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
