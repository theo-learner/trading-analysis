import { useState } from "react";

// ─── 분석 데이터 (2026-04-12 13:22 UTC 기준) ─────────────────────────────────
const ANALYSIS_DATE = "2026-04-12";
const GENERATED_AT = "13:22 UTC";

// ──────────────────────────────────────────────────────────────────────────────
// 페어 데이터
// 소스: tradingview/screenshots/20260412 (BTC/ETH 1D+4H+1H, SOL 1H)
// HYPE: 데이터 없음 (스크린샷 미제공 → 전일 기준 참고 표기)
// ──────────────────────────────────────────────────────────────────────────────
const pairs = {
  BTC: {
    symbol: "BTCUSDT",
    price: 71033.1,
    change24h: "차트 미확인",
    rsi: { "1D": 44.57, "4H": 59.38, "1H": 44.29 },
    cci: { "1D": 20, "4H": 144.19, "1H": 20 },
    bias: "중립-약세",
    biasColor: "#fbbf24",
    signal: "WAIT / 레벨 대기",
    signalColor: "#fbbf24",

    vrvp: {
      "1D": {
        type: "HVN",
        level: "차트 미확인 (POC 현재가 상방 추정 ~$80k+)",
        note: "1D 볼륨 최대 구간이 현재가 위 — 장기 저항 구간. 현재가는 하부 분포에 위치",
      },
      "4H": {
        type: "HVN",
        level: "~$71,000",
        note: "4H VRVP 밀집 구간. 현재가 위치가 VPOC와 일치 → 지지/저항 분기점",
      },
      "1H": {
        type: "VAH/VAL",
        level: "~$70,500~$71,500",
        note: "1H VAH 근처. 공급 압력 구간. 이탈 시 하방 가속 가능",
      },
    },

    ew: {
      primary: {
        label: "Primary: ATH 이후 하락 ABC 조정 — B파 반등 완료 접근",
        desc:
          "BTC는 ATH ~$109k(2026년 1월 추정) 이후 큰 폭 하락. 3월 이후 반등 중이나 1D 구조는 여전히 약세. " +
          "현재 $71k는 반등 B파의 말미 또는 Wave C 직전 구간으로 판단. " +
          "4H RSI 59.38 / CCI 144.19 단기 과매수 임박. 1D RSI 44.57 — 중립 하방. " +
          "차트에서 'Pi Bear' 시그널 확인. 상방 1D 저항 영역(공급 OB)이 ~$74-76k에 위치. " +
          "Wave C 진행 시 $65,000~$60,000 영역 재방문 가능.",
        invalidation: "$76,000 이상 1D 종가 돌파 → Wave B 연장 또는 추세 전환 재평가",
        confidence: "낮음-중간",
      },
      alternate: {
        label: "Alternate: $65k 저점 바닥 확인 → 1파 임펄스 시작",
        desc:
          "4H RSI 59.38 / CCI 144 과매수 구간에서 'Green(Bull)' 시그널 발생. " +
          "반등의 속도와 구조가 임펄스 패턴과 일치할 경우 새로운 상승 1파 시작 가능. " +
          "단, 1D 데드크로스 + 공급 OB 미돌파 상태에서 확신 어려움.",
        invalidation: "$69,000 이하 종가 이탈 → Alternate 무효",
        confidence: "낮음",
      },
      tf: {
        "1D":
          "데드크로스. 다중 EMA 아래 위치. 공급 OB $74-76k. 'Pi Bear' 시그널. RSI 44.57 (중립 하방). 약세 구조 유지",
        "4H":
          "저점 반등 후 현재 $71k. RSI 59.38 / CCI 144 — 단기 과매수 근접. '녹색 Bull 시그널' 발생. 수요존 $65-67k 유효. 조정 임박",
        "1H":
          "단기 고점 ~$73-74k 이후 되돌림 중. RSI 44.29 하락 추세. '30번째 볼 매도' 노트 확인. 공급 압력 존재",
      },
    },

    ict: {
      structure:
        "1D: 약세 구조 유지 (데드크로스, Lower High 패턴). 4H: 단기 반등 BOS 상방이나 신뢰도 낮음. 공급 OB 미돌파 상태",
      bsl: [
        "$74,000~$76,000 (1D 공급 OB / 스윙 하이 청산 집중)",
        "$80,000 (심리적 저항 / 주요 BSL 상방)",
      ],
      ssl: [
        "$69,000~$70,000 (1H 스윙 로우 청산)",
        "$65,000~$67,000 (4H 수요존 / SSL 집중)",
        "$60,000 (심리적 지지 / 대규모 SSL)",
      ],
      ob: [
        "$74,000~$76,000 베어리시 OB (1D) — 차트에서 붉은 박스로 확인",
        "$65,000~$67,000 불리시 OB (4H) — 녹색 수요존으로 확인",
      ],
      fvg: "$66,000~$70,000 구간 FVG 다수 미충전 (급등 시 갭 구간)",
      discount:
        "현재가 $71,033 — ATH~3월 저점 레인지 기준 하부 Discount 구간. 단, 추세 역전 미확인으로 Discount 매수 위험",
    },

    orderflow: {
      oi: "차트 미확인 (Coinalyze/Exocharts 미제공)",
      oiNote: "전일 -18.89% 참고. 오늘 데이터 없음 — 직접 확인 권장",
      liq: "차트 미확인",
      heatmap:
        "$74,000~$76,000 위 숏 청산 밀집 추정 (차트 미확인). $69,000~$70,000 롱 청산 하방 자석 추정",
      fundingNote: "차트 미확인",
    },

    scenarios: [
      {
        label: "A. 조정 후 $74-76k OB 테스트",
        prob: 25,
        color: "#4ade80",
        trigger: "$71,000 지지 + 4H RSI 과매수 해소 후 재상승",
        target: "$73,500 → $74,500~$76,000 (BSL 스윕)",
        risk: "OB 돌파 실패 시 즉시 분배. 1D 저항 강도 높음",
      },
      {
        label: "B. $69k 이탈 → Wave C 재개",
        prob: 50,
        color: "#f87171",
        trigger: "$70,000 이탈 + 거래량 증가",
        target: "$67,000 → $65,000 → $60,000",
        risk: "1D 추세 약세 + 공급 OB 미돌파 상태에서 가장 높은 확률",
      },
      {
        label: "C. $69-74k 박스 횡보",
        prob: 25,
        color: "#fbbf24",
        trigger: "방향성 부재 — 레인지 유지",
        target: "변동성 수렴 후 돌파 대기",
        risk: "양방향 Fakeout 위험",
      },
    ],

    risk: {
      long: {
        entry: "$70,000~$70,500 (1H 지지 + 수요존 근접)",
        sl: "$69,000 이하 (1H 종가 기준)",
        tp1: "$73,500",
        tp2: "$75,000",
        rr: "1:2.5~3.5",
        note: "중간 위험. 1D 약세 환경 — 소규모 진입 권장",
      },
      short: {
        entry: "$73,500~$75,000 (1D 공급 OB 재테스트)",
        sl: "$76,200 이상",
        tp1: "$70,000",
        tp2: "$67,000",
        rr: "1:2.5",
        note: "최선호 셋업: OB 진입 후 Wave C 초입 포착",
      },
    },
  },

  ETH: {
    symbol: "ETHUSDT",
    price: 2193.4,
    change24h: "차트 미확인",
    rsi: { "1D": 23.58, "4H": 65.59, "1H": 54.03 },
    cci: { "1D": 20, "4H": 153.16, "1H": 151.48 },
    bias: "약세 (극도 과매도)",
    biasColor: "#f87171",
    signal: "HIGH RISK — 반등 관찰",
    signalColor: "#f87171",

    vrvp: {
      "1D": {
        type: "POC 상방",
        level: "~$3,000+ (차트 추정)",
        note: "1D 최대 볼륨 구간이 $3,000+ 위. 현재 $2,193은 장기 볼륨 분포 최하단 — 과도한 하락 영역",
      },
      "4H": {
        type: "HVN",
        level: "~$2,193",
        note: "4H VRVP 밀집 구간에 현재가 위치. 지지/저항 분기점. 이탈 시 $1,900~$2,000으로 빠른 하락",
      },
      "1H": {
        type: "VAH",
        level: "~$2,200~$2,300",
        note: "1H VAH 저항 구간. 공급 박스(붉은색) 위치. 돌파 실패 → 하방 재개 시그널",
      },
    },

    ew: {
      primary: {
        label: "Primary: ATH 이후 하락 파동 — Wave 5 또는 C파 완성 접근",
        desc:
          "ETH는 전 페어 중 가장 심각한 하락. ATH ~$4,000+ 이후 현재 $2,193까지 급락. " +
          "1D RSI 23.58 = 극도 과매도 (역사적 바닥 수준). 다중 'Pi Bear' + '1H Bear' 시그널 발생. " +
          "현재 반등($1,400 저점 → $2,400 테스트 → $2,193 되돌림)은 Wave 4 내 C파 반등 또는 독립 ABC 반등 후 최종 Wave 5 하락 준비 구간. " +
          "Wave 5 타겟: $1,200~$1,500. 단, RSI 극단치에서 역추세 반등(Oversold Bounce) 가능성 병존.",
        invalidation: "$2,600 이상 1D 종가 돌파 → 파동 재산정 필요",
        confidence: "중간",
      },
      alternate: {
        label: "Alternate: $1,400 이중 바닥 → 회복 Wave 1 시작",
        desc:
          "RSI 23.58 극도 과매도는 대형 바닥 신호일 수 있음. $1,400 저점이 Wave C/5 바닥으로 확인되면 현재 반등이 회복 Wave 1. " +
          "4H RSI 65.59 단기 과매수이나 $2,200 안착 시 $2,600~$3,000 회복 가능. " +
          "BTC 동반 회복 필요 조건.",
        invalidation: "$2,000 이하 종가 이탈 → 바닥 미확인",
        confidence: "낮음",
      },
      tf: {
        "1D":
          "극도 과매도 (RSI 23.58). 다중 Bear 시그널. 1D VRVP POC 훨씬 아래에 위치. Wave 5 or C파 말미 가능성. 바닥 탐색 중",
        "4H":
          "저점 이후 강한 반등. RSI 65.59 / CCI 153 과매수. 최근 'Bear' 시그널 발생. $2,193 VRVP 지지 테스트 중. 조정 임박",
        "1H":
          "$2,400+ 고점 이후 하락. 공급 OB (붉은 박스) 확인. RSI 54.03 중립. CCI 151.48 단기 과매수. 추가 하락 가능성",
      },
    },

    ict: {
      structure:
        "1D: 강한 약세 구조 (연속 Lower High). 4H: 단기 반등 구조이나 1D 공급 압력에 막힘. RSI 극단치로 Oversold Bounce 가능성 병존",
      bsl: [
        "$2,350~$2,400 (1H 스윙 하이 청산)",
        "$2,600~$2,700 (4H 고점 청산 집중)",
      ],
      ssl: [
        "$2,100 (심리적 지지 / SSL)",
        "$1,900~$1,800 (중간 수요존)",
        "$1,400~$1,500 (3월 저점 / 주요 SSL 집중)",
      ],
      ob: [
        "$2,300~$2,500 베어리시 OB (4H) — 차트 붉은 박스 확인",
        "$1,700~$1,900 불리시 OB (1D) — 바닥 수요존",
      ],
      fvg: "$1,600~$2,000 구간 FVG 다수 미충전",
      discount:
        "ATH 대비 -45%+. 장기 할인 구간이나 BTC 대비 심각한 상대 약세 지속 중. ETH/BTC 비율 하락 추세",
    },

    orderflow: {
      oi: "차트 미확인 (전일 -78.77% 참고)",
      oiNote:
        "전일 기준 ETH OI -78.77%로 역대급 청산. 레버리지 구조 붕괴 수준. 회복에 상당 시간 필요. 오늘 데이터 미제공",
      liq: "차트 미확인",
      heatmap:
        "$2,350~$2,500 위 숏 청산 추정. $2,000~$2,100 롱 청산 하방 자석 추정 (차트 미확인)",
      fundingNote: "차트 미확인. OI 대규모 청산 이후 펀딩비 정상화 여부 확인 필요",
    },

    scenarios: [
      {
        label: "A. Oversold Bounce — $2,350~$2,600 반등",
        prob: 30,
        color: "#4ade80",
        trigger: "$2,193 VRVP 지지 확인 + RSI 23.58 반등",
        target: "$2,350 → $2,600~$2,700",
        risk: "BTC 동반 하락 시 즉시 이탈. 반등 강도 제한적",
      },
      {
        label: "B. Wave 5/C 하락 재개 — $1,400~$1,200",
        prob: 55,
        color: "#f87171",
        trigger: "$2,100 이탈 + 거래량 급증",
        target: "$1,900 → $1,600 → $1,400~$1,200",
        risk: "1D 추세 + BTC 동반 약세 시 가장 높은 확률",
      },
      {
        label: "C. $2,000~$2,400 박스 횡보",
        prob: 15,
        color: "#fbbf24",
        trigger: "레인지 유지",
        target: "방향성 부재",
        risk: "낮음",
      },
    ],

    risk: {
      long: {
        entry: "$2,100~$2,150 (RSI 극단 + 바닥 탐색 구간)",
        sl: "$1,980 이하",
        tp1: "$2,350",
        tp2: "$2,600",
        rr: "1:2~3",
        note: "⚠️ 극고위험. 바닥 확인 전 진입 금지. 분할 소규모만 허용",
      },
      short: {
        entry: "$2,350~$2,400 (1H 공급 OB 재테스트)",
        sl: "$2,550 이상",
        tp1: "$2,100",
        tp2: "$1,900",
        rr: "1:2.5",
        note: "약세 추세 방향. 반등 후 숏이 선호 셋업",
      },
    },
  },

  SOL: {
    symbol: "SOLUSDT",
    price: 82.0,
    change24h: "차트 미확인",
    rsi: { "1D": "미제공", "4H": "미제공", "1H": 58.86 },
    cci: { "1D": "미제공", "4H": "미제공", "1H": 190.35 },
    bias: "약세 (1H 과매수)",
    biasColor: "#f87171",
    signal: "AVOID — 데이터 부족",
    signalColor: "#9ca3af",

    vrvp: {
      "1D": {
        type: "미제공",
        level: "차트 미제공",
        note: "1D 스크린샷 없음. 전일 HVN $163.38(ATH권), $88.48(단기 저항) 참고",
      },
      "4H": {
        type: "미제공",
        level: "차트 미제공",
        note: "4H 스크린샷 없음. 전일 HVN $88.48 — 현재가 $82 직상 저항으로 유효 추정",
      },
      "1H": {
        type: "VAH",
        level: "~$82~$85 (차트 추정)",
        note: "1H VRVP 핑크/청록색 혼재 — 현재가 VAH 저항 구간에 위치. 공급 압력 존재",
      },
    },

    ew: {
      primary: {
        label: "Primary: 반등 B파 or Dead Cat Bounce 구간 (1H만 확인)",
        desc:
          "SOL은 1H 차트만 제공. ATH ~$290(2025 Q4)에서 ~$60-65(3월 저점) 급락 이후 반등 중. " +
          "현재 $82는 저점 대비 약 28% 반등. 1H RSI 58.86 중립-상승이나 CCI 190.35 = 극도 단기 과매수. " +
          "차트에서 'Golden Zone' 레이블(~$72-75) 표시 확인. 공급 OB(붉은 박스)가 $83-85 구간에 위치. " +
          "'Bear' 시그널 발생 확인. 단기 고점 형성 후 되돌림 가능성 높음.",
        invalidation: "$90 이상 돌파 시 추세 재평가 (1H 데이터 기준)",
        confidence: "낮음 (1H 단일 타임프레임)",
      },
      alternate: {
        label: "Alternate: Golden Zone 지지 후 $90~$100 회복",
        desc:
          "1H 차트 'Golden Zone' ~$72-75 지지 확인 후 재상승. $88-90 저항 돌파 시 $100 심리적 레벨 도전 가능. " +
          "단, 1D/4H 데이터 미제공으로 전체 구조 확인 불가.",
        invalidation: "$78 이하 이탈",
        confidence: "낮음",
      },
      tf: {
        "1D": "데이터 미제공 — 전일 분석 참고: $60대 저점 반등. 구조적 약세 유지",
        "4H": "데이터 미제공 — 전일 분석 참고: $85-90 저항 직면",
        "1H":
          "CCI 190.35 극도 과매수. RSI 58.86 중립-상승. 공급 OB $83-85 확인. 'Bear' 시그널 발생. 단기 조정 임박",
      },
    },

    ict: {
      structure:
        "1H 기준: 단기 반등 구조이나 공급 OB 직면. CCI 190 극단치. 1D/4H 미확인으로 전체 구조 판단 불가",
      bsl: [
        "$85~$88 (1H 공급 OB 상단)",
        "$90~$100 (심리적 BSL)",
      ],
      ssl: [
        "$78~$80 (1H 스윙 로우)",
        "$72~$75 (Golden Zone 지지)",
        "$65~$60 (3월 저점 SSL 집중)",
      ],
      ob: [
        "$83~$85 베어리시 OB (1H) — 차트 붉은 박스 확인",
        "$72~$75 불리시 OB (1H Golden Zone) — 차트 확인",
      ],
      fvg: "1H 기준 $75~$82 구간 일부 FVG 존재 (차트 추정)",
      discount: "ATH $290 대비 -72%. 극단적 할인이나 추세 역전 1H만으로 확인 불가",
    },

    orderflow: {
      oi: "차트 미확인 (Coinalyze 미제공)",
      oiNote: "BTC/ETH와 유사한 OI 감소 패턴 예상. 직접 확인 권장",
      liq: "차트 미확인",
      heatmap: "차트 미확인. $88-90 위 숏 청산 밀집 추정",
      fundingNote: "차트 미확인",
    },

    scenarios: [
      {
        label: "A. 과매수 해소 후 $72-75 Golden Zone 터치",
        prob: 50,
        color: "#f87171",
        trigger: "$82 지지 이탈 + CCI 190 되돌림",
        target: "$78~$75 (Golden Zone)",
        risk: "BTC 동반 하락 시 더 깊은 되돌림",
      },
      {
        label: "B. $85~$88 저항 돌파 — 단기 강세",
        prob: 25,
        color: "#4ade80",
        trigger: "$85 공급 OB 돌파 + 거래량 급증",
        target: "$90 → $95~$100",
        risk: "1D/4H 데이터 미확인 — 고위험",
      },
      {
        label: "C. $78~$85 박스 횡보",
        prob: 25,
        color: "#fbbf24",
        trigger: "레인지 유지",
        target: "방향 대기",
        risk: "낮음",
      },
    ],

    risk: {
      long: {
        entry: "$75~$78 (Golden Zone 지지 확인 후)",
        sl: "$72 이하",
        tp1: "$83",
        tp2: "$88",
        rr: "1:2",
        note: "⚠️ 1H 단일 타임프레임. 1D/4H 확인 전 진입 최소화",
      },
      short: {
        entry: "$83~$85 (1H 공급 OB 진입)",
        sl: "$88 이상",
        tp1: "$78",
        tp2: "$75",
        rr: "1:2",
        note: "CCI 190 과매수 환경에서 OB 숏이 최선호 1H 셋업",
      },
    },
  },

  HYPE: {
    symbol: "HYPEUSDT",
    price: null,
    change24h: "미제공",
    rsi: { "1D": "미제공", "4H": "미제공", "1H": "미제공" },
    cci: { "1D": "미제공", "4H": "미제공", "1H": "미제공" },
    bias: "데이터 없음",
    biasColor: "#9ca3af",
    signal: "데이터 미제공",
    signalColor: "#9ca3af",

    vrvp: {
      "1D": { type: "미제공", level: "차트 미제공", note: "오늘 스크린샷 없음" },
      "4H": { type: "미제공", level: "차트 미제공", note: "오늘 스크린샷 없음" },
      "1H": { type: "미제공", level: "차트 미제공", note: "오늘 스크린샷 없음" },
    },

    ew: {
      primary: {
        label: "데이터 미제공 — 전일(04-11) 기준 참고",
        desc:
          "오늘 HYPE 스크린샷이 제공되지 않았습니다. 전일 분석 참고: HYPE는 BTC/ETH 대비 상대 강세 유지. " +
          "$13 저점(3월) → $42~$47 반등 후 조정 구간. 전일 가격 약 $42.3. " +
          "전일 1D VRVP HVN $37.96 / 4H HVN $38.35 지지. " +
          "오늘 분석을 위해 스크린샷 제공이 필요합니다.",
        invalidation: "데이터 없음",
        confidence: "해당 없음",
      },
      alternate: {
        label: "N/A",
        desc: "오늘 데이터 미제공. 전일 분석 참고 바람.",
        invalidation: "N/A",
        confidence: "해당 없음",
      },
      tf: {
        "1D": "미제공 — 전일: ATH 이후 반등, 상대 강세 유지",
        "4H": "미제공 — 전일: 단기 조정 구간",
        "1H": "미제공 — 전일: $39~$40 VRVP 지지 위",
      },
    },

    ict: {
      structure: "데이터 없음. 전일 기준: 전 타임프레임 강세 구조 (HH-HL). 유일한 강세 페어였음",
      bsl: ["미제공", "$47~$48 (전일 기준 스윙 하이)"],
      ssl: ["미제공", "$39.38 (전일 1H VRVP)", "$37.96 (전일 1D VRVP)"],
      ob: ["미제공", "$38~$40 불리시 OB (전일 4H 기준)"],
      fvg: "미제공",
      discount: "미제공",
    },

    orderflow: {
      oi: "미제공 (전일 +18.93%)",
      oiNote: "전일 OI 증가 확인. 오늘 데이터 없음",
      liq: "미제공",
      heatmap: "미제공",
      fundingNote: "미제공",
    },

    scenarios: [
      {
        label: "데이터 없음 — 분석 불가",
        prob: 0,
        color: "#9ca3af",
        trigger: "오늘 스크린샷 미제공",
        target: "N/A",
        risk: "데이터 확보 후 재분석 필요",
      },
    ],

    risk: {
      long: {
        entry: "미제공",
        sl: "미제공",
        tp1: "미제공",
        tp2: "미제공",
        rr: "N/A",
        note: "오늘 HYPE 스크린샷이 없습니다. 분석 불가. 전일(04-11) 대시보드 참고 바람.",
      },
      short: {
        entry: "미제공",
        sl: "미제공",
        tp1: "미제공",
        tp2: "미제공",
        rr: "N/A",
        note: "데이터 없음",
      },
    },
  },
};

// ─── 스타일 상수 ─────────────────────────────────────────────────────────────
const S = {
  bg: "#0b0e14",
  panel: "#131720",
  card: "#1a1f2e",
  border: "#2a3044",
  textMain: "#e8eaed",
  textSub: "#9ca3af",
  bull: "#4ade80",
  bear: "#f87171",
  neutral: "#fbbf24",
  heatHigh: "#f59e0b",
  cvdPos: "#22d3ee",
  cvdNeg: "#fb923c",
  conv: "#a78bfa",
};

const tabs = ["Overview", "Elliott Wave", "ICT", "Orderflow", "Scenarios", "Risk"];

function Tag({ color, children }) {
  return (
    <span
      style={{
        background: color + "22",
        color,
        border: `1px solid ${color}44`,
        borderRadius: 4,
        padding: "2px 8px",
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 0.5,
      }}
    >
      {children}
    </span>
  );
}

function ProbBar({ prob, color }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div
        style={{
          flex: 1,
          height: 6,
          background: S.border,
          borderRadius: 3,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${prob}%`,
            height: "100%",
            background: color,
            borderRadius: 3,
          }}
        />
      </div>
      <span style={{ color, fontSize: 13, fontWeight: 700, minWidth: 36 }}>{prob}%</span>
    </div>
  );
}

function Card({ children, style }) {
  return (
    <div
      style={{
        background: S.card,
        border: `1px solid ${S.border}`,
        borderRadius: 8,
        padding: 16,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div
      style={{
        color: S.textSub,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 1,
        textTransform: "uppercase",
        marginBottom: 10,
        borderBottom: `1px solid ${S.border}`,
        paddingBottom: 6,
      }}
    >
      {children}
    </div>
  );
}

function RSIRow({ pair }) {
  const p = pairs[pair];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
      {["1D", "4H", "1H"].map((tf) => {
        const rsi = p.rsi[tf];
        const cci = p.cci[tf];
        const rsiNum = typeof rsi === "number" ? rsi : null;
        const rsiColor =
          rsiNum === null
            ? S.textSub
            : rsiNum >= 70
            ? S.bear
            : rsiNum <= 30
            ? S.bull
            : rsiNum >= 55
            ? "#22d3ee"
            : rsiNum <= 45
            ? S.cvdNeg
            : S.neutral;
        return (
          <div key={tf} style={{ padding: 10, background: S.panel, borderRadius: 6 }}>
            <div style={{ color: S.textSub, fontSize: 11, marginBottom: 4 }}>{tf} RSI</div>
            <div style={{ color: rsiColor, fontWeight: 700, fontSize: 18 }}>
              {rsiNum !== null ? rsiNum.toFixed(2) : rsi}
            </div>
            <div style={{ color: S.textSub, fontSize: 11, marginTop: 4 }}>
              CCI: {typeof cci === "number" ? cci.toFixed(2) : cci}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function VrvpSection({ pair }) {
  const p = pairs[pair];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {Object.entries(p.vrvp).map(([tf, data]) => (
        <div
          key={tf}
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            padding: "8px 0",
            borderBottom: `1px solid ${S.border}`,
          }}
        >
          <span style={{ color: S.textSub, fontSize: 12, minWidth: 28, paddingTop: 2 }}>{tf}</span>
          <Tag color={data.type === "미제공" ? S.textSub : S.conv}>{data.type}</Tag>
          <div>
            <div style={{ color: S.textMain, fontWeight: 700, fontSize: 14 }}>{data.level}</div>
            <div style={{ color: S.textSub, fontSize: 12, marginTop: 2 }}>{data.note}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function OverviewTab({ pair }) {
  const p = pairs[pair];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      {/* 현재가 & 바이어스 */}
      <Card style={{ gridColumn: "1 / -1" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ color: S.textSub, fontSize: 12 }}>
              {p.symbol} · {ANALYSIS_DATE} {GENERATED_AT}
            </div>
            <div style={{ color: S.textMain, fontSize: 32, fontWeight: 700, marginTop: 4 }}>
              {p.price !== null ? `$${p.price.toLocaleString()}` : "데이터 없음"}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <Tag color={p.biasColor}>{p.bias}</Tag>
            <div style={{ marginTop: 8 }}>
              <Tag color={p.signalColor}>{p.signal}</Tag>
            </div>
          </div>
        </div>
      </Card>

      {/* RSI/CCI 멀티 타임프레임 */}
      <Card style={{ gridColumn: "1 / -1" }}>
        <SectionTitle>RSI / CCI 멀티타임프레임</SectionTitle>
        <RSIRow pair={pair} />
      </Card>

      {/* VRVP 레벨 */}
      <Card>
        <SectionTitle>VRVP 핵심 레벨</SectionTitle>
        <VrvpSection pair={pair} />
      </Card>

      {/* 오더플로우 요약 */}
      <Card>
        <SectionTitle>Orderflow 요약</SectionTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <div style={{ color: S.textSub, fontSize: 11 }}>Open Interest</div>
            <div style={{ color: S.cvdPos, fontWeight: 700, fontSize: 14 }}>
              {p.orderflow.oi}
            </div>
            <div style={{ color: S.textSub, fontSize: 12 }}>{p.orderflow.oiNote}</div>
          </div>
          <div style={{ borderTop: `1px solid ${S.border}`, paddingTop: 10 }}>
            <div style={{ color: S.textSub, fontSize: 11 }}>청산 (24h)</div>
            <div style={{ color: S.neutral, fontWeight: 700, fontSize: 14 }}>
              {p.orderflow.liq}
            </div>
          </div>
          <div style={{ borderTop: `1px solid ${S.border}`, paddingTop: 10 }}>
            <div style={{ color: S.textSub, fontSize: 11 }}>Liquidation Heatmap</div>
            <div style={{ color: S.textMain, fontSize: 13 }}>{p.orderflow.heatmap}</div>
          </div>
        </div>
      </Card>

      {/* 시나리오 확률 요약 */}
      <Card style={{ gridColumn: "1 / -1" }}>
        <SectionTitle>시나리오 확률 요약</SectionTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {p.scenarios.map((s, i) => (
            <div key={i}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ color: s.color, fontSize: 13, fontWeight: 600 }}>{s.label}</span>
              </div>
              <ProbBar prob={s.prob} color={s.color} />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function EWTab({ pair }) {
  const p = pairs[pair];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Card>
        <SectionTitle>Primary Count</SectionTitle>
        <Tag color={S.conv}>{p.ew.primary.label}</Tag>
        <p style={{ color: S.textMain, fontSize: 14, marginTop: 10, lineHeight: 1.7 }}>
          {p.ew.primary.desc}
        </p>
        <div style={{ marginTop: 10, padding: 10, background: S.panel, borderRadius: 6 }}>
          <span style={{ color: S.bear, fontSize: 12, fontWeight: 700 }}>무효화: </span>
          <span style={{ color: S.textMain, fontSize: 12 }}>{p.ew.primary.invalidation}</span>
          <span style={{ marginLeft: 12, color: S.textSub, fontSize: 12 }}>
            확신도: {p.ew.primary.confidence}
          </span>
        </div>
      </Card>

      <Card>
        <SectionTitle>Alternate Count</SectionTitle>
        <Tag color={S.neutral}>{p.ew.alternate.label}</Tag>
        <p style={{ color: S.textMain, fontSize: 14, marginTop: 10, lineHeight: 1.7 }}>
          {p.ew.alternate.desc}
        </p>
        <div style={{ marginTop: 10, padding: 10, background: S.panel, borderRadius: 6 }}>
          <span style={{ color: S.bear, fontSize: 12, fontWeight: 700 }}>무효화: </span>
          <span style={{ color: S.textMain, fontSize: 12 }}>{p.ew.alternate.invalidation}</span>
          <span style={{ marginLeft: 12, color: S.textSub, fontSize: 12 }}>
            확신도: {p.ew.alternate.confidence}
          </span>
        </div>
      </Card>

      <Card>
        <SectionTitle>타임프레임별 EW 구조</SectionTitle>
        {Object.entries(p.ew.tf).map(([tf, desc]) => (
          <div
            key={tf}
            style={{
              display: "flex",
              gap: 12,
              padding: "8px 0",
              borderBottom: `1px solid ${S.border}`,
            }}
          >
            <span
              style={{
                color: S.conv,
                fontSize: 12,
                fontWeight: 700,
                minWidth: 28,
                paddingTop: 2,
              }}
            >
              {tf}
            </span>
            <span style={{ color: S.textMain, fontSize: 13, lineHeight: 1.6 }}>{desc}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}

function ICTTab({ pair }) {
  const p = pairs[pair];
  const ic = p.ict;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Card>
        <SectionTitle>Market Structure</SectionTitle>
        <p style={{ color: S.textMain, fontSize: 14, lineHeight: 1.7 }}>{ic.structure}</p>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Card>
          <SectionTitle>BSL (Buy Side Liquidity)</SectionTitle>
          {ic.bsl.map((l, i) => (
            <div
              key={i}
              style={{
                color: S.bull,
                fontSize: 13,
                padding: "5px 0",
                borderBottom: `1px solid ${S.border}`,
              }}
            >
              ↑ {l}
            </div>
          ))}
        </Card>
        <Card>
          <SectionTitle>SSL (Sell Side Liquidity)</SectionTitle>
          {ic.ssl.map((l, i) => (
            <div
              key={i}
              style={{
                color: S.bear,
                fontSize: 13,
                padding: "5px 0",
                borderBottom: `1px solid ${S.border}`,
              }}
            >
              ↓ {l}
            </div>
          ))}
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Card>
          <SectionTitle>Order Blocks</SectionTitle>
          {ic.ob.map((o, i) => (
            <div key={i} style={{ color: S.conv, fontSize: 13, padding: "5px 0" }}>
              {o}
            </div>
          ))}
        </Card>
        <Card>
          <SectionTitle>FVG / Discount Zone</SectionTitle>
          <div style={{ color: S.heatHigh, fontSize: 13, marginBottom: 8 }}>{ic.fvg}</div>
          <div style={{ color: S.textSub, fontSize: 12, lineHeight: 1.6 }}>{ic.discount}</div>
        </Card>
      </div>
    </div>
  );
}

function OrderflowTab({ pair }) {
  const p = pairs[pair];
  const of_ = p.orderflow;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Card>
        <SectionTitle>Open Interest</SectionTitle>
        <div style={{ fontSize: 22, fontWeight: 700, color: S.cvdPos }}>{of_.oi}</div>
        <p style={{ color: S.textMain, fontSize: 14, marginTop: 8, lineHeight: 1.7 }}>
          {of_.oiNote}
        </p>
      </Card>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Card>
          <SectionTitle>Liquidation 24h</SectionTitle>
          <div style={{ color: S.neutral, fontWeight: 700, fontSize: 18 }}>{of_.liq}</div>
        </Card>
        <Card>
          <SectionTitle>Funding Rate</SectionTitle>
          <div style={{ color: S.textSub, fontSize: 13 }}>{of_.fundingNote}</div>
        </Card>
      </div>
      <Card>
        <SectionTitle>Liquidation Heatmap 요약</SectionTitle>
        <p style={{ color: S.textMain, fontSize: 14, lineHeight: 1.7 }}>{of_.heatmap}</p>
        <div
          style={{
            marginTop: 10,
            padding: 10,
            background: S.panel,
            borderRadius: 6,
            color: S.textSub,
            fontSize: 12,
          }}
        >
          ※ 오늘 Exocharts / Coinalyze / Hyblock 스크린샷이 제공되지 않았습니다. 오더플로우 항목은
          차트에서 확인된 데이터가 없으므로 "차트 미확인"으로 표기합니다. 직접 확인 후 반영 권장.
        </div>
      </Card>
    </div>
  );
}

function ScenariosTab({ pair }) {
  const p = pairs[pair];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {p.scenarios.map((s, i) => (
        <Card key={i}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: 12,
            }}
          >
            <Tag color={s.color}>{s.label}</Tag>
            <span style={{ color: s.color, fontWeight: 700, fontSize: 20 }}>{s.prob}%</span>
          </div>
          <ProbBar prob={s.prob} color={s.color} />
          <div
            style={{
              marginTop: 12,
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
            }}
          >
            <div style={{ padding: 10, background: S.panel, borderRadius: 6 }}>
              <div style={{ color: S.textSub, fontSize: 11 }}>트리거</div>
              <div style={{ color: S.textMain, fontSize: 13, marginTop: 4 }}>{s.trigger}</div>
            </div>
            <div style={{ padding: 10, background: S.panel, borderRadius: 6 }}>
              <div style={{ color: S.textSub, fontSize: 11 }}>타겟</div>
              <div style={{ color: s.color, fontSize: 13, fontWeight: 600, marginTop: 4 }}>
                {s.target}
              </div>
            </div>
          </div>
          <div
            style={{
              marginTop: 8,
              padding: "6px 10px",
              background: "#f8717122",
              borderRadius: 4,
            }}
          >
            <span style={{ color: S.bear, fontSize: 12 }}>리스크: </span>
            <span style={{ color: S.textMain, fontSize: 12 }}>{s.risk}</span>
          </div>
        </Card>
      ))}
    </div>
  );
}

function RiskTab({ pair }) {
  const p = pairs[pair];
  const r = p.risk;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Card>
        <SectionTitle>Long Setup</SectionTitle>
        {r.long.note && (
          <div
            style={{
              marginBottom: 10,
              padding: "6px 10px",
              background: "#4ade8022",
              borderRadius: 4,
            }}
          >
            <span style={{ color: S.bull, fontSize: 13 }}>{r.long.note}</span>
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
          {[
            { label: "진입", val: r.long.entry, color: S.bull },
            { label: "손절 (SL)", val: r.long.sl, color: S.bear },
            { label: "TP1", val: r.long.tp1, color: S.bull },
            { label: "TP2", val: r.long.tp2, color: S.bull },
            { label: "R:R", val: r.long.rr, color: S.conv },
          ].map((item, i) => (
            <div key={i} style={{ padding: 10, background: S.panel, borderRadius: 6 }}>
              <div style={{ color: S.textSub, fontSize: 11 }}>{item.label}</div>
              <div style={{ color: item.color, fontWeight: 700, fontSize: 15, marginTop: 4 }}>
                {item.val}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle>Short Setup</SectionTitle>
        {r.short.note && (
          <div
            style={{
              marginBottom: 10,
              padding: "6px 10px",
              background: "#f8717122",
              borderRadius: 4,
            }}
          >
            <span style={{ color: S.bear, fontSize: 13 }}>{r.short.note}</span>
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
          {[
            { label: "진입", val: r.short.entry, color: S.bear },
            { label: "손절 (SL)", val: r.short.sl, color: S.bull },
            { label: "TP1", val: r.short.tp1, color: S.bear },
            { label: "TP2", val: r.short.tp2, color: S.bear },
            { label: "R:R", val: r.short.rr, color: S.conv },
          ].map((item, i) => (
            <div key={i} style={{ padding: 10, background: S.panel, borderRadius: 6 }}>
              <div style={{ color: S.textSub, fontSize: 11 }}>{item.label}</div>
              <div style={{ color: item.color, fontWeight: 700, fontSize: 15, marginTop: 4 }}>
                {item.val}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

export default function Dashboard() {
  const [activePair, setActivePair] = useState("BTC");
  const [activeTab, setActiveTab] = useState("Overview");

  const pairKeys = Object.keys(pairs);

  const renderTab = () => {
    switch (activeTab) {
      case "Overview":
        return <OverviewTab pair={activePair} />;
      case "Elliott Wave":
        return <EWTab pair={activePair} />;
      case "ICT":
        return <ICTTab pair={activePair} />;
      case "Orderflow":
        return <OrderflowTab pair={activePair} />;
      case "Scenarios":
        return <ScenariosTab pair={activePair} />;
      case "Risk":
        return <RiskTab pair={activePair} />;
      default:
        return null;
    }
  };

  return (
    <div style={{ background: S.bg, minHeight: "100vh", fontFamily: "monospace", color: S.textMain }}>
      {/* Header */}
      <div
        style={{
          background: S.panel,
          borderBottom: `1px solid ${S.border}`,
          padding: "12px 20px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <span style={{ color: S.textSub, fontSize: 12 }}>Crypto Futures Analysis</span>
            <span style={{ color: S.border, margin: "0 8px" }}>|</span>
            <span style={{ color: S.textMain, fontWeight: 700 }}>{ANALYSIS_DATE}</span>
            <span style={{ color: S.textSub, fontSize: 12, marginLeft: 8 }}>{GENERATED_AT}</span>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <Tag color={S.bear}>BTC RSI 44.57 중립↓</Tag>
            <Tag color={S.bear}>ETH RSI 23.58 극과매도</Tag>
            <Tag color={S.neutral}>SOL 1H CCI 190 과매수</Tag>
            <Tag color={S.textSub}>HYPE 데이터 없음</Tag>
          </div>
        </div>
      </div>

      <div style={{ padding: "16px 20px" }}>
        {/* Pair Selector */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {pairKeys.map((pk) => {
            const p = pairs[pk];
            const active = pk === activePair;
            return (
              <button
                key={pk}
                onClick={() => setActivePair(pk)}
                style={{
                  background: active ? S.card : "transparent",
                  border: `1px solid ${active ? p.biasColor : S.border}`,
                  borderRadius: 6,
                  padding: "8px 16px",
                  cursor: "pointer",
                  color: active ? p.biasColor : S.textSub,
                  fontWeight: active ? 700 : 400,
                  fontFamily: "monospace",
                  fontSize: 13,
                  transition: "all 0.15s",
                }}
              >
                {pk}
                <span style={{ marginLeft: 8, fontSize: 11, color: p.biasColor }}>
                  {p.price !== null ? `$${p.price.toLocaleString()}` : "N/A"}
                </span>
              </button>
            );
          })}
        </div>

        {/* Tab Selector */}
        <div
          style={{
            display: "flex",
            gap: 4,
            marginBottom: 16,
            background: S.panel,
            borderRadius: 8,
            padding: 4,
            border: `1px solid ${S.border}`,
          }}
        >
          {tabs.map((t) => {
            const active = t === activeTab;
            return (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                style={{
                  flex: 1,
                  background: active ? S.card : "transparent",
                  border: "none",
                  borderRadius: 6,
                  padding: "7px 4px",
                  cursor: "pointer",
                  color: active ? S.textMain : S.textSub,
                  fontWeight: active ? 700 : 400,
                  fontFamily: "monospace",
                  fontSize: 12,
                  transition: "all 0.15s",
                }}
              >
                {t}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        {renderTab()}

        {/* 데이터 가용성 알림 */}
        <div
          style={{
            marginTop: 16,
            padding: 12,
            background: S.card,
            border: `1px solid ${S.border}`,
            borderRadius: 8,
          }}
        >
          <div style={{ color: S.neutral, fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
            ⚠ 2026-04-12 데이터 가용성 현황
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 8,
              fontSize: 12,
            }}
          >
            {[
              { pair: "BTC", status: "1D+4H+1H ✓", color: S.bull },
              { pair: "ETH", status: "1D+4H+1H ✓", color: S.bull },
              { pair: "SOL", status: "1H만 ⚠", color: S.neutral },
              { pair: "HYPE", status: "없음 ✗", color: S.bear },
            ].map((item) => (
              <div key={item.pair} style={{ padding: 8, background: S.panel, borderRadius: 6 }}>
                <div style={{ color: S.textSub, fontSize: 11 }}>{item.pair}</div>
                <div style={{ color: item.color, fontWeight: 700, marginTop: 2 }}>{item.status}</div>
              </div>
            ))}
          </div>
          <div style={{ color: S.textSub, fontSize: 11, marginTop: 8 }}>
            Exocharts / Coinalyze / Hyblock 오더플로우 스크린샷 미제공. 오더플로우 항목은 전일 참고
            또는 직접 확인 요망.
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            marginTop: 16,
            padding: "10px 0",
            borderTop: `1px solid ${S.border}`,
            color: S.textSub,
            fontSize: 11,
            textAlign: "center",
          }}
        >
          EW + ICT/SMC + Orderflow 통합 분석 | 차트에서 확인된 데이터만 포함 | 투자 조언 아님
        </div>
      </div>
    </div>
  );
}
