import { useState } from "react";

// ─── 분석 데이터 (2026-04-11 10:15 UTC 기준) ─────────────────────────────────
const ANALYSIS_DATE = "2026-04-11";
const GENERATED_AT = "10:15 UTC";

const pairs = {
  BTC: {
    symbol: "BTCUSDT",
    price: 72774.9,
    bias: "중립",
    biasColor: "#fbbf24",
    signal: "WAIT",
    signalColor: "#fbbf24",

    vrvp: {
      "1D": { hvn: 97239, note: "ATH~현재 분포 최대 HVN — 핵심 저항" },
      "4H": { hvn: 71165, note: "직전 지지 HVN — 이탈 시 약세 전환" },
      "1H": { lvn: 70363, note: "LVN — 지지 이탈 시 갭 속도 빠름" },
    },

    ew: {
      primary: {
        label: "Primary: 조정 B파 반등 중",
        desc: "ATH ~$109k(1월) 이후 하락 5파 완성 추정(Wave A ~$65k 착지). 현재 반등은 Wave B 가능성. 1D 구조상 $77k 고점 넘지 못하고 되돌리면 Wave C 진행. Wave C 타겟: $58,000~$62,000.",
        invalidation: "$78,500 이상 종가 돌파 → B파 연장 또는 추세 전환",
        confidence: "낮음-중간",
      },
      alternate: {
        label: "Alternate: 반등 충격파 1파 시작",
        desc: "$65k 저점이 최종 바닥이라면 현재는 상승 충격 1파 초입. $70k 지지 유지가 조건. 그러나 시장구조가 아직 lower-high 패턴으로 확인 불충분.",
        invalidation: "$70,000 이하 종가 이탈 → Alternate 무효",
        confidence: "낮음",
      },
      tf: {
        "1D": "하락 5파 완성 후 ABC 조정 중 → B파 반등 구간, $73-77k 저항",
        "4H": "V자 반등 이후 $72-73k 저항권 직면. 되돌림 or 횡보 후 돌파 확인 필요",
        "1H": "단기 상승 후 $72-74k 박스권 형성. 모멘텀 감소 징후",
      },
    },

    ict: {
      structure: "4H BOS 상방 (급등 후) → 단기 강세 구조이나 1D는 여전히 약세",
      bsl: ["$74,000~$75,000 (최근 스윙 하이 청산 집중)", "$77,000 (4H 고점 BSL)"],
      ssl: ["$71,165 (4H VRVP HVN)", "$70,363 (1H VRVP LVN 하단)"],
      ob: ["$70,400~$71,000 불리시 OB (4H)", "$65,000~$68,000 수요존 (1D)"],
      fvg: "$66,000~$70,000 구간 FVG 다수 존재 (급등 시 미충전)",
      discount: "현재가 $72,774 — ATH~저점 레인지 기준 Discount 구간 내에 있음",
    },

    orderflow: {
      oi: "-18.89% (대규모 포지션 청산/디레버리지)",
      oiNote: "OI 감소 + 가격 반등 = 숏 청산 주도 가능성",
      liq: "24h BTC 청산 $22.9M",
      heatmap: "$74,000~$75,000 위 숏 청산 밀집, $70,000~$71,000 롱 청산 존재",
      fundingNote: "차트 미확인 (데이터 없음)",
    },

    scenarios: [
      {
        label: "A. 반등 지속 (B파 연장)",
        prob: 35,
        color: "#4ade80",
        trigger: "$72,000 지지 유지 + $74k 돌파",
        target: "$74,000 → $77,000 (BSL 스윕)",
        risk: "RSI 과열 시 즉시 분배 가능",
      },
      {
        label: "B. Wave C 하락 재개",
        prob: 45,
        color: "#f87171",
        trigger: "$71,165 이탈 + 볼륨 증가",
        target: "$68,000 → $62,000~$58,000",
        risk: "거시 악재(관세/유동성) 재등장 촉매",
      },
      {
        label: "C. 횡보 박스권",
        prob: 20,
        color: "#fbbf24",
        trigger: "$70,000~$75,000 레인지 유지",
        target: "방향성 없음, 변동성 수렴",
        risk: "양방향 허위 돌파 위험",
      },
    ],

    risk: {
      long: {
        entry: "$71,165~$71,500 (VRVP 4H HVN 지지)",
        sl: "$70,000 이하 (1H 종가 기준)",
        tp1: "$74,000",
        tp2: "$77,000",
        rr: "1:3.5",
      },
      short: {
        entry: "$73,500~$74,000 (저항 재테스트)",
        sl: "$75,200 이상",
        tp1: "$71,000",
        tp2: "$68,000",
        rr: "1:2.5",
      },
    },
  },

  ETH: {
    symbol: "ETHUSDT",
    price: 2239.0,
    bias: "약세",
    biasColor: "#f87171",
    signal: "AVOID LONG",
    signalColor: "#f87171",

    vrvp: {
      "1D": { hvn: 3437.46, note: "1D 최대 HVN — 장기 저항" },
      "4H": { hvn: 2189.81, note: "직전 지지 HVN" },
      "1H": { hvn: 2162.90, note: "1H HVN 지지선" },
    },

    ew: {
      primary: {
        label: "Primary: 하락 조정 Wave C 진행 가능성",
        desc: "ETH는 BTC 대비 심각한 상대 약세. 고점 ~$4,100(2025년 말)에서 저점 ~$1,400(3월 폭락). 현재 $2,239는 하락 레인지의 약 36% 반등 수준으로 약한 편. Wave B 반등이라면 Wave C에서 $1,200~$1,400 재방문 가능.",
        invalidation: "$2,600 이상 종가 돌파 → B파 연장",
        confidence: "중간",
      },
      alternate: {
        label: "Alternate: 이중 바닥 후 회복",
        desc: "$1,400 지지 후 회복세. $2,200 안착 시 점진적 회복 가능. 그러나 BTC 도미넌스 상승 환경에서 확률 낮음.",
        invalidation: "$2,100 이탈",
        confidence: "낮음",
      },
      tf: {
        "1D": "ATH 대비 -45% 수준. 반등 중이나 구조적 약세 지속",
        "4H": "고점 ~$2,600→ 현재 $2,239 하락. 되돌림 구간",
        "1H": "$2,200~$2,300 박스권 형성 중",
      },
    },

    ict: {
      structure: "1D 약세 구조 유지. 4H 단기 반등 구조이나 신뢰도 낮음",
      bsl: ["$2,400~$2,450 (스윙 하이)", "$2,600 (4H 고점)"],
      ssl: ["$2,162 (1H VRVP)", "$2,100 (심리적 지지)", "$1,800~$1,400 (하방 수요)"],
      ob: ["$2,100~$2,200 불리시 OB (4H)", "$1,400~$1,600 수요존 (1D)"],
      fvg: "$1,600~$2,000 FVG 다수 미충전",
      discount: "ATH~저점 기준 Discount 구간이나 BTC 대비 상대 약세 심각",
    },

    orderflow: {
      oi: "-78.77% (ETH 선물 대규모 청산 — 역대급 수준)",
      oiNote: "OI 급감은 레버리지 구조 붕괴 신호. 회복에 시간 필요",
      liq: "24h ETH 청산 $22.2M",
      heatmap: "차트 미확인 (캡처 오류 — BTC 화면 중복)",
      fundingNote: "차트 미확인",
    },

    scenarios: [
      {
        label: "A. $2,100~$2,200 지지 후 회복",
        prob: 30,
        color: "#4ade80",
        trigger: "$2,189 VRVP 지지 확인",
        target: "$2,400~$2,600",
        risk: "BTC 동반 하락 시 연쇄 이탈",
      },
      {
        label: "B. Wave C 하락 — $1,600~$1,400 재방문",
        prob: 55,
        color: "#f87171",
        trigger: "$2,100 이탈",
        target: "$1,800 → $1,400",
        risk: "ETH/BTC 페어 추세 약세 지속",
      },
      {
        label: "C. 횡보 박스권",
        prob: 15,
        color: "#fbbf24",
        trigger: "$2,100~$2,400 레인지",
        target: "방향성 대기",
        risk: "낮은 변동성",
      },
    ],

    risk: {
      long: {
        entry: "$2,162~$2,189 (VRVP 지지)",
        sl: "$2,050 이하",
        tp1: "$2,350",
        tp2: "$2,500",
        rr: "1:2.5",
        note: "약세 환경. 소규모 진입만 권장",
      },
      short: {
        entry: "$2,350~$2,400 (저항 재테스트)",
        sl: "$2,500 이상",
        tp1: "$2,150",
        tp2: "$1,900",
        rr: "1:3",
      },
    },
  },

  SOL: {
    symbol: "SOLUSDT",
    price: 84.2,
    bias: "약세",
    biasColor: "#f87171",
    signal: "AVOID",
    signalColor: "#f87171",

    vrvp: {
      "1D": { hvn: 163.38, note: "1D 최대 HVN — 장기 핵심 저항" },
      "4H": { hvn: 88.48, note: "현재가 직상 저항 HVN" },
      "1H": { hvn: 83.31, note: "직근 지지 HVN" },
    },

    ew: {
      primary: {
        label: "Primary: 하락 조정 지속 (B파 or Wave 2 반등)",
        desc: "고점 $290(2025 Q4)에서 저점 $60~65(3월 폭락)까지 대형 충격파 하락. 현재 $84는 하락레인지의 약 10% 반등. 약한 반등 구조. Wave C 재개 시 $55~$60 재방문 가능.",
        invalidation: "$100 이상 종가 돌파",
        confidence: "낮음-중간",
      },
      alternate: {
        label: "Alternate: $60대 쌍바닥 후 회복",
        desc: "글로벌 유동성 공급 시 $100~$120 회복 가능. 현재 구조로는 확인 어려움.",
        invalidation: "$78 이탈",
        confidence: "낮음",
      },
      tf: {
        "1D": "$60대 저점에서 반등 중. 구조적 약세 유지",
        "4H": "$85~90 저항 직면. 돌파 or 되돌림 분기점",
        "1H": "$83~85 박스권 형성",
      },
    },

    ict: {
      structure: "전 타임프레임 약세 구조. 단기 반등에 불과",
      bsl: ["$88~$90 (4H VRVP HVN 저항)", "$100 (심리적 저항)"],
      ssl: ["$83.31 (1H VRVP)", "$78~$80 (하방 지지)"],
      ob: ["$78~$82 불리시 OB (4H)", "$60~$65 수요존 (1D)"],
      fvg: "$65~$80 FVG 다수",
      discount: "ATH 대비 -71%. 극단적 할인 구간이나 추세 역전 확인 없음",
    },

    orderflow: {
      oi: "차트 미확인 (Coinalyze 개별 데이터 없음)",
      oiNote: "BTC/ETH 동반 OI 감소 환경에서 SOL도 유사 패턴 예상",
      liq: "차트 미확인",
      heatmap: "차트 미확인 (캡처 오류)",
      fundingNote: "차트 미확인",
    },

    scenarios: [
      {
        label: "A. $88~$90 돌파 — 단기 강세",
        prob: 25,
        color: "#4ade80",
        trigger: "4H VRVP HVN $88.48 돌파 + 볼륨",
        target: "$95~$100",
        risk: "저항 돌파 실패 시 역V",
      },
      {
        label: "B. 저항 실패 — 되돌림",
        prob: 55,
        color: "#f87171",
        trigger: "$83.31 이탈",
        target: "$78~$75",
        risk: "BTC 하락 연동",
      },
      {
        label: "C. $83~$88 박스권",
        prob: 20,
        color: "#fbbf24",
        trigger: "레인지 유지",
        target: "방향 대기",
        risk: "낮음",
      },
    ],

    risk: {
      long: {
        entry: "$83~$84 (1H VRVP 지지)",
        sl: "$80 이하",
        tp1: "$88",
        tp2: "$95",
        rr: "1:2.5",
        note: "고위험. 소규모만 권장",
      },
      short: {
        entry: "$88~$90 (4H VRVP 저항)",
        sl: "$92 이상",
        tp1: "$83",
        tp2: "$78",
        rr: "1:2",
      },
    },
  },

  HYPE: {
    symbol: "HYPEUSDT",
    price: 42.3,
    bias: "강세",
    biasColor: "#4ade80",
    signal: "BUY DIP",
    signalColor: "#4ade80",

    vrvp: {
      "1D": { hvn: 37.964, note: "1D HVN 지지선 — 핵심 지지" },
      "4H": { hvn: 38.351, note: "4H HVN 지지" },
      "1H": { hvn: 39.380, note: "1H HVN 지지 (현재가 직근 하방)" },
    },

    ew: {
      primary: {
        label: "Primary: 상승 충격파 3파 or 5파 진행 중",
        desc: "HYPE는 전 페어 중 압도적 상대 강도. 3월 폭락 저점 ~$13~$14에서 현재 $42.3까지 3배 이상 회복. 타 자산이 여전히 저점 부근일 때 HYPE만 신고점 접근. 1H/4H 모두 연속 HH-HL 구조로 상승 5파 가능성.",
        invalidation: "$37.5 이하 종가 이탈 → 구조 재평가",
        confidence: "중간-높음",
      },
      alternate: {
        label: "Alternate: 과매수 후 조정 (ABC)",
        desc: "단기간 3배 급등으로 과매수 가능성. $37~$40 조정 후 재상승 패턴. 강세 추세 자체는 유효.",
        invalidation: "$35 이하 이탈",
        confidence: "낮음",
      },
      tf: {
        "1D": "$13 저점 → $47 고점 이후 $42 조정. 강세 추세 유지",
        "4H": "연속 상승 후 소폭 조정. 4H 고점 $47~$48",
        "1H": "강한 상승 추세. 1H HVN $39.38 위에서 지지 중",
      },
    },

    ict: {
      structure: "전 타임프레임 강세 구조 (HH-HL). 유일한 강세 페어",
      bsl: ["$47~$48 (최근 스윙 하이)", "$52~$55 (확장 목표)"],
      ssl: ["$39.38 (1H VRVP)", "$38.35 (4H VRVP)", "$37.96 (1D VRVP)"],
      ob: ["$38~$40 불리시 OB (4H)", "$35~$37 강한 수요존 (1D)"],
      fvg: "$35~$39 구간 FVG (급등 구간 미충전)",
      discount: "장기 관점에서 여전히 초기 단계. 고점 $47 기준으로는 단기 할인",
    },

    orderflow: {
      oi: "+18.93% (포지션 증가 — 강세 수요 유입)",
      oiNote: "OI 증가 + 가격 상승 = 신규 롱 진입 주도. 건강한 강세 신호",
      liq: "차트 미확인",
      heatmap: "차트 미확인 (캡처 오류)",
      fundingNote: "차트 미확인. OI 증가 감안 시 펀딩비 양수 예상",
    },

    scenarios: [
      {
        label: "A. 조정 후 $47~$50 재돌파",
        prob: 55,
        color: "#4ade80",
        trigger: "$39~$40 VRVP 지지 확인 + 반등",
        target: "$47 → $52~$55",
        risk: "BTC 급락 시 연동 하락",
      },
      {
        label: "B. 과매수 조정 — $37~$38 재방문",
        prob: 30,
        color: "#fbbf24",
        trigger: "$39.38 이탈",
        target: "$38~$37.96 (VRVP 지지)",
        risk: "건전한 조정으로 재매수 기회",
      },
      {
        label: "C. 추세 붕괴 — $35 이하",
        prob: 15,
        color: "#f87171",
        trigger: "$37 이탈 + 거래량 급증",
        target: "$32~$28",
        risk: "BTC 패닉 하락 연동 시나리오",
      },
    ],

    risk: {
      long: {
        entry: "$39~$40 (VRVP 지지권)",
        sl: "$37.5 이하",
        tp1: "$45",
        tp2: "$50",
        rr: "1:4",
        note: "현 페어 중 최선호 롱 셋업",
      },
      short: {
        entry: "권장 안함 (강세 구조)",
        sl: "N/A",
        tp1: "N/A",
        tp2: "N/A",
        rr: "N/A",
        note: "강세 추세 역행 금지",
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

function VrvpRow({ tf, data }) {
  const val = data.hvn ?? data.lvn;
  const type = data.hvn ? "HVN" : "LVN";
  const color = data.hvn ? S.conv : S.neutral;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "8px 0",
        borderBottom: `1px solid ${S.border}`,
      }}
    >
      <span style={{ color: S.textSub, fontSize: 12, minWidth: 28, paddingTop: 2 }}>{tf}</span>
      <Tag color={color}>{type}</Tag>
      <div>
        <div style={{ color: S.textMain, fontWeight: 700, fontSize: 14 }}>
          ${val?.toLocaleString()}
        </div>
        <div style={{ color: S.textSub, fontSize: 12, marginTop: 2 }}>{data.note}</div>
      </div>
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

function OverviewTab({ pair }) {
  const p = pairs[pair];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      {/* 현재가 & 바이어스 */}
      <Card style={{ gridColumn: "1 / -1" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ color: S.textSub, fontSize: 12 }}>{p.symbol} · {ANALYSIS_DATE} {GENERATED_AT}</div>
            <div style={{ color: S.textMain, fontSize: 32, fontWeight: 700, marginTop: 4 }}>
              ${p.price.toLocaleString()}
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

      {/* VRVP 레벨 */}
      <Card>
        <SectionTitle>VRVP 핵심 레벨</SectionTitle>
        {Object.entries(p.vrvp).map(([tf, data]) => (
          <VrvpRow key={tf} tf={tf} data={data} />
        ))}
      </Card>

      {/* 오더플로우 요약 */}
      <Card>
        <SectionTitle>Orderflow 요약</SectionTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <div style={{ color: S.textSub, fontSize: 11 }}>Open Interest</div>
            <div style={{ color: S.cvdPos, fontWeight: 700, fontSize: 14 }}>{p.orderflow.oi}</div>
            <div style={{ color: S.textSub, fontSize: 12 }}>{p.orderflow.oiNote}</div>
          </div>
          <div style={{ borderTop: `1px solid ${S.border}`, paddingTop: 10 }}>
            <div style={{ color: S.textSub, fontSize: 11 }}>청산 (24h)</div>
            <div style={{ color: S.neutral, fontWeight: 700, fontSize: 14 }}>{p.orderflow.liq}</div>
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
              style={{ color: S.bull, fontSize: 13, padding: "5px 0", borderBottom: `1px solid ${S.border}` }}
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
              style={{ color: S.bear, fontSize: 13, padding: "5px 0", borderBottom: `1px solid ${S.border}` }}
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
        <p style={{ color: S.textMain, fontSize: 14, marginTop: 8, lineHeight: 1.7 }}>{of_.oiNote}</p>
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
        {pair === "BTC" && (
          <div style={{ marginTop: 10, padding: 10, background: S.panel, borderRadius: 6 }}>
            <div style={{ color: S.heatHigh, fontSize: 13, fontWeight: 700 }}>
              $74,000~$75,000: 숏 청산 밀집 (상방 자석)
            </div>
            <div style={{ color: S.cvdNeg, fontSize: 13, marginTop: 6 }}>
              $70,000~$71,000: 롱 청산 존재 (하방 위험)
            </div>
            <div style={{ color: S.textSub, fontSize: 12, marginTop: 6 }}>
              * ETH/SOL/HYPE 히트맵 — 캡처 오류로 데이터 미확인
            </div>
          </div>
        )}
      </Card>

      {/* Coinalyze 마켓 개요 */}
      {pair === "BTC" && (
        <Card>
          <SectionTitle>Coinalyze 시장 전체 개요 (2026-04-11)</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {[
              { label: "BTC OI 변화", val: "-18.89%", color: S.bear },
              { label: "ETH OI 변화", val: "-78.77%", color: S.bear },
              { label: "HYPE OI 변화", val: "+18.93%", color: S.bull },
              { label: "전체 청산 24h", val: "$156M+", color: S.neutral },
              { label: "BTC 청산 24h", val: "$22.9M", color: S.neutral },
              { label: "ETH 청산 24h", val: "$22.2M", color: S.neutral },
            ].map((item, i) => (
              <div key={i} style={{ padding: 10, background: S.panel, borderRadius: 6 }}>
                <div style={{ color: S.textSub, fontSize: 11 }}>{item.label}</div>
                <div style={{ color: item.color, fontWeight: 700, fontSize: 16, marginTop: 4 }}>
                  {item.val}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function ScenariosTab({ pair }) {
  const p = pairs[pair];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {p.scenarios.map((s, i) => (
        <Card key={i}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <Tag color={s.color}>{s.label}</Tag>
            <span style={{ color: s.color, fontWeight: 700, fontSize: 20 }}>{s.prob}%</span>
          </div>
          <ProbBar prob={s.prob} color={s.color} />
          <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div style={{ padding: 10, background: S.panel, borderRadius: 6 }}>
              <div style={{ color: S.textSub, fontSize: 11 }}>트리거</div>
              <div style={{ color: S.textMain, fontSize: 13, marginTop: 4 }}>{s.trigger}</div>
            </div>
            <div style={{ padding: 10, background: S.panel, borderRadius: 6 }}>
              <div style={{ color: S.textSub, fontSize: 11 }}>타겟</div>
              <div style={{ color: s.color, fontSize: 13, fontWeight: 600, marginTop: 4 }}>{s.target}</div>
            </div>
          </div>
          <div style={{ marginTop: 8, padding: "6px 10px", background: "#f8717122", borderRadius: 4 }}>
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
          <div style={{ marginBottom: 10, padding: "6px 10px", background: "#4ade8022", borderRadius: 4 }}>
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
              <div style={{ color: item.color, fontWeight: 700, fontSize: 15, marginTop: 4 }}>{item.val}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle>Short Setup</SectionTitle>
        {r.short.note && (
          <div style={{ marginBottom: 10, padding: "6px 10px", background: "#f8717122", borderRadius: 4 }}>
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
              <div style={{ color: item.color, fontWeight: 700, fontSize: 15, marginTop: 4 }}>{item.val}</div>
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
      case "Overview": return <OverviewTab pair={activePair} />;
      case "Elliott Wave": return <EWTab pair={activePair} />;
      case "ICT": return <ICTTab pair={activePair} />;
      case "Orderflow": return <OrderflowTab pair={activePair} />;
      case "Scenarios": return <ScenariosTab pair={activePair} />;
      case "Risk": return <RiskTab pair={activePair} />;
      default: return null;
    }
  };

  return (
    <div style={{ background: S.bg, minHeight: "100vh", fontFamily: "monospace", color: S.textMain }}>
      {/* Header */}
      <div style={{ background: S.panel, borderBottom: `1px solid ${S.border}`, padding: "12px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <span style={{ color: S.textSub, fontSize: 12 }}>Crypto Futures Analysis</span>
            <span style={{ color: S.border, margin: "0 8px" }}>|</span>
            <span style={{ color: S.textMain, fontWeight: 700 }}>{ANALYSIS_DATE}</span>
            <span style={{ color: S.textSub, fontSize: 12, marginLeft: 8 }}>{GENERATED_AT}</span>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <Tag color={S.bear}>BTC -33% ATH</Tag>
            <Tag color={S.bear}>ETH -45% ATH</Tag>
            <Tag color={S.bull}>HYPE +강세</Tag>
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
                  ${p.price.toLocaleString()}
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

        {/* Footer */}
        <div
          style={{
            marginTop: 20,
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
