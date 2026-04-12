import { useState } from "react";

// ─── 분석 데이터 (2026-04-11 기준) ─────────────────────────────────
const ANALYSIS_DATE = "2026-04-11";

const pairs = {
  BTCUSDT: {
    symbol: "BTCUSDT",
    change24h: "+0.31%",
    currentPrice: "72,788.1",
    status: "중립",
    statusColor: "#fbbf24",

    multitimeframe: {
      "1D": {
        rsi: 32.83,
        cci: 20,
        trend: "약세",
        trendColor: "#f87171",
        ewWave: "Wave (C) 진행중",
        ictStructure: "FVG 형성 (상단)",
        keyLevels: ["73,500", "72,000", "70,500"],
      },
      "4H": {
        rsi: 43.97,
        cci: 20,
        trend: "중립",
        trendColor: "#fbbf24",
        ewWave: "Wave 4 조정 가능",
        ictStructure: "박스권 내 횡보",
        keyLevels: ["73,000", "72,500", "72,000"],
      },
      "1H": {
        rsi: 59.29,
        cci: 132.08,
        trend: "강세",
        trendColor: "#4ade80",
        ewWave: "랠리 파동 진행",
        ictStructure: "상승 모멘텀",
        keyLevels: ["73,000", "72,500"],
      },
    },

    scenarios: [
      {
        type: "강세",
        typeColor: "#4ade80",
        probability: 35,
        entry: "72,500",
        tp: "73,500",
        sl: "72,000",
        rr: "1:1.5",
      },
      {
        type: "약세",
        typeColor: "#f87171",
        probability: 45,
        entry: "73,000",
        tp: "70,500",
        sl: "74,000",
        rr: "1:1.0",
      },
      {
        type: "중립",
        typeColor: "#fbbf24",
        probability: 20,
        entry: "72,500",
        tp: "73,000",
        sl: "72,000",
        rr: "1:0.5",
      },
    ],

    orderflow:
      "CVD 약한 상승, 히트맵 72k-73k 영역 수렴. 거래량 프로파일 72k-72.5k 집중",
    confluence: "1D 저점 형성 신호 → 4H 회복 신호 → 1H 강세 = 다중 수렴",
  },

  ETHUSDT: {
    symbol: "ETHUSDT",
    change24h: "+0.48%",
    currentPrice: "2,247.1",
    status: "중립",
    statusColor: "#fbbf24",

    multitimeframe: {
      "1D": {
        rsi: 33.15,
        cci: 20,
        trend: "약세",
        trendColor: "#f87171",
        ewWave: "Wave (C) 하강중",
        ictStructure: "FVG 상단 (미확인)",
        keyLevels: ["2,300", "2,250", "2,200"],
      },
      "4H": {
        rsi: 42.29,
        cci: 20,
        trend: "중립",
        trendColor: "#fbbf24",
        ewWave: "복합 조정",
        ictStructure: "박스권 하단 지지",
        keyLevels: ["2,280", "2,250", "2,220"],
      },
      "1H": {
        rsi: 74.67,
        cci: 109.56,
        trend: "강세",
        trendColor: "#4ade80",
        ewWave: "상승 3파 가능성",
        ictStructure: "강한 모멘텀 상승",
        keyLevels: ["2,280", "2,250"],
      },
    },

    scenarios: [
      {
        type: "강세",
        typeColor: "#4ade80",
        probability: 40,
        entry: "2,240",
        tp: "2,300",
        sl: "2,220",
        rr: "1:2.0",
      },
      {
        type: "약세",
        typeColor: "#f87171",
        probability: 40,
        entry: "2,280",
        tp: "2,200",
        sl: "2,320",
        rr: "1:1.0",
      },
      {
        type: "중립",
        typeColor: "#fbbf24",
        probability: 20,
        entry: "2,250",
        tp: "2,270",
        sl: "2,230",
        rr: "1:1.0",
      },
    ],

    orderflow:
      "CVD 양수 전환, 2250-2280 영역 수렴. 1H 강세로 단기 매도세 약화",
    confluence: "1H RSI 74.67 (과매수) 주의. 4H에서 저점 찾기 전 조정 가능",
  },

  SOLUSDT: {
    symbol: "SOLUSDT",
    change24h: "+0.15%",
    currentPrice: "84.6",
    status: "중립",
    statusColor: "#fbbf24",

    multitimeframe: {
      "1D": {
        rsi: 33.72,
        cci: 20,
        trend: "약세",
        trendColor: "#f87171",
        ewWave: "Wave (C) 진행",
        ictStructure: "차트 미확인",
        keyLevels: ["86.5", "84.0", "80.0"],
      },
      "4H": {
        rsi: 48.22,
        cci: 20,
        trend: "중립",
        trendColor: "#fbbf24",
        ewWave: "회복 패턴 형성중",
        ictStructure: "박스권 상단 접근",
        keyLevels: ["85.5", "84.5", "83.5"],
      },
      "1H": {
        rsi: 61.83,
        cci: 88.64,
        trend: "강세",
        trendColor: "#4ade80",
        ewWave: "상승 초기 단계",
        ictStructure: "강한 매수 모멘텀",
        keyLevels: ["85.5", "85.0"],
      },
    },

    scenarios: [
      {
        type: "강세",
        typeColor: "#4ade80",
        probability: 38,
        entry: "84.5",
        tp: "86.5",
        sl: "83.5",
        rr: "1:2.0",
      },
      {
        type: "약세",
        typeColor: "#f87171",
        probability: 42,
        entry: "85.5",
        tp: "80.0",
        sl: "87.0",
        rr: "1:1.1",
      },
      {
        type: "중립",
        typeColor: "#fbbf24",
        probability: 20,
        entry: "84.5",
        tp: "85.0",
        sl: "83.8",
        rr: "1:0.4",
      },
    ],

    orderflow:
      "매도-매수 균형, 84.5 영역 지지. 4H 회복세가 주도하는 상황",
    confluence: "1D 저점 + 4H 중기 회복 + 1H 강세 = SOL이 4개 쌍 중 가장 강한 상승 구조",
  },

  HYPEUSDT: {
    symbol: "HYPEUSDT",
    change24h: "-0.42%",
    currentPrice: "41.9",
    status: "중립",
    statusColor: "#fbbf24",

    multitimeframe: {
      "1D": {
        rsi: 36.09,
        cci: 20,
        trend: "약세 종료 신호",
        trendColor: "#f87171",
        ewWave: "저점 근처, 회복 신호",
        ictStructure: "차트 미확인",
        keyLevels: ["43.5", "41.5", "39.0"],
      },
      "4H": {
        rsi: 48.01,
        cci: 20,
        trend: "중립-강세 전환",
        trendColor: "#fbbf24",
        ewWave: "Wave 1 상승 가능성",
        ictStructure: "하락세 약화",
        keyLevels: ["43.0", "41.5", "40.0"],
      },
      "1H": {
        rsi: 68.25,
        cci: 97.64,
        trend: "강세",
        trendColor: "#4ade80",
        ewWave: "상승 추세 명확",
        ictStructure: "강한 바이 모멘텀",
        keyLevels: ["43.0", "42.0"],
      },
    },

    scenarios: [
      {
        type: "강세",
        typeColor: "#4ade80",
        probability: 45,
        entry: "41.5",
        tp: "43.5",
        sl: "40.5",
        rr: "1:2.0",
      },
      {
        type: "약세",
        typeColor: "#f87171",
        probability: 35,
        entry: "43.0",
        tp: "39.0",
        sl: "44.0",
        rr: "1:1.0",
      },
      {
        type: "중립",
        typeColor: "#fbbf24",
        probability: 20,
        entry: "41.5",
        tp: "42.0",
        sl: "41.0",
        rr: "1:0.5",
      },
    ],

    orderflow:
      "저점 매수 신호, 회복 초기 단계. 소형주치고 모멘텀 강함",
    confluence:
      "24h -0.42% 약세에도 모든 타임프레임에서 상승 신호. 리스크 높지만 보상 가능",
  },
};

// ─── React 컴포넌트 ─────────────────────────────────
const Dashboard = () => {
  const [activeTab, setActiveTab] = useState("overview");
  const [expandedPair, setExpandedPair] = useState("BTCUSDT");

  const TabButton = ({ id, label }) => (
    <button
      onClick={() => setActiveTab(id)}
      style={{
        padding: "12px 20px",
        backgroundColor: activeTab === id ? "#1a1f2e" : "transparent",
        color: activeTab === id ? "#e8eaed" : "#9ca3af",
        border: "none",
        borderBottom: activeTab === id ? "2px solid #4ade80" : "none",
        cursor: "pointer",
        fontSize: "13px",
        fontWeight: activeTab === id ? "bold" : "normal",
        textTransform: "uppercase",
        transition: "all 0.3s",
      }}
    >
      {label}
    </button>
  );

  const PairCard = ({ pair, data }) => (
    <div
      onClick={() => setExpandedPair(expandedPair === pair ? null : pair)}
      style={{
        backgroundColor: "#131720",
        border: "1px solid #1a1f2e",
        borderRadius: "8px",
        padding: "16px",
        cursor: "pointer",
        transition: "all 0.3s",
        borderLeft: `3px solid ${
          data.status === "강세"
            ? "#4ade80"
            : data.status === "약세"
              ? "#f87171"
              : "#fbbf24"
        }`,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
        <h3 style={{ margin: "0", fontSize: "16px", fontWeight: "bold" }}>
          {pair}
        </h3>
        <span
          style={{
            color: data.statusColor,
            fontSize: "12px",
            fontWeight: "bold",
            textTransform: "uppercase",
          }}
        >
          {data.status}
        </span>
      </div>

      <div style={{
        backgroundColor: "#1a1f2e",
        padding: "12px",
        borderRadius: "6px",
        marginBottom: "12px",
        textAlign: "center",
      }}>
        <div style={{ fontSize: "20px", fontWeight: "bold", marginBottom: "4px" }}>
          ${data.currentPrice}
        </div>
        <div style={{
          fontSize: "13px",
          color:
            parseFloat(data.change24h) >= 0 ? "#4ade80" : "#f87171",
        }}>
          24h: {data.change24h}
        </div>
      </div>

      <div style={{
        fontSize: "11px",
        color: "#9ca3af",
        marginBottom: "12px",
        lineHeight: "1.5",
      }}>
        {data.orderflow}
      </div>

      {expandedPair === pair && (
        <div style={{
          borderTop: "1px solid #1a1f2e",
          paddingTop: "12px",
          marginTop: "12px",
        }}>
          <MTFTable data={data} />
        </div>
      )}
    </div>
  );

  const MTFTable = ({ data }) => (
    <div>
      {["1D", "4H", "1H"].map((tf) => (
        <div key={tf} style={{
          marginBottom: "12px",
          padding: "12px",
          backgroundColor: "#1a1f2e",
          borderRadius: "6px",
          borderLeft: `3px solid ${data.multitimeframe[tf].trendColor}`,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
            <span style={{ color: "#e8eaed", fontWeight: "bold" }}>{tf}</span>
            <span style={{ color: data.multitimeframe[tf].trendColor }}>
              {data.multitimeframe[tf].trend}
            </span>
          </div>
          <div style={{ fontSize: "11px", color: "#9ca3af", lineHeight: "1.6" }}>
            <div>RSI: {data.multitimeframe[tf].rsi.toFixed(2)} | CCI: {data.multitimeframe[tf].cci.toFixed(2)}</div>
            <div>EW: {data.multitimeframe[tf].ewWave}</div>
            <div>ICT: {data.multitimeframe[tf].ictStructure}</div>
            <div>
              레벨: {data.multitimeframe[tf].keyLevels.join(" / ")}
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const ScenarioBox = ({ scenario }) => (
    <div style={{
      marginBottom: "12px",
      padding: "12px",
      backgroundColor: "#1a1f2e",
      borderRadius: "6px",
      borderLeft: `3px solid ${scenario.typeColor}`,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
        <span style={{ color: "#e8eaed", fontWeight: "bold", textTransform: "uppercase" }}>
          {scenario.type}
        </span>
        <span style={{ color: scenario.typeColor, fontWeight: "bold" }}>
          {scenario.probability}%
        </span>
      </div>
      <div style={{ fontSize: "11px", color: "#9ca3af", lineHeight: "1.6" }}>
        <div>Entry: {scenario.entry}</div>
        <div>TP: {scenario.tp} | SL: {scenario.sl}</div>
        <div>R:R: {scenario.rr}</div>
      </div>
    </div>
  );

  return (
    <div style={{
      backgroundColor: "#0b0e14",
      color: "#e8eaed",
      minHeight: "100vh",
      fontFamily: "system-ui, -apple-system, sans-serif",
    }}>
      {/* Header */}
      <div style={{
        backgroundColor: "#131720",
        padding: "20px",
        borderBottom: "1px solid #1a1f2e",
      }}>
        <h1 style={{ margin: "0 0 8px 0", fontSize: "24px", fontWeight: "bold" }}>
          암호화폐 선물 기술적 분석 대시보드
        </h1>
        <p style={{ margin: "0", color: "#9ca3af", fontSize: "12px" }}>
          BTCUSDT, ETHUSDT, SOLUSDT, HYPEUSDT | Elliott Wave + ICT/SMC + 오더플로우
        </p>
        <p style={{ margin: "8px 0 0 0", color: "#9ca3af", fontSize: "11px" }}>
          분석 일시: {ANALYSIS_DATE}
        </p>
      </div>

      {/* Tabs */}
      <div style={{
        display: "flex",
        backgroundColor: "#131720",
        borderBottom: "1px solid #1a1f2e",
        overflowX: "auto",
      }}>
        <TabButton id="overview" label="개요" />
        <TabButton id="elliott" label="Elliott Wave" />
        <TabButton id="ict" label="ICT/SMC" />
        <TabButton id="orderflow" label="오더플로우" />
        <TabButton id="scenarios" label="시나리오" />
        <TabButton id="risk" label="리스크" />
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {activeTab === "overview" && (
          <div>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "16px",
              marginBottom: "24px",
            }}>
              {Object.entries(pairs).map(([pair, data]) => (
                <PairCard key={pair} pair={pair} data={data} />
              ))}
            </div>
          </div>
        )}

        {activeTab === "elliott" && (
          <div>
            <h2 style={{ marginBottom: "16px", fontSize: "18px", fontWeight: "bold" }}>
              Elliott Wave 분석
            </h2>
            {Object.entries(pairs).map(([pair, data]) => (
              <div key={pair} style={{
                backgroundColor: "#131720",
                border: "1px solid #1a1f2e",
                borderRadius: "8px",
                padding: "16px",
                marginBottom: "16px",
              }}>
                <h3 style={{ margin: "0 0 12px 0", color: "#e8eaed" }}>
                  {pair}
                </h3>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: "12px",
                }}>
                  {["1D", "4H", "1H"].map((tf) => (
                    <div key={tf} style={{
                      backgroundColor: "#1a1f2e",
                      padding: "12px",
                      borderRadius: "6px",
                    }}>
                      <div style={{ fontSize: "12px", color: "#9ca3af", marginBottom: "4px" }}>
                        {tf}
                      </div>
                      <div style={{ fontSize: "13px", color: "#e8eaed", fontWeight: "bold" }}>
                        {data.multitimeframe[tf].ewWave}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "ict" && (
          <div>
            <h2 style={{ marginBottom: "16px", fontSize: "18px", fontWeight: "bold" }}>
              ICT / SMC 분석
            </h2>
            {Object.entries(pairs).map(([pair, data]) => (
              <div key={pair} style={{
                backgroundColor: "#131720",
                border: "1px solid #1a1f2e",
                borderRadius: "8px",
                padding: "16px",
                marginBottom: "16px",
              }}>
                <h3 style={{ margin: "0 0 12px 0", color: "#e8eaed" }}>
                  {pair}
                </h3>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: "12px",
                }}>
                  {["1D", "4H", "1H"].map((tf) => (
                    <div key={tf} style={{
                      backgroundColor: "#1a1f2e",
                      padding: "12px",
                      borderRadius: "6px",
                    }}>
                      <div style={{ fontSize: "12px", color: "#9ca3af", marginBottom: "4px" }}>
                        {tf}
                      </div>
                      <div style={{ fontSize: "12px", color: "#e8eaed" }}>
                        {data.multitimeframe[tf].ictStructure}
                      </div>
                      <div style={{ fontSize: "10px", color: "#9ca3af", marginTop: "6px" }}>
                        Levels: {data.multitimeframe[tf].keyLevels.join(", ")}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "orderflow" && (
          <div>
            <h2 style={{ marginBottom: "16px", fontSize: "18px", fontWeight: "bold" }}>
              오더플로우 분석
            </h2>
            <div style={{
              backgroundColor: "#131720",
              border: "1px solid #1a1f2e",
              borderRadius: "8px",
              padding: "16px",
              marginBottom: "16px",
            }}>
              <h3 style={{ margin: "0 0 12px 0", color: "#e8eaed" }}>
                데이터 소스 및 색상 코드
              </h3>
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "12px",
                fontSize: "12px",
                color: "#9ca3af",
              }}>
                <div style={{
                  backgroundColor: "#1a1f2e",
                  padding: "12px",
                  borderRadius: "6px",
                  borderLeft: "3px solid #f59e0b",
                }}>
                  <strong style={{ color: "#f59e0b" }}>히트맵 (고밀도)</strong>
                  <div>Coinglass/Exocharts</div>
                </div>
                <div style={{
                  backgroundColor: "#1a1f2e",
                  padding: "12px",
                  borderRadius: "6px",
                  borderLeft: "3px solid #22d3ee",
                }}>
                  <strong style={{ color: "#22d3ee" }}>CVD 양수</strong>
                  <div>매수 우위</div>
                </div>
                <div style={{
                  backgroundColor: "#1a1f2e",
                  padding: "12px",
                  borderRadius: "6px",
                  borderLeft: "3px solid #fb923c",
                }}>
                  <strong style={{ color: "#fb923c" }}>CVD 음수</strong>
                  <div>매도 압력</div>
                </div>
                <div style={{
                  backgroundColor: "#1a1f2e",
                  padding: "12px",
                  borderRadius: "6px",
                  borderLeft: "3px solid #a78bfa",
                }}>
                  <strong style={{ color: "#a78bfa" }}>수렴 (Confluence)</strong>
                  <div>다중 신호 일치</div>
                </div>
              </div>
            </div>

            {Object.entries(pairs).map(([pair, data]) => (
              <div key={pair} style={{
                backgroundColor: "#131720",
                border: "1px solid #1a1f2e",
                borderRadius: "8px",
                padding: "16px",
                marginBottom: "16px",
              }}>
                <h3 style={{ margin: "0 0 12px 0", color: "#e8eaed" }}>
                  {pair}
                </h3>
                <div style={{
                  backgroundColor: "#1a1f2e",
                  padding: "12px",
                  borderRadius: "6px",
                  fontSize: "12px",
                  color: "#9ca3af",
                  lineHeight: "1.6",
                }}>
                  {data.orderflow}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "scenarios" && (
          <div>
            <h2 style={{ marginBottom: "16px", fontSize: "18px", fontWeight: "bold" }}>
              트레이딩 시나리오
            </h2>
            {Object.entries(pairs).map(([pair, data]) => (
              <div key={pair} style={{
                backgroundColor: "#131720",
                border: "1px solid #1a1f2e",
                borderRadius: "8px",
                padding: "16px",
                marginBottom: "16px",
              }}>
                <h3 style={{ margin: "0 0 16px 0", color: "#e8eaed" }}>
                  {pair}
                </h3>
                {data.scenarios.map((scenario, idx) => (
                  <ScenarioBox key={idx} scenario={scenario} />
                ))}
              </div>
            ))}
          </div>
        )}

        {activeTab === "risk" && (
          <div>
            <h2 style={{ marginBottom: "16px", fontSize: "18px", fontWeight: "bold" }}>
              리스크 관리
            </h2>

            <div style={{
              backgroundColor: "#131720",
              border: "1px solid #1a1f2e",
              borderRadius: "8px",
              padding: "16px",
              marginBottom: "16px",
            }}>
              <h3 style={{ margin: "0 0 12px 0", color: "#e8eaed" }}>
                포지션 관리 원칙
              </h3>
              <ul style={{
                margin: "0",
                paddingLeft: "20px",
                color: "#9ca3af",
                fontSize: "12px",
                lineHeight: "1.8",
              }}>
                <li>항상 사전 정의된 SL로 진입. 예상 R:R 최소 1:1.5</li>
                <li>포지션 사이징: 계정 위험도 = 트레이드당 1-2% 최대</li>
                <li>추세 기반 SL 조정: 손실 보호 (Break-even)</li>
                <li>다중 타임프레임 수렴 지점에서만 진입</li>
                <li>오더플로우와 EW가 일치할 때만 HIGH 신뢰도</li>
              </ul>
            </div>

            <div style={{
              backgroundColor: "#131720",
              border: "1px solid #1a1f2e",
              borderRadius: "8px",
              padding: "16px",
              marginBottom: "16px",
            }}>
              <h3 style={{ margin: "0 0 12px 0", color: "#e8eaed" }}>
                현재 시장 상황
              </h3>
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: "12px",
                fontSize: "11px",
              }}>
                <div style={{
                  backgroundColor: "#1a1f2e",
                  padding: "12px",
                  borderRadius: "6px",
                  borderLeft: "3px solid #f87171",
                }}>
                  <div style={{ color: "#f87171", fontWeight: "bold", marginBottom: "4px" }}>
                    1D 구조
                  </div>
                  <div style={{ color: "#9ca3af" }}>
                    모두 약세 (RSI 32-36) | 저점 근처
                  </div>
                </div>
                <div style={{
                  backgroundColor: "#1a1f2e",
                  padding: "12px",
                  borderRadius: "6px",
                  borderLeft: "3px solid #fbbf24",
                }}>
                  <div style={{ color: "#fbbf24", fontWeight: "bold", marginBottom: "4px" }}>
                    4H 구조
                  </div>
                  <div style={{ color: "#9ca3af" }}>
                    중립 박스권 | 방향성 모색
                  </div>
                </div>
                <div style={{
                  backgroundColor: "#1a1f2e",
                  padding: "12px",
                  borderRadius: "6px",
                  borderLeft: "3px solid #4ade80",
                }}>
                  <div style={{ color: "#4ade80", fontWeight: "bold", marginBottom: "4px" }}>
                    1H 구조
                  </div>
                  <div style={{ color: "#9ca3af" }}>
                    강세 (RSI 59-68) | 랠리 진행중
                  </div>
                </div>
                <div style={{
                  backgroundColor: "#1a1f2e",
                  padding: "12px",
                  borderRadius: "6px",
                  borderLeft: "3px solid #a78bfa",
                }}>
                  <div style={{ color: "#a78bfa", fontWeight: "bold", marginBottom: "4px" }}>
                    수렴
                  </div>
                  <div style={{ color: "#9ca3af" }}>
                    1D 저점 → 4H 회복 → 1H 강세
                  </div>
                </div>
              </div>
            </div>

            <div style={{
              backgroundColor: "#131720",
              border: "1px solid #1a1f2e",
              borderRadius: "8px",
              padding: "16px",
            }}>
              <h3 style={{ margin: "0 0 12px 0", color: "#e8eaed" }}>
                쌍별 주요 관찰사항
              </h3>
              <ul style={{
                margin: "0",
                paddingLeft: "20px",
                color: "#9ca3af",
                fontSize: "12px",
                lineHeight: "1.8",
              }}>
                <li>
                  <strong style={{ color: "#f59e0b" }}>BTC:</strong> 72k-73k 수렴 저항 |
                  돌파 시 강한 상승세 신호
                </li>
                <li>
                  <strong style={{ color: "#f59e0b" }}>ETH:</strong> 1H RSI 74.67 (과매수) |
                  단기 조정 가능성
                </li>
                <li>
                  <strong style={{ color: "#f59e0b" }}>SOL:</strong> 4개 중 가장 강한 상승 구조 |
                  상승세 지속 확률 높음
                </li>
                <li>
                  <strong style={{ color: "#f59e0b" }}>HYPE:</strong> 저점 형성 신호 |
                  회복 초기 단계, 리스크 높음
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        backgroundColor: "#131720",
        borderTop: "1px solid #1a1f2e",
        padding: "16px 20px",
        marginTop: "40px",
        fontSize: "10px",
        color: "#9ca3af",
        textAlign: "center",
      }}>
        <p style={{ margin: "0" }}>
          본 분석은 차트 기반 기술적 분석입니다. 실제 투자 결정은 자신의 리스크 관리 후 진행하세요.
        </p>
        <p style={{ margin: "8px 0 0 0" }}>
          Data Sources: TradingView (BTC/ETH/SOL/HYPE) | Coinglass | Coinalyze | Exocharts
        </p>
      </div>
    </div>
  );
};

export default Dashboard;
