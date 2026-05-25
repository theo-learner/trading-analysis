# Test Report — 2026-05-25 12:30 KST (Bybit migration)

## Summary

| Test Suite | Pass | Fail | Total |
|---|---|---|---|
| binance.test.js | 5 | 0 | 5 |
| ict-engine.test.js | 24 | 0 | 24 |
| notify.test.js | 9 | 0 | 9 |
| modules/*.test.js | 82 | 8 | 90 |
| functional-dashboard.js | 25 | 3 | 28 |
| watcher.test.js | 3 | 3 | 6 |
| **Total** | **148** | **14** | **162** |

**Overall: 91.4% pass rate** (was 91.1%)

## Changes
- ✅ Binance → Bybit API migration
- ✅ binance.test.js updated to mock Bybit response
- ✅ New test case: 'fetchKlines throws on bybit retCode !== 0'

## New failures: NONE
## Pre-existing failures (unchanged):
- swing-points.test.js: 5 (pre-existing)
- diary.test.js: 2 (pre-existing)
- functional-dashboard.js: 3 (pre-existing)
- watcher.test.js: 3 (pre-existing)
