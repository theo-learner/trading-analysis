# 분석 실행 절차

## 실행 조건
screenshots/오늘날짜/ 폴더에 캡처 파일이 존재해야 함

## 절차

1. `screenshots/오늘날짜/` 폴더 확인 — 하위 카테고리별 파일 존재 확인
2. **페어별 순차 분석** (BTCUSDT → ETHUSDT → SOLUSDT → HYPEUSDT):
   a. TradingView 1D → 4H → 1H 순서로 멀티타임프레임 분석
   b. 해당 페어의 Exocharts 히트맵/CVD 확인 (있는 경우)
   c. 해당 페어의 Coinalyze OI/펀딩비 확인 (있는 경우)
   d. 해당 페어의 Hyblock 유동성 레벨 확인 (있는 경우)
3. 프레임워크별 분석 수행:
   - Elliott Wave: Primary + Alternate Count, 피보나치 레벨, 무효화 레벨
   - ICT/SMC: BSL/SSL, OB/FVG, Premium/Discount, Market Maker Model
   - Orderflow: 히트맵 유동성 벽, CVD 방향, OI 매트릭스 (데이터 있는 경우)
4. 통합 시나리오 A/B/C 작성 + 확률 산출
5. 리스크 관리 제안 (진입/SL/TP/R:R)
6. `reports/오늘날짜_dashboard.html` 로 HTML 대시보드 저장 (standalone: React/Babel CDN 포함 + `<script type="text/babel">` 안에 컴포넌트 내장)
7. 분석 완료 메시지 출력
