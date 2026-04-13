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

## 5. VRVP 미니 토글 (모바일)

```jsx
const [vrvpTf, setVrvpTf] = React.useState('1D');
const vrvpTfs = ['1D', '4H', '1H'];

{isMobile ? (
  <div>
    <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
      {vrvpTfs.map(tf => (
        <button key={tf} onClick={() => setVrvpTf(tf)} style={{
          padding: '6px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '13px',
          background: vrvpTf === tf ? '#3b82f6' : '#1a1f2e',
          color: vrvpTf === tf ? '#fff' : '#9ca3af'
        }}>{tf}</button>
      ))}
    </div>
    {/* vrvpTf에 해당하는 단일 VRVP 카드만 표시 */}
  </div>
) : (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
    {/* 3개 동시 표시 */}
  </div>
)}
```

---

## 6. EW / ICT / Risk — Accordion (모바일)

```jsx
function EWTab({ pairs, selectedPair, isMobile }) {
  const [expanded, setExpanded] = React.useState(selectedPair);
  const toggle = sym => setExpanded(prev => prev === sym ? null : sym);

  if (!isMobile) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
        {pairs.map(p => <Card key={p.symbol}>...</Card>)}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {pairs.map(p => {
        const isOpen = expanded === p.symbol;
        return (
          <div key={p.symbol} style={{ background: '#1a1f2e', borderRadius: '8px', overflow: 'hidden' }}>
            <div onClick={() => toggle(p.symbol)} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '14px 16px', cursor: 'pointer'
            }}>
              <span style={{ fontSize: '15px', fontWeight: 700, color: '#e8eaed' }}>{p.short}</span>
              <span style={{ color: '#6b7280', fontSize: '16px' }}>{isOpen ? '▲' : '▼'}</span>
            </div>
            {isOpen && (
              <div style={{ padding: '0 16px 16px' }}>
                {/* 카드 본문 */}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
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

// EW/ICT pair cards (desktop)
gridTemplateColumns: 'repeat(2, 1fr)'  // accordion으로 대체, 이건 desktop-only

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
