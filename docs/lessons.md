# Lessons Learned

- When tab contracts change in this dashboard, update both the rendered `tabs` array and the root `CLAUDE.md` generation rules in the same change to avoid drift.
- For standalone React/Babel HTML dashboards, keep new UI state aligned with existing top-level selectors (`selectedPair`, `activeTab`) instead of introducing duplicate sources of truth.
- Preserve legacy descriptive analysis text behind a toggle when replacing dense text tabs with summary components; this reduces UI noise without discarding analyst context.
- For this standalone dashboard, derive new overview summaries from existing structured analysis fields instead of introducing duplicate strategy data into `PAIRS`; this keeps analyst-authored inputs single-sourced.
