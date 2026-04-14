# 세션 저장 가이드

프로젝트를 처음 실행하기 전에 각 플랫폼의 로그인 세션을 저장해야 합니다.
세션 파일은 `sessions/` 폴더에 JSON으로 저장되며, 보통 2~4주간 유효합니다.

---

## 사전 준비

```bash
cd /Users/theo/workspace_tokamak/trading-analysis
npm install          # playwright 설치
npx playwright install chromium   # 브라우저 엔진 설치
```

---

## 1. TradingView (필수)

```bash
npm run save-session:tv
```

1. Chromium 브라우저가 열리며 TradingView 로그인 페이지로 이동합니다
2. 평소 사용하는 방법으로 로그인하세요 (이메일, Google, Apple 등)
3. 로그인 완료 후 차트가 보이는 상태에서 **터미널로 돌아와 Enter**
4. `sessions/tv-session.json` 생성 확인

> **TradingView Pro+ 이상** 계정이면 더 많은 인디케이터와 타임프레임에 접근 가능합니다.
> 무료 계정도 기본 캔들 차트 캡처는 가능합니다.

---

## 2. Exocharts (권장)

```bash
npm run save-session:exo
```

1. Exocharts 로그인 페이지로 이동합니다
2. 계정으로 로그인하세요
3. 대시보드가 보이면 터미널에서 Enter
4. `sessions/exo-session.json` 생성 확인

> Exocharts 무료 계정으로도 히트맵 기본 뷰는 접근 가능합니다.
> Pro 계정이면 CVD, 풋프린트 등 추가 데이터에 접근 가능합니다.

---

## 3. Coinalyze (선택)

```bash
npm run save-session:coinalyze
```

1. Coinalyze 로그인 페이지로 이동합니다
2. 로그인 후 차트가 보이면 Enter
3. `sessions/coinalyze-session.json` 생성 확인

> Coinalyze는 로그인 없이도 기본 OI/펀딩비 차트 접근 가능합니다.
> 세션 없이도 캡처 스크립트가 동작하지만, 로그인하면 더 많은 데이터를 볼 수 있습니다.

---

## 4. Hyblock Capital (선택)

```bash
npm run save-session:hyblock
```

1. Hyblock 로그인 페이지로 이동합니다
2. 로그인 후 대시보드가 보이면 Enter
3. `sessions/hyblock-session.json` 생성 확인

> ⚠️ Hyblock은 **로그인 필수** — 세션 없으면 캡처가 건너뛰어집니다.

---

## 모든 플랫폼 한 번에

```bash
npm run save-session
```

순차적으로 4개 플랫폼 로그인을 진행합니다. 각 플랫폼마다 로그인 후 Enter를 누르세요.

---

## 세션 만료 시

세션이 만료되면 캡처 시 로그인 팝업이 뜨거나 빈 화면이 캡처됩니다.
해당 플랫폼의 세션 저장 명령을 다시 실행하면 됩니다.

```bash
# 예: TradingView 세션만 갱신
npm run save-session:tv
```

---

## Clean 레이아웃 설정 (독립 분석용)

캡처 시 사용자가 수동으로 그린 드로잉(지지/저항선, EW 레이블, 텍스트 메모 등)이 포함되면 Claude의 독립 분석이 오염됩니다. Clean 레이아웃을 설정하면 캡처 시 드로잉이 없는 순수 차트를 사용합니다.

**1회 설정, 이후 자동 적용**

### 설정 절차

1. TradingView 브라우저에서 로그인 후 차트 열기
2. 상단 레이아웃 메뉴 → **"새 레이아웃"** 생성 → 이름: `trading-analysis-clean`
3. 드로잉이 있으면 모두 제거: 좌측 Object Tree 패널 → **"Remove All"**
4. 분석에 필요한 **내장 지표만** 추가 (EMA, RSI, MACD, VRVP 등)
5. 레이아웃 저장 후 브라우저 URL 확인:
   ```
   https://www.tradingview.com/chart/AbCdEf12/
   ```
   `/chart/` 다음의 영문+숫자 코드가 `layoutId`
6. `scripts/config/clean-layout.json` 파일 생성 (예시 파일 복사):
   ```bash
   cp scripts/config/clean-layout.example.json scripts/config/clean-layout.json
   ```
7. `layoutId` 값을 실제 ID로 교체:
   ```json
   {
     "layoutId": "AbCdEf12",
     "note": "Clean analysis layout — indicators only, no drawings",
     "savedAt": "2026-04-13"
   }
   ```

> `clean-layout.json`은 `.gitignore`에 포함되어 있어 커밋되지 않습니다.
> 파일이 없으면 캡처 스크립트는 기존 기본 레이아웃으로 fallback하며 경고를 출력합니다.

---

## 캡처 테스트

세션 저장 후 제대로 동작하는지 확인:

```bash
# TradingView만 빠르게 테스트
npm run capture:tv

# 오더플로우 플랫폼만 테스트
npm run capture:orderflow

# 전체 캡처
npm run capture
```

캡처된 파일은 `screenshots/YYYYMMDD/` 폴더에서 확인할 수 있습니다.
