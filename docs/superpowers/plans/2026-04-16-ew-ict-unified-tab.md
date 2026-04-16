# EW+ICT 통합 분석 탭 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Elliott Wave 탭과 ICT 탭을 하나의 "분석" 탭으로 통합하고, 텍스트 블록 대신 시각적 컴포넌트(TF 정렬 바, EW 파동 스텝, ICT 2×2 그리드, 컨플루언스 태그)로 핵심 정보를 즉시 파악할 수 있도록 한다.

**Architecture:** 기존 `EWTab`/`ICTTab`/`EWContent`/`ICTContent` 4개 컴포넌트를 삭제하고, `AnalysisTab` + `AnalysisCard` + `TFAlignmentBar` + `EWWaveStep` + `ICTGrid` 컴포넌트로 교체. PAIRS 상수에 신규 필드 추가, tabs 배열 및 tabContent 디스패치 업데이트.

**Tech Stack:** React 18 (Babel CDN, no build), inline styles, hex colors only

---

## File Map

| 파일 | 변경 유형 | 내용 |
|------|---------|------|
| `reports/20260416_dashboard.html` | Modify | PAIRS 데이터 필드 추가, EWTab/ICTTab 삭제, AnalysisTab 신규 추가, tabs/tabContent 업데이트 |
| `CLAUDE.md` (프로젝트 루트) | Modify | 탭 구조 규칙 업데이트 (EW/ICT 탭 분리 → 분석 탭 통합) |

---

## Task 1: PAIRS 상수에 신규 필드 추가 (BTC)

**Files:**
- Modify: `reports/20260416_dashboard.html:65-74` (BTC ew/ict 블록)

PAIRS의 BTC 항목에 아래 신규 필드를 추가한다. 기존 필드(count, detail, confirmation, invalidation, structure, poi, liquidity, killzone, smt)는 그대로 보존한다.

- [ ] **Step 1: BTC ew 블록에 신규 필드 추가**

현재 BTC ew 블록 (line 65-69):
```javascript
ew: {
  "1D": { count: "...", detail: "...", confirmation: "...", invalidation: "..." },
  "4H": { count: "...", detail: "...", confirmation: "...", invalidation: "..." },
  "1H": { count: "...", detail: "...", confirmation: "...", invalidation: "..." }
},
```

변경 후:
```javascript
ew: {
  "1D": { direction: "long", current_wave: "W1", completed_waves: [], target: null, count: "ABC 조정 완료 가능성", detail: "ATH($109K)에서의 대규모 조정. 5파동 하락 후 반등 시작. 현재 반등은 조정 W2 또는 ABC 완료 후 새 상승 사이클 Wave 1 초입으로 해석 가능. EMA200($83,113) 아래에 위치 — 중기 Bear 구조 유지.", confirmation: "EMA 200 상향 돌파 시 구조 전환 확인", invalidation: "$64,918 스윙로우 이탈 시 장기 추세 심화" },
  "4H": { direction: "long", current_wave: "W3", completed_waves: ["W1", "W2"], target: 82500, count: "충격 Wave 3 진행 중", detail: "4H 기준 모든 EMA 강세 정렬(7>50>200). $70,256 저점에서 출발한 반등이 Wave 1→Wave 2 조정(~$72,451 Bull OB 지지) → 현재 Wave 3 진행 가능성. RSI 64 — 과열 전 추가 상승 여지.", confirmation: "4H BSL $76,003.95 돌파 시 Wave 3 연장 확인", invalidation: "$70,428 이탈 시 카운트 무효" },
  "1H": { direction: "long", current_wave: "W3", completed_waves: ["W1", "W2"], target: 76009, count: "소파동 조정 후 재상승 준비", detail: "1H RSI 53 — 고점 RSI 다이버전스 후 조정. Bull OB $74,300 지지 확인 중. 재상승 시 BSL $76,009 타겟.", confirmation: "$74,900 유지 후 $75,500 돌파", invalidation: "$73,766 이탈" }
},
```

- [ ] **Step 2: BTC ict 블록에 신규 필드 추가**

현재 BTC ict 블록 (line 70-74):
```javascript
ict: {
  "1D": { structure: "...", poi: "...", liquidity: "...", killzone: "...", smt: "..." },
  "4H": { structure: "...", poi: "...", liquidity: "...", killzone: "...", smt: "..." },
  "1H": { structure: "...", poi: "...", liquidity: "...", killzone: "...", smt: "..." }
},
```

변경 후:
```javascript
ict: {
  "1D": { structure_tag: "MSS", structure_direction: "bullish", poi_level: 74555, bsl: 94657.65, ssl: 64999.6, structure: "하락 추세 BOS 후 MSS 발생 — 회복 단계", poi: "Bull OB $74,555 (1D) 지지 유효. Bear OB $83,786 이상 저항 대기", liquidity: "BSL $94,657.65 (ATH 근방) 목표 장기. SSL $64,999.6 청소 완료", killzone: "현재 아시아 세션 이후 런던 오픈 킬존(KST 15:00-18:00) 방향 결정 주목", smt: "ETH와 BTC 동조 — 정상 상관관계 유지" },
  "4H": { structure_tag: "BOS", structure_direction: "bullish", poi_level: 74267.2, bsl: 76003.95, ssl: 70380.73, structure: "BOS 확인 — 상위 HTF 회복 추세 진행 중", poi: "4H Bull OB $74,267 지지. 4H BSL $76,003.95 청소 목표", liquidity: "BSL $76,003.95(=스윙하이 $76,009) 직상방에 숏 손절 밀집", killzone: "뉴욕 오픈 킬존에서 BSL 청소 후 방향 결정 예상", smt: "BTC가 ETH 대비 상대강도 우위 — 선도 역할" },
  "1H": { structure_tag: null, structure_direction: "neutral", poi_level: 74300, bsl: null, ssl: 73494.5, structure: "소규모 조정 후 BOS 상방 대기", poi: "1H Bull OB $74,300 지지 확인. FVG $74,369-$74,197 내 현재 가격 위치", liquidity: "1H SSL $73,494(유다스윙 타겟) vs BSL $76,009 — 롱 우위", killzone: "실버불릿(KST 23:00-00:00) 매수 셋업 대기", smt: "SMT 없음 — BTC/ETH 동조" }
},
```

- [ ] **Step 3: BTC에 bias + confluence 루트 필드 추가**

기존 BTC 객체에 `bias` 필드가 있는지 확인 (line 33: `bias: "bullish"` 이미 있음). `confluence` 배열 추가:

```javascript
confluence: [
  "4H EW W3 상승 + ICT BOS 일치 ✓",
  "Bull OB $74,267 = EW W2 되돌림 구간 겹침",
  "BSL $76,004 = W3 최소 목표"
],
```

BTC 객체 상단 `bias: "bullish"` 바로 뒤에 이 `confluence` 배열을 추가한다.

- [ ] **Step 4: 브라우저에서 BTC 항목 렌더링 에러 없는지 확인**

`reports/20260416_dashboard.html`을 브라우저에서 열어 기존 탭(Overview, Elliott Wave, ICT)이 정상 렌더링되는지 확인. 데이터 변경만이므로 기존 UI는 그대로여야 한다.

- [ ] **Step 5: Commit**

```bash
git add reports/20260416_dashboard.html
git commit -m "feat: add analysis tab data fields to BTC in PAIRS"
```

---

## Task 2: 나머지 3개 페어(ETH/SOL/HYPE)에 신규 필드 추가

**Files:**
- Modify: `reports/20260416_dashboard.html` (ETH/SOL/HYPE ew/ict 블록)

ETH, SOL, HYPE 각각에 Task 1과 동일한 신규 필드를 추가한다.

- [ ] **Step 1: ETH ew 블록에 direction/current_wave/completed_waves/target 추가**

ETH ew 블록을 찾아서 (`ew: {` 두 번째 등장):

```javascript
ew: {
  "1D": { direction: "neutral", current_wave: "C", completed_waves: ["W1", "W2", "W3", "W4", "W5", "A", "B"], target: null, count: /* 기존 값 유지 */, detail: /* ... */, confirmation: /* ... */, invalidation: /* ... */ },
  "4H": { direction: "neutral", current_wave: "C", completed_waves: [], target: null, count: /* ... */, detail: /* ... */, confirmation: /* ... */, invalidation: /* ... */ },
  "1H": { direction: "neutral", current_wave: "C", completed_waves: [], target: null, count: /* ... */, detail: /* ... */, confirmation: /* ... */, invalidation: /* ... */ }
},
```

> 참고: ETH의 실제 `direction`/`current_wave`/`completed_waves`/`target` 값은 해당 페어의 기존 `count` 텍스트를 읽고 실제 분석을 반영하여 채운다. 위 값은 예시일 뿐 — 현재 코드의 실제 ETH count 텍스트 기반으로 판단.

- [ ] **Step 2: ETH ict 블록에 structure_tag/structure_direction/poi_level/bsl/ssl 추가**

ETH ict 블록의 각 TF에 신규 필드 추가. `structure` 텍스트에서 BOS/MSS/CHoCH를 읽어 `structure_tag` 결정. `poi` 텍스트에서 첫 번째 달러 수치를 `poi_level`로 추출. `liquidity` 텍스트에서 BSL/SSL 수치 추출.

- [ ] **Step 3: ETH confluence 추가**

ETH 객체에 `confluence: [...]` 배열 추가. 기존 분석 텍스트를 바탕으로 EW/ICT 수렴 포인트 1-3개 작성.

- [ ] **Step 4: SOL 동일 작업**

SOL ew/ict 블록에 동일한 신규 필드 추가 + `confluence` 배열 추가.

- [ ] **Step 5: HYPE 동일 작업**

HYPE ew/ict 블록에 동일한 신규 필드 추가 + `confluence` 배열 추가.

- [ ] **Step 6: 브라우저 확인 후 Commit**

```bash
git add reports/20260416_dashboard.html
git commit -m "feat: add analysis tab data fields to ETH/SOL/HYPE in PAIRS"
```

---

## Task 3: AnalysisTab 컴포넌트 구현

**Files:**
- Modify: `reports/20260416_dashboard.html` (line 552 근처 — EWTab 위치에 새 컴포넌트 삽입)

기존 `EWTab`(line 552-592)과 `ICTTab`(line 616-685) 사이에 새 컴포넌트를 삽입한다. 기존 컴포넌트는 Task 4에서 삭제한다.

- [ ] **Step 1: TFAlignmentBar 헬퍼 컴포넌트 작성**

`ICTContent` 함수(line 658) 바로 위에 삽입:

```javascript
// TF 방향 → 배경색/텍스트색
function tfDirStyle(direction) {
  if (direction === 'long')    return { bg: '#4ade8015', border: '#4ade8040', color: '#4ade80', label: '▲ 상승' };
  if (direction === 'short')   return { bg: '#f8717115', border: '#f8717140', color: '#f87171', label: '▼ 하락' };
  return { bg: '#fbbf2415', border: '#fbbf2440', color: '#fbbf24', label: '↔ 중립' };
}

function structureLabel(tag, direction) {
  if (!tag) return null;
  const arrow = direction === 'bullish' ? '▲' : direction === 'bearish' ? '▼' : '↔';
  return `ICT ${arrow}${tag}`;
}

function TFAlignmentBar({ p, tfs }) {
  return (
    <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
      {tfs.map(tf => {
        const ew = p.ew[tf];
        const ict = p.ict[tf];
        const ds = tfDirStyle(ew.direction);
        const sLabel = structureLabel(ict.structure_tag, ict.structure_direction);
        return (
          <div key={tf} style={{ flex: 1, background: ds.bg, border: `1px solid ${ds.border}`, borderRadius: '7px', padding: '10px' }}>
            <div style={{ color: '#9ca3af', fontSize: '10px', marginBottom: '4px' }}>{tf}</div>
            <div style={{ color: ds.color, fontWeight: 700, fontSize: '13px' }}>{ds.label}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '5px' }}>
              <span style={{ color: '#f59e0b', fontSize: '10px' }}>EW {ew.current_wave || '—'}</span>
              {sLabel && <span style={{ color: '#22d3ee', fontSize: '10px' }}>{sLabel}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: EWWaveStep 헬퍼 컴포넌트 작성**

```javascript
const ALL_WAVES = ['W1', 'W2', 'W3', 'W4', 'W5'];

function EWWaveStep({ ew }) {
  const completed = ew.completed_waves || [];
  const current = ew.current_wave;
  const waves = ALL_WAVES;

  return (
    <div style={{ background: '#0b0e14', borderRadius: '8px', padding: '12px' }}>
      <div style={{ color: '#f59e0b', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>EW 파동 위치</div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px', overflowX: 'auto', paddingBottom: '2px' }}>
        {waves.map((w, i) => {
          const isDone = completed.includes(w);
          const isCurrent = current === w;
          const boxStyle = isDone
            ? { background: '#4ade8033', border: '2px solid #4ade80', color: '#4ade80' }
            : isCurrent
              ? { background: '#f59e0b22', border: '2px solid #f59e0b', color: '#f59e0b' }
              : { background: '#1a1f2e', border: '1px solid #2a2f3e', color: '#4b5563' };
          const lineColor = isDone ? '#4ade80' : isCurrent ? '#f59e0b' : '#2a2f3e';
          return (
            <React.Fragment key={w}>
              <div style={{ ...boxStyle, borderRadius: '4px', padding: '4px 7px', fontSize: '10px', fontWeight: 700, flexShrink: 0, whiteSpace: 'nowrap' }}>
                {w}{isDone ? '✓' : isCurrent ? '◀' : ''}
              </div>
              {i < waves.length - 1 && (
                <div style={{ height: '2px', width: '10px', background: lineColor, flexShrink: 0 }} />
              )}
            </React.Fragment>
          );
        })}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
        {ew.target != null && (
          <div style={{ background: '#131720', borderRadius: '5px', padding: '6px' }}>
            <div style={{ color: '#9ca3af', fontSize: '9px' }}>타겟</div>
            <div style={{ color: '#22d3ee', fontWeight: 700, fontSize: '11px' }}>${ew.target.toLocaleString()}</div>
          </div>
        )}
        {ew.confirmation && (
          <div style={{ background: '#131720', borderRadius: '5px', padding: '6px' }}>
            <div style={{ color: '#9ca3af', fontSize: '9px' }}>확인 ✓</div>
            <div style={{ color: '#4ade80', fontWeight: 700, fontSize: '10px', lineHeight: '1.3' }}>{ew.confirmation}</div>
          </div>
        )}
        {ew.invalidation && (
          <div style={{ background: '#131720', borderRadius: '5px', padding: '6px' }}>
            <div style={{ color: '#9ca3af', fontSize: '9px' }}>무효화 ✗</div>
            <div style={{ color: '#f87171', fontWeight: 700, fontSize: '10px', lineHeight: '1.3' }}>{ew.invalidation}</div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: ICTGrid 헬퍼 컴포넌트 작성**

```javascript
function ICTGrid({ ict }) {
  const fmtPrice = v => v != null ? `$${Number(v).toLocaleString()}` : '—';
  const structureArrow = ict.structure_direction === 'bullish' ? '▲' : ict.structure_direction === 'bearish' ? '▼' : '↔';

  return (
    <div style={{ background: '#0b0e14', borderRadius: '8px', padding: '12px' }}>
      <div style={{ color: '#22d3ee', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>ICT</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px', marginBottom: '6px' }}>
        <div style={{ background: '#4ade8010', border: '1px solid #4ade8025', borderRadius: '5px', padding: '7px' }}>
          <div style={{ color: '#4ade80', fontSize: '9px', fontWeight: 700, marginBottom: '2px' }}>구조</div>
          <div style={{ color: '#e8eaed', fontWeight: 600, fontSize: '11px' }}>{structureArrow} {ict.structure_tag || '—'}</div>
        </div>
        <div style={{ background: '#f59e0b10', border: '1px solid #f59e0b25', borderRadius: '5px', padding: '7px' }}>
          <div style={{ color: '#f59e0b', fontSize: '9px', fontWeight: 700, marginBottom: '2px' }}>POI</div>
          <div style={{ color: '#e8eaed', fontWeight: 600, fontSize: '11px' }}>{fmtPrice(ict.poi_level)}</div>
        </div>
        <div style={{ background: '#22d3ee10', border: '1px solid #22d3ee25', borderRadius: '5px', padding: '7px' }}>
          <div style={{ color: '#22d3ee', fontSize: '9px', fontWeight: 700, marginBottom: '2px' }}>유동성</div>
          <div style={{ color: '#e8eaed', fontWeight: 600, fontSize: '11px' }}>BSL {fmtPrice(ict.bsl)}</div>
          <div style={{ color: '#9ca3af', fontSize: '9px' }}>SSL {fmtPrice(ict.ssl)}</div>
        </div>
        <div style={{ background: '#a78bfa10', border: '1px solid #a78bfa25', borderRadius: '5px', padding: '7px' }}>
          <div style={{ color: '#a78bfa', fontSize: '9px', fontWeight: 700, marginBottom: '2px' }}>킬존</div>
          <div style={{ color: '#9ca3af', fontSize: '10px', lineHeight: '1.4' }}>{ict.killzone || '—'}</div>
        </div>
      </div>
      {ict.smt && (
        <div style={{ background: '#fb923c10', border: '1px solid #fb923c25', borderRadius: '5px', padding: '6px', display: 'flex', gap: '6px', alignItems: 'center' }}>
          <span style={{ color: '#fb923c', fontSize: '9px', fontWeight: 700 }}>SMT</span>
          <span style={{ color: '#9ca3af', fontSize: '10px' }}>{ict.smt}</span>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: AnalysisCard 컴포넌트 작성**

```javascript
function AnalysisCard({ p, isMobile }) {
  const tfs = ['1D', '4H', '1H'];
  const [selectedTF, setSelectedTF] = React.useState('4H');
  const [textOpen, setTextOpen] = React.useState(false);
  const biasStyle = p.bias === 'bullish'
    ? { bg: '#4ade8022', color: '#4ade80', label: '▲ LONG' }
    : p.bias === 'bearish'
      ? { bg: '#f8717122', color: '#f87171', label: '▼ SHORT' }
      : { bg: '#fbbf2422', color: '#fbbf24', label: '↔ NEUTRAL' };

  const ew = p.ew[selectedTF];
  const ict = p.ict[selectedTF];

  return (
    <div style={{ background: '#131720', borderRadius: '10px', padding: '18px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', paddingBottom: '14px', borderBottom: `1px solid #1a1f2e` }}>
        <div>
          <span style={{ color: '#e8eaed', fontWeight: 700, fontSize: '15px' }}>{p.symbol}</span>
          <span style={{ color: '#6b7280', fontSize: '12px', marginLeft: '8px' }}>EW + ICT</span>
        </div>
        <span style={{ background: biasStyle.bg, color: biasStyle.color, padding: '4px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 700 }}>
          {biasStyle.label}
        </span>
      </div>

      {/* Section 1: TF Alignment Bar */}
      <div style={{ marginBottom: '14px' }}>
        <div style={{ color: '#9ca3af', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>타임프레임 정렬</div>
        <TFAlignmentBar p={p} tfs={tfs} />
      </div>

      {/* Section 2: TF Selector + EW Step / ICT Grid */}
      <div style={{ marginBottom: '14px' }}>
        <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
          {tfs.map(tf => (
            <button key={tf} onClick={() => setSelectedTF(tf)} style={{
              background: selectedTF === tf ? '#22d3ee22' : '#1a1f2e',
              color: selectedTF === tf ? '#22d3ee' : '#6b7280',
              border: 'none', borderRadius: '4px', padding: '3px 10px', fontSize: '11px', fontWeight: selectedTF === tf ? 700 : 400, cursor: 'pointer'
            }}>{tf}</button>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '10px' }}>
          <EWWaveStep ew={ew} />
          <ICTGrid ict={ict} />
        </div>
      </div>

      {/* Section 3: Confluence Tags */}
      {p.confluence && p.confluence.length > 0 && (
        <div style={{ background: '#0b0e14', borderRadius: '8px', padding: '12px', marginBottom: '12px' }}>
          <div style={{ color: '#9ca3af', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>컨플루언스 요약</div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {p.confluence.map((c, i) => (
              <span key={i} style={{ background: '#4ade8022', color: '#4ade80', padding: '3px 10px', borderRadius: '4px', fontSize: '11px' }}>{c}</span>
            ))}
          </div>
        </div>
      )}

      {/* Section 4: Text Toggle */}
      <div>
        <div onClick={() => setTextOpen(v => !v)} style={{ color: '#6b7280', fontSize: '11px', textAlign: 'right', cursor: 'pointer', marginBottom: textOpen ? '10px' : 0 }}>
          {textOpen ? '▾ 전체 분석 텍스트 닫기' : '▸ 전체 분석 텍스트 보기'}
        </div>
        {textOpen && (
          <div style={{ fontSize: '11px', color: '#9ca3af', lineHeight: '1.6' }}>
            {tfs.map((tf, i) => {
              const ewTF = p.ew[tf];
              const ictTF = p.ict[tf];
              return (
                <div key={tf} style={{ marginBottom: i < tfs.length - 1 ? '14px' : 0 }}>
                  <div style={{ color: '#f59e0b', fontWeight: 700, marginBottom: '4px' }}>{tf} — EW</div>
                  <div style={{ marginBottom: '8px' }}>{ewTF.detail}</div>
                  <div style={{ color: '#22d3ee', fontWeight: 700, marginBottom: '4px' }}>{tf} — ICT</div>
                  <div>구조: {ictTF.structure}</div>
                  <div>POI: {ictTF.poi}</div>
                  <div>유동성: {ictTF.liquidity}</div>
                  {i < tfs.length - 1 && <Divider />}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: AnalysisTab 컴포넌트 작성**

```javascript
function AnalysisTab({ pairs, selectedPair, isMobile }) {
  const [activePair, setActivePair] = React.useState(selectedPair);
  const p = pairs.find(x => x.symbol === activePair) || pairs[0];

  return (
    <div>
      {/* Pair Selector */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {pairs.map(pair => (
          <button key={pair.symbol} onClick={() => setActivePair(pair.symbol)} style={{
            background: activePair === pair.symbol ? '#f59e0b22' : '#1a1f2e',
            color: activePair === pair.symbol ? '#f59e0b' : '#9ca3af',
            border: 'none', borderRadius: '6px', padding: '6px 16px', fontSize: '12px',
            fontWeight: activePair === pair.symbol ? 700 : 400, cursor: 'pointer'
          }}>
            {pair.short}
          </button>
        ))}
      </div>
      <AnalysisCard p={p} isMobile={isMobile} />
    </div>
  );
}
```

- [ ] **Step 6: 컴포넌트가 파일 내 올바른 위치에 삽입되었는지 확인**

`EWTab` 함수 정의(line 552) 바로 앞에 위 컴포넌트들을 순서대로 삽입한다:
1. `tfDirStyle` (헬퍼 함수)
2. `structureLabel` (헬퍼 함수)
3. `TFAlignmentBar`
4. `ALL_WAVES` 상수
5. `EWWaveStep`
6. `ICTGrid`
7. `AnalysisCard`
8. `AnalysisTab`

- [ ] **Step 7: Commit (기존 탭 교체 전 — 신규 컴포넌트만 추가된 상태)**

```bash
git add reports/20260416_dashboard.html
git commit -m "feat: add AnalysisTab components (TFAlignmentBar, EWWaveStep, ICTGrid, AnalysisCard)"
```

---

## Task 4: tabs 배열 및 tabContent 디스패치 업데이트

**Files:**
- Modify: `reports/20260416_dashboard.html:946` (tabs 배열)
- Modify: `reports/20260416_dashboard.html:962-965` (tabContent 디스패치)

- [ ] **Step 1: tabs 배열에서 'Elliott Wave', 'ICT' 제거하고 '분석' 추가**

Line 946:
```javascript
// 변경 전
const tabs = ['Overview', 'Macro', 'Elliott Wave', 'ICT', 'Orderflow', 'Scenarios', 'Risk'];

// 변경 후
const tabs = ['Overview', 'Macro', '분석', 'Orderflow', 'Scenarios', 'Risk'];
```

- [ ] **Step 2: tabContent 디스패치에서 EWTab/ICTTab 제거하고 AnalysisTab 추가**

Lines 962-965:
```javascript
// 변경 전
} else if (activeTab === 'Elliott Wave') {
  tabContent = <EWTab pairs={PAIRS} selectedPair={selectedPair} isMobile={isMobile} />;
} else if (activeTab === 'ICT') {
  tabContent = <ICTTab pairs={PAIRS} selectedPair={selectedPair} isMobile={isMobile} />;

// 변경 후
} else if (activeTab === '분석') {
  tabContent = <AnalysisTab pairs={PAIRS} selectedPair={selectedPair} isMobile={isMobile} />;
```

- [ ] **Step 3: 브라우저에서 탭 전환 동작 확인**

`reports/20260416_dashboard.html`을 브라우저에서 열어:
1. 탭 바에서 'Elliott Wave', 'ICT' 탭이 사라지고 '분석' 탭이 보이는지 확인
2. '분석' 탭 클릭 시 BTC 카드가 표시되는지 확인
3. BTC/ETH/SOL/HYPE 페어 전환이 동작하는지 확인
4. 1D/4H/1H TF 셀렉터 전환이 동작하는지 확인
5. "전체 분석 텍스트 보기" 토글이 동작하는지 확인
6. 모바일 뷰(DevTools 393px)에서 EW스텝/ICT그리드가 세로 스택으로 전환되는지 확인

- [ ] **Step 4: Commit**

```bash
git add reports/20260416_dashboard.html
git commit -m "feat: replace Elliott Wave + ICT tabs with unified 분석 tab"
```

---

## Task 5: 구 컴포넌트 삭제

**Files:**
- Modify: `reports/20260416_dashboard.html:552-685` (EWTab, EWContent, ICTTab, ICTContent 삭제)

- [ ] **Step 1: EWTab 함수 삭제 (line 552-592)**

`function EWTab(` 부터 닫는 `}` 까지 전체 삭제.

- [ ] **Step 2: EWContent 함수 삭제 (line 594-614)**

`function EWContent(` 부터 닫는 `}` 까지 전체 삭제.

- [ ] **Step 3: ICTTab 함수 삭제 (line 616-656)**

`function ICTTab(` 부터 닫는 `}` 까지 전체 삭제.

- [ ] **Step 4: ICTContent 함수 삭제 (line 658-685)**

`function ICTContent(` 부터 닫는 `}` 까지 전체 삭제.

- [ ] **Step 5: 브라우저에서 에러 없는지 확인**

DevTools 콘솔에서 `Uncaught ReferenceError` 없는지 확인.

- [ ] **Step 6: Commit**

```bash
git add reports/20260416_dashboard.html
git commit -m "chore: remove legacy EWTab, EWContent, ICTTab, ICTContent components"
```

---

## Task 6: CLAUDE.md 탭 구조 규칙 업데이트

**Files:**
- Modify: `CLAUDE.md` (프로젝트 루트의 대시보드 규칙 탭 구조 항목)

- [ ] **Step 1: 탭 구조 규칙 업데이트**

CLAUDE.md에서 `탭 구조:` 항목을 찾아 수정:

```
# 변경 전
탭 구조: Overview / Macro / Elliott Wave / ICT / Orderflow / Scenarios / Risk

# 변경 후
탭 구조: Overview / Macro / 분석 / Orderflow / Scenarios / Risk
```

> 참고: CLAUDE.md의 탭 구조 규칙 위치는 "대시보드 규칙" 섹션 `- **탭 구조**: Overview / Macro / Elliott Wave / ICT / Orderflow / Scenarios / Risk` 줄이다.

- [ ] **Step 2: 분석 탭 데이터 스키마 규칙 추가**

CLAUDE.md의 `- **Orderflow 탭**:` 항목 위에 신규 항목 삽입:

```markdown
- **분석 탭**: EW + ICT 통합. `bias`(루트), `confluence[]`(루트), `ew[TF].direction/current_wave/completed_waves/target`, `ict[TF].structure_tag/structure_direction/poi_level/bsl/ssl` 필드 필수. 신규 필드가 없거나 `null`이면 해당 카드는 "—" 표시. 추정값 생성 금지. `confluence` 배열은 분석 시 수동 작성 (자동 계산 불가).
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update tab structure rules for unified 분석 tab in CLAUDE.md"
```

---

## Self-Review

### Spec 커버리지 체크

| 스펙 요구사항 | 커버된 Task |
|------------|-----------|
| Elliott Wave + ICT 탭 통합 → "분석" 탭 | Task 4 |
| 탭 순서: Overview / Macro / 분석 / Orderflow / Scenarios / Risk | Task 4 Step 1 |
| 페어 선택 (BTC/ETH/SOL/HYPE) | Task 3 Step 5 |
| 종합 바이어스 헤더 (▲ LONG / ▼ SHORT / ↔ NEUTRAL) | Task 3 Step 4 |
| Section 1: TF 정렬 바 (1D/4H/1H, 색상 코딩) | Task 3 Step 1 |
| Section 2: EW 파동 스텝 다이어그램 | Task 3 Step 2 |
| Section 2: ICT 2×2 그리드 | Task 3 Step 3 |
| Section 2: 공유 TF 셀렉터 (기본 4H) | Task 3 Step 4 |
| Section 3: 컨플루언스 요약 태그 | Task 3 Step 4 |
| Section 4: 전체 텍스트 토글 | Task 3 Step 4 |
| 신규 PAIRS 필드 추가 (4 페어) | Task 1-2 |
| 신규 필드 없을 시 "—" 표시 | Task 3 Step 3 (fmtPrice null 처리) |
| 모바일: EW스텝+ICT그리드 세로 스택 | Task 3 Step 4 (isMobile ? '1fr') |
| 모바일: 페어 선택 accordion 아닌 버튼(탭 상단) | Task 3 Step 5 (버튼 선택기 사용) |
| CLAUDE.md 탭 구조 업데이트 | Task 6 |

### 잠재적 이슈

- **ABC 파동 표시**: `ALL_WAVES = ['W1','W2','W3','W4','W5']`는 충격파 전용. ETH가 ABC 조정파라면 current_wave가 'C'여도 W1-W5 스텝 중 어느 것도 하이라이트되지 않는다. 이 케이스는 EWWaveStep에서 `current_wave`가 매칭되지 않으면 스텝이 모두 회색으로 표시되고 count 텍스트(토글)에서 확인 가능 — 허용 범위.
- **completed_waves 가 null인 경우**: `const completed = ew.completed_waves || []`로 방어 처리됨.
- **poi_level, bsl, ssl 이 null인 경우**: `fmtPrice(null)` → `'—'` 반환으로 방어 처리됨.
