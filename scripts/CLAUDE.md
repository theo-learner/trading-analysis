# scripts/ — 스크립트 구조

## 주요 진입점
- `watcher.js`: PM2 `ict-watcher` 프로세스. 매 분 4페어 × 15m ICT 분석 + Telegram 알림
- `ict-engine.js`: ICT 분석 코어. `config/ict-engine.json` 파라미터 사용
- `trader.js`: 주문 실행. `config/trader.json` 설정 + `sessions/trade.env` hot-reload
- `dashboard-server.js`: PM2 `trading-dashboard` 프로세스. 포트 3210

## 모듈 구조
- `modules/`: ICT 알고리즘 단위 모듈 (fvg, order-block, market-structure 등)
- `utils/`: 공통 유틸 (`binance.js` = Bybit 우선/Binance 폴백, `telegram.js`, `load-env.js`)
- `exchanges/`: 거래소 어댑터 (`bybit.js` primary, `binance.js` fallback)
- `config/`: `trader.json`, `ict-engine.json`, `clean-layout.json`
