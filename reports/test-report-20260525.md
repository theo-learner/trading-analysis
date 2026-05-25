# Test Report — 2026-05-25 11:30 KST

## Summary

| Test Suite | Pass | Fail | Total |
|---|---|---|---|
| ict-engine.test.js | 24 | 0 | 24 |
| notify.test.js | 9 | 0 | 9 |
| modules/*.test.js | 82 | 8 | 90 |
| functional-dashboard.js | 25 | 3 | 28 |
| watcher.test.js | 3 | 3 | 6 |
| **Total** | **143** | **14** | **157** |

**Overall: 91.1% pass rate**

---

## ✅ Passing (143 tests)

### ict-engine.test.js (24/24)
- analyzeICT: direction detection (bull/bear/ranging/NEUTRAL)
- analyzeICT: candle count validation
- analyzeICT: KST timezone
- analyzeICT: required signal fields
- analyzeICT: aligned scenarios (ENTER/SKIP)
- selectBestPOI: in-range filtering, out-of-range null, LONG/SHORT variants, crossing exclusion
- analyzeICT: killzone as string, swingRanges, SL < entry for LONG
- calculateTP: structural targets, R:R fallback

### notify.test.js (9/9)
- disabled gate, env gate, judge rejection, dedup, credentials failure, happy path, sendFn throw

### modules tests (82/90)
- alignment: tier scoring, isAligned, canTrade
- amd: ACCUMULATION, MANIPULATION, DISTRIBUTION, RESET, edge cases
- diary: 6-step markdown, frontmatter, Unicorn, grading, swing range, data-insufficient
- displacement: body size, opposite wick, close proximity, zero avg
- FVG: bull/bear detection, minGapPct, mitigation, tested→mitigated transition
- BOS: bullish/bearish, wick breakout rejection
- trend: ranging (fewer than 4 swings), HH+HL bull
- filterByRecentSwings: boundary inclusion, cutoff logic
- MSS: CHoCH alone ≠ MSS
- Order Blocks: bullish/bearish, invalidated
- Scorecard: grade=S/grade=B, premium tier4 SKIP
- Liquidity Sweeps: BSL/SSL confirmed/unconfirmed, follow-through, range filtering, omitted suffix

---

## ❌ Failing (14 tests)

### modules/swing-points.test.js (5 fails)
**Root cause:** `detectSwingPoints` logic has been modified but tests expect old behavior (or vice versa). Tests describe edge cases:
1. Pivot high detection (expected 1, got 5)
2. Pivot low detection (expected 1, got 5)
3. Boundary candles exclusion (index 0 included)
4. Neighbor ties (strict comparison)
5. Swing-low push loop position

### modules/binance.test.js (1 fail)
- `fetchKlines` raw array → candle object mapping (expected 2 candles, got 0)
- Likely `fetchKlines` implementation changed since test was written

### modules/diary.test.js (2 fails)
- Step 3 sweep filtering: swing range cutoff produces unexpected sweep in output
- Omitted suffix: `$103,510` not found, expected `* (외 2개 범위 외 생략)*`
- Both related to swing range boundary logic for sweep display

### functional-dashboard.js (3 fails)
1. **FVG mitigated state**: Mitigated FVG doesn't have close in gap (edge case in mitigation logic)
2. **Signal panel display**: After analysis, no signal card/placeholder shown — result not rendered to DOM
3. **Console JS error**: 409 Conflict on `/api/analyze` (expected — concurrent analysis lock)

### watcher.test.js (3 fails)
- `run()` doesn't iterate pairs (likely `pairs` config not loaded in test env)
- Error handling during iteration (BTCUSDT call not recorded)
- Sent result logging (no "SENT" in logs)
- All related to pairs configuration not being set up in test

---

## Known Pre-existing Issues
- **swing-points.test.js**: 5 failures — these pre-dated recent changes (confirmed in memory: 2026-05-23)
- **binance.test.js**: 1 failure — fetchKlines mapping mismatch
- **diary.test.js**: 2 failures — swing range boundary logic in sweep display
- **watcher.test.js**: 3 failures — test setup issue (pairs config)

## Recent Changes That May Have Caused New Failures
- `/api/analyze` now returns 409 on concurrent calls → functional-dashboard console error
- `runDiary()` now auto-calls on page load (init.js change) — no test coverage yet
