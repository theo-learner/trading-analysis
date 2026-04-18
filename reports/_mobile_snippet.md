# Mobile Snippet — Dashboard 반응형 코드 블록

신규 `YYYYMMDD_dashboard.html` 작성 시 그대로 복붙해서 사용한다.

---

## 1. useIsMobile 훅

`Dashboard()` 함수 정의 바로 위에 삽입한다.

```javascript
function useIsMobile() {
  const [m, setM] = React.useState(() => window.matchMedia('(max-width: 767px)').matches);
  React.useEffect(() => {
    const mql = window.matchMedia('(max-width: 767px)');
    const h = e => setM(e.matches);
    mql.addEventListener('change', h);
    return () => mql.removeEventListener('change', h);
  }, []);
  return m;
}
```

---

## 2. Dashboard() 최상단 + 탭바 auto-scroll

```javascript
function Dashboard() {
  const isMobile = useIsMobile();
  const tabBarRef = React.useRef(null);

  React.useEffect(() => {
    if (!isMobile || !tabBarRef.current) return;
    const activeBtn = tabBarRef.current.querySelector('[data-active="true"]');
    if (activeBtn) activeBtn.scrollIntoView({ inline: 'center', behavior: 'smooth' });
  }, [activeTab, isMobile]);

  // ... (tabContent 분기, tabContent 변수 패턴 사용)

  const contentPadding = isMobile ? '14px 12px' : '20px 24px';
  const headerPadding = isMobile ? '12px' : '14px 24px';
```

탭 버튼에 `data-active` 속성 필수:
```jsx
<button data-active={activeTab === tab ? 'true' : 'false'} ... >
```

탭바 컨테이너에 `ref={tabBarRef}` 추가:
```jsx
<div ref={tabBarRef} style={{ overflowX: 'auto', ... }}>
```

---

## 3. Header (모바일 column / 데스크탑 row)

```jsx
{isMobile ? (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
    <div>
      <div style={{ fontSize: '16px', fontWeight: 700, color: '#e8eaed', marginBottom: '2px' }}>
        Crypto Futures Analysis
      </div>
      <div style={{ fontSize: '11px', color: '#6b7280' }}>YYYY-MM-DD · EW + ICT/SMC + Orderflow</div>
    </div>
    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
      {/* 배지들 */}
    </div>
  </div>
) : (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    {/* 데스크탑 레이아웃 */}
  </div>
)}
```

---

## 4. Overview — 페어 carousel (모바일)

```jsx
function OverviewTab({ pairs, selectedPair, onSelectPair, isMobile }) {
  if (isMobile) {
    return (
      <div>
        {/* Carousel */}
        <div style={{
          display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory',
          gap: '10px', margin: '0 -12px', padding: '0 12px 8px',
          WebkitOverflowScrolling: 'touch'
        }}>
          {pairs.map(p => (
            <div key={p.symbol} style={{ minWidth: '78%', scrollSnapAlign: 'start' }}>
              {/* 카드 내용 */}
            </div>
          ))}
        </div>
        {/* Dot indicators */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginBottom: '16px' }}>
          {pairs.map(p => (
            <div key={p.symbol} onClick={() => onSelectPair(p.symbol)} style={{
              width: '6px', height: '6px', borderRadius: '50%', cursor: 'pointer',
              background: selectedPair === p.symbol ? '#4ade80' : '#374151'
            }} />
          ))}
        </div>
      </div>
    );
  }
  // 데스크탑: repeat(4, 1fr) 그리드
}
```

---

## 5. 분석 / Risk — 모바일 패턴

```jsx
function AnalysisTab({ pairs, selectedPair, onSelectPair, isMobile }) {
  const pair = pairs.find(item => item.symbol === selectedPair) || pairs[0];

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {pairs.map(item => (
          <button
            key={item.symbol}
            onClick={() => onSelectPair(item.symbol)}
            style={{
              background: selectedPair === item.symbol ? '#f59e0b22' : '#1a1f2e',
              color: selectedPair === item.symbol ? '#f59e0b' : '#9ca3af',
              border: 'none',
              borderRadius: '6px',
              padding: isMobile ? '8px 14px' : '6px 16px',
              fontSize: '12px',
              fontWeight: selectedPair === item.symbol ? 700 : 400,
              cursor: 'pointer',
            }}
          >
            {item.short}
          </button>
        ))}
      </div>
      <AnalysisCard p={pair} isMobile={isMobile} />
    </div>
  );
}

// AnalysisCard 내부는 shared TF selector + TFAlignmentBar + EWWaveStep + ICTGrid 조합을 사용한다.
// 모바일에서도 separate EW/ICT accordion을 만들지 않는다.

function RiskTab({ pairs, selectedPair, onSelectPair, isMobile }) {
  if (!isMobile) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
        {pairs.map(p => <Card key={p.symbol}>...</Card>)}
      </div>
    );
  }

  const pair = pairs.find(item => item.symbol === selectedPair) || pairs[0];
  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {pairs.map(item => (
          <button key={item.symbol} onClick={() => onSelectPair(item.symbol)}>{item.short}</button>
        ))}
      </div>
      <Card>{/* selected pair risk body */}</Card>
    </div>
  );
}
```

---

## 6. Overview 전략 추천 — 필수 포함 코드

신규 대시보드 작성 시 **반드시** 아래 코드를 전체 포함해야 한다.
삽입 위치: `// ─── TAB COMPONENTS` 섹션 직전 (유틸 함수 다음, OverviewTab 정의 전).
렌더링: `OverviewTab` 내 페어 카드 그리드 바로 다음 줄에 `<OverviewStrategyGrid pairs={pairs} isMobile={isMobile} />` 추가.

```javascript
// ─── STRATEGY UTILS ──────────────────────────────────────────────────────────

function asNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function dedupeLevels(levels) {
  return [...new Set((levels || []).map(asNumber).filter(value => value != null))].sort((a, b) => a - b);
}

function pickNearest(levels, predicate, sortFn) {
  const filtered = dedupeLevels(levels).filter(predicate || (() => true));
  if (filtered.length === 0) return null;
  return [...filtered].sort(sortFn || ((a, b) => a - b))[0];
}

function formatStrategyPrice(value) {
  const n = asNumber(value);
  return n != null ? `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '—';
}

function sortScenariosByProbability(pair) {
  const order = ['bull', 'bear', 'neutral'];
  return order
    .map(key => ({ key, ...(pair.scenarios?.[key] || {}) }))
    .sort((left, right) => {
      const leftProb = asNumber(left.prob) ?? -Infinity;
      const rightProb = asNumber(right.prob) ?? -Infinity;
      if (rightProb !== leftProb) return rightProb - leftProb;
      return order.indexOf(left.key) - order.indexOf(right.key);
    });
}

function collectStrategyLevels(pair) {
  const price = asNumber(pair.price);
  const levels4H = pair.levels?.['4H'] || {};
  const ict4H = pair.ict?.['4H'] || {};
  const ew4H = pair.ew?.['4H'] || {};
  const support = dedupeLevels([...(levels4H.ssl || []), ...(levels4H.swing_lows || [])]);
  const resistance = dedupeLevels([...(levels4H.bsl || []), ...(levels4H.swing_highs || [])]);
  const poi = asNumber(ict4H.poi_level);
  const poiAsBullCandidate = poi != null && price != null ? poi <= price * 1.01 : poi != null;
  const poiAsBearCandidate = poi != null && price != null ? poi > price : poi != null;
  const longEntries = dedupeLevels([...support, ...(poiAsBullCandidate ? [poi] : [])]);
  const shortEntries = dedupeLevels([...resistance, ...(poiAsBearCandidate ? [poi] : [])]);
  const longTargets = dedupeLevels([...resistance.filter(value => price == null || value > price), ew4H.target]);
  const shortTargets = dedupeLevels([...support.filter(value => price == null || value < price)]);
  const longStops = dedupeLevels([...support, ...(poi != null ? [poi] : [])]);
  const shortStops = dedupeLevels([...resistance, ...(poi != null ? [poi] : [])]);
  return { price, support, resistance, longEntries, shortEntries, longTargets, shortTargets, longStops, shortStops };
}

function buildStrategyRecommendation(pair, rankedScenario, variant) {
  const { price, support, resistance, longEntries, shortEntries, longTargets, shortTargets, longStops, shortStops } = collectStrategyLevels(pair);
  const scenarioKey = rankedScenario?.key || 'neutral';
  const prob = asNumber(rankedScenario?.prob) ?? 0;
  const confluence = Array.isArray(pair.confluence) ? pair.confluence.slice(0, 2).join(' + ') : '';
  const label = variant || 'Primary';
  const nearestSupport = pickNearest(support, value => price == null || value < price, (a, b) => Math.abs(a - price) - Math.abs(b - price));
  const nearestResistance = pickNearest(resistance, value => price == null || value > price, (a, b) => Math.abs(a - price) - Math.abs(b - price));
  const nearResistance = price != null && nearestResistance != null ? Math.abs(nearestResistance - price) / price <= 0.01 : false;
  const nearSupportBreakdown = price != null && nearestSupport != null ? Math.abs(price - nearestSupport) / price <= 0.01 : false;

  if (scenarioKey === 'neutral') {
    return { label, scenarioKey, prob, action: 'Wait', entry: null, tp: null, sl: null, rationale: `${rankedScenario?.title || 'Neutral bias'} keeps the setup in wait mode.` };
  }

  if (scenarioKey === 'bull') {
    const entry = pickNearest(longEntries, value => price == null || value <= price * 1.02, (a, b) => price == null ? a - b : Math.abs(a - price) - Math.abs(b - price));
    const tp = pickNearest(longTargets, value => price == null || value > price, (a, b) => a - b);
    const sl = entry != null ? pickNearest(longStops, value => value < entry, (a, b) => b - a) : null;
    if (entry == null || tp == null || sl == null) return { label, scenarioKey, prob, action: 'Wait', entry: null, tp: null, sl: null, rationale: 'Bullish direction exists, but structured levels are incomplete.' };
    return { label, scenarioKey, prob, action: nearResistance ? 'Breakout Long' : 'Pullback Long', entry, tp, sl, rationale: `Bull ${prob}% + ${pair.biasLabel || pair.bias || 'neutral'} bias${confluence ? ` + ${confluence}` : ''}.` };
  }

  const entry = pickNearest(shortEntries, value => price == null || value >= price * 0.98, (a, b) => price == null ? a - b : Math.abs(a - price) - Math.abs(b - price));
  const tp = pickNearest(shortTargets, value => price == null || value < price, (a, b) => b - a);
  const sl = entry != null ? pickNearest(shortStops, value => value > entry, (a, b) => a - b) : null;
  if (entry == null || tp == null || sl == null) return { label, scenarioKey: 'bear', prob, action: 'Wait', entry: null, tp: null, sl: null, rationale: 'Bearish direction exists, but structured levels are incomplete.' };
  return { label, scenarioKey: 'bear', prob, action: nearSupportBreakdown ? 'Breakdown Short' : 'Rejection Short', entry, tp, sl, rationale: `Bear ${prob}% + ${pair.biasLabel || pair.bias || 'neutral'} bias${confluence ? ` + ${confluence}` : ''}.` };
}

// ─── STRATEGY COMPONENTS ─────────────────────────────────────────────────────

function StrategyKVRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', fontSize: '11px' }}>
      <span style={{ color: C.dim }}>{label}</span>
      <span style={{ color: C.text, fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function strategyTone(strategy) {
  if (strategy.action.includes('Long')) return { color: C.bull, bg: '#4ade8010', border: '#4ade8030' };
  if (strategy.action.includes('Short')) return { color: C.bear, bg: '#f8717110', border: '#f8717130' };
  return { color: C.neutral, bg: '#fbbf2410', border: '#fbbf2430' };
}

function StrategyBlock({ title, strategy, muted }) {
  const tone = strategyTone(strategy);
  return (
    <div style={{ background: muted ? C.bg : tone.bg, border: `1px solid ${muted ? C.border : tone.border}`, borderRadius: '8px', padding: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '10px' }}>
        <span style={{ color: muted ? C.sub : tone.color, fontSize: '11px', fontWeight: 700 }}>{title}</span>
        <span style={{ color: muted ? C.sub : tone.color, fontSize: '11px', fontWeight: 700 }}>{strategy.prob}%</span>
      </div>
      <StrategyKVRow label="Action" value={strategy.action} />
      <StrategyKVRow label="Entry" value={formatStrategyPrice(strategy.entry)} />
      <StrategyKVRow label="TP" value={formatStrategyPrice(strategy.tp)} />
      <StrategyKVRow label="SL" value={formatStrategyPrice(strategy.sl)} />
      <div style={{ marginTop: '10px', fontSize: '11px', color: C.sub, lineHeight: '1.5' }}>{strategy.rationale}</div>
    </div>
  );
}

function OverviewStrategyCard({ pair }) {
  const ranked = sortScenariosByProbability(pair);
  const primary = buildStrategyRecommendation(pair, ranked[0], 'Primary');
  const alternate = buildStrategyRecommendation(pair, ranked[1], 'Alternate');
  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 800, color: C.text }}>{pair.short}</div>
          <div style={{ fontSize: '11px', color: C.sub }}>${pair.price.toLocaleString()}</div>
        </div>
        <Badge color={biasColor(pair.bias)}>{pair.biasLabel}</Badge>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
        <StrategyBlock title="Primary" strategy={primary} />
        <StrategyBlock title="Alternate" strategy={alternate} muted />
      </div>
    </Card>
  );
}

function OverviewStrategyGrid({ pairs, isMobile }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{ fontSize: '12px', color: C.sub, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>Overview Strategy</div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '12px' }}>
        {pairs.map(pair => <OverviewStrategyCard key={pair.symbol} pair={pair} />)}
      </div>
    </div>
  );
}
```

**OverviewTab 렌더링 위치 (모바일/데스크탑 모두):**
```jsx
// 페어 카드 그리드/캐러셀 바로 다음, MarketOverview 바로 전
<OverviewStrategyGrid pairs={pairs} isMobile={isMobile} />
<MarketOverview pairs={pairs} isMobile={isMobile} />
```

---

## 7. 그리드 분기 한 줄 패턴

```jsx
// Overview RSI/Key Levels
gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr'

// Orderflow 4-card
gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)'

// Scenarios 3-col
gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)'

// Risk pair cards
gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)'

// Liquidation heatmap
gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)'

// 분석/Risk selected-pair detail view
gridTemplateColumns: 'repeat(2, 1fr)'  // 분석 카드 내부 2열(EW + ICT) 전용, separate EW/ICT tabs 금지

// 롱/숏 셋업 내부 (항상 유지)
gridTemplateColumns: '1fr 1fr'
```

---

## 8. Orderflow 테이블 wrapper

```jsx
<div style={{ overflowX: 'auto' }}>
  <table style={{ width: '100%', minWidth: isMobile ? '480px' : 'auto', borderCollapse: 'collapse' }}>
    ...
  </table>
</div>
```

---

## 9. Footer (모바일 column)

```jsx
<div style={{
  display: 'flex',
  flexDirection: isMobile ? 'column' : 'row',
  justifyContent: 'space-between',
  gap: isMobile ? '6px' : '0',
  alignItems: isMobile ? 'flex-start' : 'center',
  fontSize: '11px', color: '#374151'
}}>
  <span>데이터 기준: ...</span>
  <span>투자 참고용 ...</span>
</div>
```

---

## 10. index.html 쉘 — 모바일 nav

```html
<style>
  #frame {
    position: fixed; top: 49px; left: 0; bottom: 0;
    width: 100vw; height: calc(100dvh - 49px); border: none; background: #0b0e14;
  }
  @media (max-width: 600px) {
    .logo { display: none; }
    .nav-btn { padding: 10px 14px; font-size: 14px; }
    #date-select { min-width: 130px; }
    .open-btn-text { display: none; }
    .open-btn-icon { display: inline; }
  }
  @media (min-width: 601px) {
    .open-btn-icon { display: none; }
  }
</style>

<!-- 새 탭 버튼: -->
<button class="nav-btn" onclick="openCurrent()" style="color:#4ade80;border-color:#4ade80">
  <span class="open-btn-text">새 탭으로 열기</span>
  <span class="open-btn-icon">↗</span>
</button>
```
