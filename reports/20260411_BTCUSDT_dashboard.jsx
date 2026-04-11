import { useState } from "react";

const C = {
  bg: "#0b0e14",
  panel: "#131720",
  card: "#1a1f2e",
  border: "#252d3d",
  text: "#e8eaed",
  sub: "#9ca3af",
  muted: "#6b7280",
  bull: "#4ade80",
  bear: "#f87171",
  neutral: "#fbbf24",
  accent: "#60a5fa",
  heatHigh: "#f59e0b",
  cvdPos: "#22d3ee",
  cvdNeg: "#fb923c",
  confluence: "#a78bfa",
};

const Badge = ({ label, color, bg }) => (
  <span style={{
    display: "inline-block", padding: "2px 10px", borderRadius: 999,
    fontSize: 11, fontWeight: 700, letterSpacing: 1,
    color: color || C.text, background: bg || C.card, border: `1px solid ${color || C.border}`
  }}>{label}</span>
);

const Panel = ({ title, children, style }) => (
  <div style={{ background: C.panel, borderRadius: 10, padding: "16px 18px", border: `1px solid ${C.border}`, ...style }}>
    {title && <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: 2, marginBottom: 12, textTransform: "uppercase" }}>{title}</div>}
    {children}
  </div>
);

const Card = ({ children, style }) => (
  <div style={{ background: C.card, borderRadius: 8, padding: "12px 14px", border: `1px solid ${C.border}`, ...style }}>
    {children}
  </div>
);

const Row = ({ label, value, color, sub }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: `1px solid ${C.border}` }}>
    <span style={{ fontSize: 12, color: C.sub }}>{label}</span>
    <div style={{ textAlign: "right" }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: color || C.text }}>{value}</span>
      {sub && <span style={{ fontSize: 10, color: C.muted, marginLeft: 6 }}>{sub}</span>}
    </div>
  </div>
);

const ProgressBar = ({ pct, color, label }) => (
  <div style={{ marginBottom: 8 }}>
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
      <span style={{ fontSize: 11, color: C.sub }}>{label}</span>
      <span style={{ fontSize: 11, fontWeight: 700, color: color }}>{pct}%</span>
    </div>
    <div style={{ height: 6, background: C.border, borderRadius: 99 }}>
      <div style={{ height: 6, width: `${pct}%`, background: color, borderRadius: 99 }} />
    </div>
  </div>
);

const RsiGauge = ({ value, label }) => {
  const color = value < 30 ? C.bear : value < 45 ? "#fb923c" : value < 55 ? C.neutral : value < 70 ? C.bull : C.accent;
  const pct = (value / 100) * 100;
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color }}>{value.toFixed(1)}</div>
      <div style={{ height: 4, background: C.border, borderRadius: 99, marginTop: 4 }}>
        <div style={{ height: 4, width: `${pct}%`, background: color, borderRadius: 99 }} />
      </div>
      <div style={{ fontSize: 10, color, marginTop: 3 }}>
        {value < 30 ? "과매도" : value < 45 ? "약세" : value < 55 ? "중립" : value < 70 ? "강세" : "과매수"}
      </div>
    </div>
  );
};

const WaveStep = ({ num, label, price, status }) => {
  const statusColor = status === "complete" ? C.bull : status === "current" ? C.neutral : C.muted;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
      <div style={{
        width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 10, fontWeight: 800, border: `2px solid ${statusColor}`, color: statusColor, flexShrink: 0
      }}>{num}</div>
      <div style={{ flex: 1 }}>
        <span style={{ fontSize: 12, color: status === "current" ? C.text : C.sub }}>{label}</span>
      </div>
      <span style={{ fontSize: 12, fontWeight: 600, color: statusColor }}>{price}</span>
    </div>
  );
};

const tabs = ["개요", "Elliott Wave", "ICT/SMC", "시나리오", "리스크"];

export default function BTCDashboard() {
  const [activeTab, setActiveTab] = useState("개요");

  return (
    <div style={{ background: C.bg, minHeight: "100vh", padding: "16px", fontFamily: "'Segoe UI', sans-serif", color: C.text }}>
      {/* ── HEADER ── */}
      <div style={{ background: C.panel, borderRadius: 12, padding: "14px 20px", marginBottom: 14, border: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div>
            <div style={{ fontSize: 11, color: C.muted, letterSpacing: 2 }}>BTCUSDT PERP · BINANCE</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: C.text, lineHeight: 1 }}>$72,714.9</div>
            <div style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>2026-04-11 04:24 UTC</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <Badge label="📉 SHORT BIAS" color={C.bear} bg="#2d1515" />
            <Badge label="CONVICTION: MEDIUM" color={C.neutral} bg="#2d2310" />
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Card style={{ minWidth: 120 }}>
            <div style={{ fontSize: 10, color: C.muted, marginBottom: 2 }}>주목 레벨 TOP3</div>
            <div style={{ fontSize: 12, color: C.bear, fontWeight: 700 }}>R: $74,619 · $76,500</div>
            <div style={{ fontSize: 12, color: C.bull, fontWeight: 700 }}>S: $70,000 · $67,000</div>
          </Card>
          <Card style={{ minWidth: 120 }}>
            <div style={{ fontSize: 10, color: C.muted, marginBottom: 2 }}>시장 국면</div>
            <div style={{ fontSize: 13, color: C.bear, fontWeight: 700 }}>Mark-down</div>
            <div style={{ fontSize: 11, color: C.sub }}>Distribution 완료</div>
          </Card>
        </div>
      </div>

      {/* ── TABS ── */}
      <div style={{ display: "flex", gap: 4, marginBottom: 14, borderBottom: `1px solid ${C.border}`, paddingBottom: 0 }}>
        {tabs.map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={{
            padding: "7px 16px", fontSize: 12, fontWeight: 600, borderRadius: "8px 8px 0 0",
            border: "none", cursor: "pointer", transition: "all 0.15s",
            background: activeTab === t ? C.panel : "transparent",
            color: activeTab === t ? C.accent : C.muted,
            borderBottom: activeTab === t ? `2px solid ${C.accent}` : "2px solid transparent",
          }}>{t}</button>
        ))}
      </div>

      {/* ══════════════════ 개요 ══════════════════ */}
      {activeTab === "개요" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          {/* RSI 게이지 */}
          <Panel title="RSI 멀티 타임프레임">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <RsiGauge value={32.83} label="1D RSI" />
              <RsiGauge value={41.85} label="4H RSI" />
              <RsiGauge value={36.11} label="1H RSI" />
            </div>
            <div style={{ marginTop: 12, padding: "8px", background: C.card, borderRadius: 6, fontSize: 11, color: C.sub }}>
              📌 1D RSI 32.8 — 과매도 근접. 단기 반등 가능성 존재하나 HTF 구조상 베어리시 지속.
            </div>
          </Panel>

          {/* 추세 현황 */}
          <Panel title="추세 & 구조">
            <Row label="1D HTF 추세" value="하락 (Mark-down)" color={C.bear} />
            <Row label="4H 추세" value="하락 지속" color={C.bear} />
            <Row label="1H 추세" value="약세 / 소폭 반등" color={C.neutral} />
            <Row label="EMA 상태" value="Death Cross 발생" color={C.bear} />
            <Row label="가격 vs ATH" value="-33.3%" color={C.bear} sub="$109K → $72.7K" />
            <Row label="FOMC 영향" value="2025.11.10 하락 트리거" color={C.muted} />
          </Panel>

          {/* VRVP 요약 */}
          <Panel title="VRVP 핵심 레벨">
            <Row label="상단 저항 (OB)" value="$76,000~80,000" color={C.bear} sub="차트 확인" />
            <Row label="VRVP POC" value="≈$74,619" color={C.neutral} sub="1D 확인" />
            <Row label="현재가" value="$72,714" color={C.accent} />
            <Row label="HVN 지지" value="$70,000" color={C.bull} sub="구조적" />
            <Row label="주요 지지" value="$67,000" color={C.bull} sub="구조적" />
            <Row label="롱 관심 구간" value="$67,000~70,000" color={C.bull} sub="추세 확인 후" />
          </Panel>

          {/* CCI */}
          <Panel title="CCI 현황" style={{ gridColumn: "1 / 2" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, textAlign: "center" }}>
              {[["1D CCI", 20, C.muted], ["4H CCI", 20, C.muted], ["1H CCI", 20, C.muted]].map(([lbl, val, col]) => (
                <Card key={lbl}>
                  <div style={{ fontSize: 10, color: C.muted }}>{lbl}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: col }}>{val}</div>
                </Card>
              ))}
            </div>
          </Panel>

          {/* 바이어스 카드 */}
          <Panel title="종합 바이어스" style={{ gridColumn: "2 / 4" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <ProgressBar pct={55} color={C.bear} label="단기 베어리시 확률" />
                <ProgressBar pct={30} color={C.bull} label="반등 시나리오 확률" />
                <ProgressBar pct={15} color={C.neutral} label="횡보 시나리오 확률" />
              </div>
              <Card>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>핵심 요약</div>
                <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.7 }}>
                  ① 1D RSI 32.8 — 과매도 근접<br />
                  ② EMA 데스크로스 진행 중<br />
                  ③ VRVP POC $74.6K 하방에 위치<br />
                  ④ $70K~67K SSL 유동성 구간<br />
                  ⑤ 단기 반등 시 $74.6K OB 확인
                </div>
              </Card>
            </div>
          </Panel>
        </div>
      )}

      {/* ══════════════════ ELLIOTT WAVE ══════════════════ */}
      {activeTab === "Elliott Wave" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Panel title="Primary Count — ABC 조정 (Main)">
            <Card style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: C.neutral, fontWeight: 700, marginBottom: 8 }}>📌 현재 위치: Major Wave C 진행 중</div>
              <WaveStep num="ATH" label="Bull Run 최고점 (Major Top)" price="≈$109,000" status="complete" />
              <div style={{ height: 1, background: C.border, margin: "4px 0" }} />
              <WaveStep num="A" label="1차 하락 (임펄스)" price="≈$109K → $78K" status="complete" />
              <WaveStep num="B" label="반등 조정 (지그재그)" price="≈$78K → $88K" status="complete" />
              <WaveStep num="C" label="2차 하락 — 진행 중" price="≈$88K → ?" status="current" />
              <div style={{ height: 1, background: C.border, margin: "4px 0" }} />
              <WaveStep num="C3" label="Wave C 내 현재 위치 추정" price="≈$72,714 (NOW)" status="current" />
            </Card>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <Card>
                <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>C파 목표 (피보나치)</div>
                <Row label="0.618 ext" value="≈$70,000" color={C.bear} />
                <Row label="1.0 ext" value="≈$67,000" color={C.bear} />
                <Row label="1.618 ext" value="≈$61,000" color={C.bear} />
              </Card>
              <Card>
                <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>무효화 조건</div>
                <div style={{ fontSize: 12, color: C.bear, lineHeight: 1.8 }}>
                  $76,500 이상 회복 시<br />
                  → C파 Count 무효<br />
                  → B파 연장 or 재카운트
                </div>
              </Card>
            </div>
          </Panel>

          <Panel title="Alternate Count — 5파 임펄스 하락">
            <Card style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: C.confluence, fontWeight: 700, marginBottom: 8 }}>대안 시나리오: (1)-(2)-(3)-(4)-(5) 하락 임펄스</div>
              <WaveStep num="①" label="1파 하락" price="$109K → $90K" status="complete" />
              <WaveStep num="②" label="2파 반등 (플랫)" price="$90K → $96K" status="complete" />
              <WaveStep num="③" label="3파 하락 (연장 가능)" price="$96K → $72K" status="current" />
              <WaveStep num="④" label="4파 반등 예상" price="$72K → $76K?" status="pending" />
              <WaveStep num="⑤" label="5파 최종 하락" price="$76K → $62K?" status="pending" />
            </Card>
            <Card>
              <div style={{ fontSize: 11, color: C.confluence, fontWeight: 700, marginBottom: 6 }}>대안 카운트 조건</div>
              <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.7 }}>
                • 현재 $72.7K = Wave ③ 저점 또는 ③ 내 sub-wave<br />
                • $74K~76K 반등 → Wave ④로 해석<br />
                • 이후 재하락 시 Wave ⑤ 확정<br />
                • 무효화: $80K 이상 돌파
              </div>
            </Card>
          </Panel>

          <Panel title="피보나치 레벨 맵" style={{ gridColumn: "1 / 3" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
              {[
                { lbl: "ATH (0%)", val: "$109,000", col: C.bear, note: "최고점" },
                { lbl: "0.236 리트", val: "≈$83,000", col: C.bear, note: "반등 저항" },
                { lbl: "0.382 리트", val: "≈$76,000", col: C.bear, note: "OB 저항구간" },
                { lbl: "0.5 리트", val: "≈$72,000", col: C.neutral, note: "현재 근접" },
                { lbl: "0.618 리트", val: "≈$67,000", col: C.bull, note: "주요 지지" },
                { lbl: "0.786 리트", val: "≈$60,000", col: C.bull, note: "강력 지지" },
                { lbl: "VRVP POC", val: "≈$74,619", col: C.neutral, note: "차트 확인" },
                { lbl: "무효화", val: "$76,500+", col: C.confluence, note: "베어 구조 무효" },
              ].map(({ lbl, val, col, note }) => (
                <Card key={lbl} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: C.muted }}>{lbl}</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: col }}>{val}</div>
                  <div style={{ fontSize: 10, color: C.sub }}>{note}</div>
                </Card>
              ))}
            </div>
          </Panel>
        </div>
      )}

      {/* ══════════════════ ICT/SMC ══════════════════ */}
      {activeTab === "ICT/SMC" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Panel title="유동성 구조 (Liquidity Map)">
            <div style={{ position: "relative", background: C.card, borderRadius: 8, padding: 14, marginBottom: 10 }}>
              {[
                { lbl: "🔴 BSL — ATH", price: "$109,000", col: C.bear, note: "최상위 유동성 (스윕 완료)" },
                { lbl: "🔴 저항 OB", price: "$76,000~80,000", col: C.bear, note: "차트 확인 — 강한 공급 구간" },
                { lbl: "🟡 VRVP POC / FVG 상단", price: "≈$74,619", col: C.neutral, note: "단기 반등 저항 목표" },
                { lbl: "⚪ 현재가", price: "$72,714", col: C.accent, note: "NOW" },
                { lbl: "🟢 SSL — 지지", price: "≈$70,000", col: C.bull, note: "라운드넘버 + 구조적 지지" },
                { lbl: "🟢 주요 SSL", price: "≈$67,000", col: C.bull, note: "1D 구조적 저점 유동성" },
                { lbl: "🟢 강력 매수 관심", price: "≈$61,000~64,000", col: C.bull, note: "HTF 차트 확인 필요" },
              ].map(({ lbl, price, col, note }) => (
                <div key={lbl} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0", borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ fontSize: 11, color: col, width: 160, flexShrink: 0 }}>{lbl}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: col, width: 130, flexShrink: 0 }}>{price}</span>
                  <span style={{ fontSize: 11, color: C.sub }}>{note}</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="POI (Points of Interest)">
            <Card style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>Order Block (OB)</div>
              <Row label="저항 OB (Bearish)" value="$76,000~80,000" color={C.bear} sub="1D 차트 확인 — 붉은 박스" />
              <Row label="미완성 OB" value="≈$74,619" color={C.bear} sub="VRVP POC 근처" />
            </Card>
            <Card style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>FVG / Imbalance</div>
              <Row label="상방 FVG 추정" value="$74,000~76,000" color={C.neutral} sub="차트 미세 확인 필요" />
              <Row label="하방 FVG 추정" value="$70,000~71,500" color={C.bull} sub="근거 보강 필요" />
            </Card>
            <Card>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>Premium / Discount</div>
              <Row label="EQ 기준 (ATH~저점)" value="≈$85,000" color={C.neutral} />
              <Row label="현재가 위치" value="Discount Zone" color={C.bull} sub="ATH 대비 -33%" />
              <Row label="단기 EQ (4H)" value="≈$73,500" color={C.neutral} sub="단기 스윙 기준" />
              <Row label="단기 현재 위치" value="Discount" color={C.bull} sub="단기 기준" />
            </Card>
          </Panel>

          <Panel title="Market Maker Model" style={{ gridColumn: "1 / 3" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
              {[
                { stage: "Accumulation", icon: "📦", active: false, note: "2024 하반기" },
                { stage: "Mark-up", icon: "📈", active: false, note: "2024 말~2025 초" },
                { stage: "Distribution", icon: "🏷", active: false, note: "2025 ATH 부근" },
                { stage: "Mark-down", icon: "📉", active: true, note: "현재 진행 중" },
                { stage: "Re-Accum?", icon: "🔄", active: false, note: "$67K~64K 구간?" },
              ].map(({ stage, icon, active, note }) => (
                <Card key={stage} style={{ textAlign: "center", border: active ? `1px solid ${C.bear}` : `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 22 }}>{icon}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: active ? C.bear : C.sub, marginTop: 4 }}>{stage}</div>
                  <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{note}</div>
                  {active && <Badge label="현재" color={C.bear} bg="#2d1515" />}
                </Card>
              ))}
            </div>
          </Panel>
        </div>
      )}

      {/* ══════════════════ 시나리오 ══════════════════ */}
      {activeTab === "시나리오" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          {/* 시나리오 A — 베어 */}
          <Panel title="시나리오 A — 베어리시 (Primary)" style={{ border: `1px solid ${C.bear}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <Badge label="📉 BEARISH" color={C.bear} bg="#2d1515" />
              <Badge label="55% 확률" color={C.bear} bg="#2d1515" />
            </div>
            <Card style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Elliott Wave 근거</div>
              <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.7 }}>
                • ABC C파 또는 5파 임펄스 ③파 진행 중<br />
                • RSI 다이버전스 아직 미확인<br />
                • $72.7K = 0.5 피보 — 추가 하락 여지
              </div>
            </Card>
            <Card style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>ICT/SMC 근거</div>
              <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.7 }}>
                • EMA Death Cross 발생<br />
                • VRVP POC $74.6K 하방 — 매도 압력<br />
                • SSL $70K · $67K 스윕 가능성
              </div>
            </Card>
            <div style={{ marginBottom: 8 }}>
              <ProgressBar pct={55} color={C.bear} label="확률" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              <Card style={{ textAlign: "center" }}>
                <div style={{ fontSize: 10, color: C.muted }}>TP1</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.bear }}>$70,000</div>
              </Card>
              <Card style={{ textAlign: "center" }}>
                <div style={{ fontSize: 10, color: C.muted }}>TP2</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.bear }}>$67,000</div>
              </Card>
            </div>
            <Card style={{ marginTop: 8, textAlign: "center" }}>
              <div style={{ fontSize: 10, color: C.muted }}>TP3 (확장)</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.bear }}>$61,000~64,000</div>
            </Card>
            <div style={{ marginTop: 8, padding: 8, background: C.card, borderRadius: 6 }}>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 3 }}>진입 트리거</div>
              <div style={{ fontSize: 11, color: C.sub }}>$74K~75K 반등 시 저항 확인 후 Short 진입</div>
            </div>
          </Panel>

          {/* 시나리오 B — 불 */}
          <Panel title="시나리오 B — 불리시 (Alternate)" style={{ border: `1px solid ${C.bull}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <Badge label="📈 BULLISH" color={C.bull} bg="#152d1d" />
              <Badge label="30% 확률" color={C.bull} bg="#152d1d" />
            </div>
            <Card style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Elliott Wave 근거</div>
              <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.7 }}>
                • Wave C 완성 or ③파 저점 확인 가능성<br />
                • 1D RSI 32.8 — 과매도 근접 반등 트리거<br />
                • 역다이버전스 형성 시 추세 전환 신호
              </div>
            </Card>
            <Card style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>ICT/SMC 근거</div>
              <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.7 }}>
                • ATH 대비 Discount Zone 진입<br />
                • $70K~72K 수요 구간 형성 가능<br />
                • 4H RSI 41.85 — 반등 여력 존재
              </div>
            </Card>
            <div style={{ marginBottom: 8 }}>
              <ProgressBar pct={30} color={C.bull} label="확률" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              <Card style={{ textAlign: "center" }}>
                <div style={{ fontSize: 10, color: C.muted }}>TP1</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.bull }}>$74,619</div>
              </Card>
              <Card style={{ textAlign: "center" }}>
                <div style={{ fontSize: 10, color: C.muted }}>TP2</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.bull }}>$76,500</div>
              </Card>
            </div>
            <Card style={{ marginTop: 8, textAlign: "center" }}>
              <div style={{ fontSize: 10, color: C.muted }}>TP3 (확장)</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.bull }}>$80,000+</div>
            </Card>
            <div style={{ marginTop: 8, padding: 8, background: C.card, borderRadius: 6 }}>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 3 }}>진입 트리거</div>
              <div style={{ fontSize: 11, color: C.sub }}>$70K~71K 지지 확인 + 1H CHoCH 발생 후 Long</div>
            </div>
          </Panel>

          {/* 시나리오 C — 횡보 */}
          <Panel title="시나리오 C — 횡보/중립" style={{ border: `1px solid ${C.neutral}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <Badge label="⚖️ NEUTRAL" color={C.neutral} bg="#2d2310" />
              <Badge label="15% 확률" color={C.neutral} bg="#2d2310" />
            </div>
            <Card style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>조건</div>
              <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.7 }}>
                • $70,000~$75,000 레인지 박스<br />
                • 방향성 결정 전 에너지 충전 구간<br />
                • 주요 이벤트(매크로) 대기
              </div>
            </Card>
            <div style={{ marginBottom: 8 }}>
              <ProgressBar pct={15} color={C.neutral} label="확률" />
            </div>
            <Card>
              <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>레인지 경계</div>
              <Row label="상단" value="$74,619~75,000" color={C.bear} />
              <Row label="하단" value="$70,000~71,000" color={C.bull} />
              <Row label="돌파 시" value="해당 방향 추종" color={C.neutral} />
            </Card>
            <div style={{ marginTop: 8, padding: 8, background: C.card, borderRadius: 6 }}>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 3 }}>대응 전략</div>
              <div style={{ fontSize: 11, color: C.sub }}>레인지 하단 매수 / 상단 매도 망설임 구간 — 관망 권장</div>
            </div>
          </Panel>

          {/* 시나리오 비교 */}
          <Panel title="시나리오 비교 요약" style={{ gridColumn: "1 / 4" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                    {["구분", "바이어스", "진입가", "손절", "TP1", "TP2", "TP3", "R:R", "확률"].map(h => (
                      <th key={h} style={{ padding: "8px 10px", color: C.muted, textAlign: "left", fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["A (Primary)", "SHORT", "$74,000~74,619", "$76,500", "$70,000", "$67,000", "$61,000", "≈2.5:1", "55%", C.bear],
                    ["B (Alternate)", "LONG", "$70,000~71,000", "$67,000", "$74,619", "$76,500", "$80,000", "≈2.0:1", "30%", C.bull],
                    ["C (Neutral)", "관망", "—", "—", "—", "—", "—", "—", "15%", C.neutral],
                  ].map(([nm, bias, entry, sl, tp1, tp2, tp3, rr, prob, col]) => (
                    <tr key={nm} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ padding: "7px 10px", color: col, fontWeight: 700 }}>{nm}</td>
                      <td style={{ padding: "7px 10px" }}><Badge label={bias} color={col} /></td>
                      <td style={{ padding: "7px 10px", color: C.text }}>{entry}</td>
                      <td style={{ padding: "7px 10px", color: C.bear }}>{sl}</td>
                      <td style={{ padding: "7px 10px", color: C.bull }}>{tp1}</td>
                      <td style={{ padding: "7px 10px", color: C.bull }}>{tp2}</td>
                      <td style={{ padding: "7px 10px", color: C.bull }}>{tp3}</td>
                      <td style={{ padding: "7px 10px", color: C.neutral, fontWeight: 700 }}>{rr}</td>
                      <td style={{ padding: "7px 10px", color: col, fontWeight: 700 }}>{prob}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      )}

      {/* ══════════════════ 리스크 ══════════════════ */}
      {activeTab === "리스크" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Panel title="Short 셋업 (Primary)">
            <Card style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: C.bear, fontWeight: 700, marginBottom: 6 }}>📉 SHORT 조건부 셋업</div>
              <Row label="진입 구간" value="$74,000~74,619" color={C.bear} />
              <Row label="진입 조건" value="저항 확인 + 4H 음봉 마감" color={C.sub} />
              <Row label="손절 (SL)" value="$76,500 이상" color={C.bear} />
              <Row label="SL 근거" value="OB 상단 / EW 무효화" color={C.muted} />
              <Row label="TP1" value="$70,000" color={C.bull} sub="1차 목표" />
              <Row label="TP2" value="$67,000" color={C.bull} sub="주요 SSL" />
              <Row label="TP3" value="$61,000~64,000" color={C.bull} sub="확장 목표" />
              <Row label="R:R 비율" value="≈2.5:1" color={C.neutral} />
            </Card>
            <Card>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>무효화 조건</div>
              <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.8 }}>
                ① $76,500 강한 돌파 + 4H 양봉 마감<br />
                ② 1D RSI 30 이하 극단적 과매도<br />
                ③ 매크로 호재 (Fed 피벗 등) 발표
              </div>
            </Card>
          </Panel>

          <Panel title="Long 셋업 (Conditional)">
            <Card style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: C.bull, fontWeight: 700, marginBottom: 6 }}>📈 LONG 조건부 셋업 (추세 전환 확인 필수)</div>
              <Row label="진입 구간" value="$70,000~71,000" color={C.bull} />
              <Row label="진입 조건" value="1H CHoCH + 4H 강한 양봉" color={C.sub} />
              <Row label="손절 (SL)" value="$67,000 이하" color={C.bear} />
              <Row label="TP1" value="$74,619" color={C.bull} sub="VRVP POC" />
              <Row label="TP2" value="$76,500" color={C.bull} sub="OB 하단" />
              <Row label="TP3" value="$80,000+" color={C.bull} sub="OB 내부" />
              <Row label="R:R 비율" value="≈2.0:1" color={C.neutral} />
            </Card>
            <Card>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>진입 금지 조건</div>
              <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.8 }}>
                ① 차트 주석 "추세 확인 후 진입" 미충족 시<br />
                ② $70K 강한 이탈 시 (→ $67K로 기다림)<br />
                ③ 1D 추세 전환 미확인 상태에서 반사 매수 금지
              </div>
            </Card>
          </Panel>

          <Panel title="포지션 관리 & 체크리스트" style={{ gridColumn: "1 / 3" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <Card>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>포지션 사이즈 권고</div>
                <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.8 }}>
                  • 총 자산의 1~3% 리스크 노출<br />
                  • 레버리지 3~5x 이하 권장<br />
                  • 분할 진입: 50% → 50% 구조<br />
                  • 현재 변동성 高 — 사이즈 축소
                </div>
              </Card>
              <Card>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>다음 확인 사항</div>
                <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.8 }}>
                  ☐ 1D RSI 30 이하 진입 여부 확인<br />
                  ☐ $74.6K 반등 시 저항 반응 확인<br />
                  ☐ 4H CHoCH 발생 여부 모니터링<br />
                  ☐ 오더플로우 (CVD/히트맵) 확인 권장<br />
                  ☐ 매크로 이벤트 (FOMC 등) 일정 확인
                </div>
              </Card>
              <Card>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>핵심 레벨 요약</div>
                <Row label="최강 저항" value="$76,000~80,000" color={C.bear} />
                <Row label="중간 저항" value="$74,619" color={C.neutral} />
                <Row label="현재가" value="$72,714" color={C.accent} />
                <Row label="1차 지지" value="$70,000" color={C.bull} />
                <Row label="핵심 지지" value="$67,000" color={C.bull} />
              </Card>
            </div>
          </Panel>
        </div>
      )}

      {/* FOOTER */}
      <div style={{ marginTop: 14, padding: "10px 16px", background: C.panel, borderRadius: 8, border: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 10, color: C.muted }}>📊 BTCUSDT · 2026-04-11 · EW + ICT/SMC 통합 분석 · 오더플로우 미제공 (추가 시 정밀도 향상)</span>
        <span style={{ fontSize: 10, color: C.muted }}>⚠️ 본 분석은 교육 목적이며 투자 권유가 아닙니다</span>
      </div>
    </div>
  );
}
