# scripts/config/ — 설정 파일

- `trader.json`: 거래소(bybit/binance), 리스크 파라미터, 실행 모드(dry-run/live). API 키는 `sessions/trade.env` 또는 `sessions/*.txt`
- `ict-engine.json`: ICT 알고리즘 파라미터 (swingPoint, FVG, displacement, OB 등). `ict-engine-spec.md §18` 기준
- `clean-layout.example.json`: TradingView clean 캡처 레이아웃 예시. 실제 파일은 `sessions/` 에 보관
