# Dashboard Redesign (TypeUI Clean — Light Theme) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dark theme of `reports/20260418_dashboard.html` with TypeUI Clean light theme (white surfaces, Poppins+Roboto+Inconsolata, blue primary #3B82F6, underline-only tab active state) while preserving all existing data contracts and tab behavior.

**Architecture:** All visual state flows through the `C` token object and shared primitives (`Badge`, `Card`, `SectionTitle`, `TFPill`, `PairSelector`). Replacing the token object + primitives handles ~80% of the visual change. The remaining 20% is shell-level overrides (header gradient, tab bar active state) and scattered dark-only inline shadow/gradient expressions that must be neutralized.

**Tech Stack:** Standalone HTML, React 18 UMD, Babel Standalone, inline styles only, Google Fonts CDN

---

### Task 1: Replace Font Imports, Body Styles, and C Token Object

**Files:**
- Modify: `reports/20260418_dashboard.html:10-25` (head/style block)
- Modify: `reports/20260418_dashboard.html:348-364` (C token object)

- [ ] **Step 1: Replace font imports and style block**

Replace lines 10–25 with:

```html
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&family=Roboto:wght@400;500&family=Inconsolata:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #f5f7fa;
      color: #111827;
      font-family: 'Roboto', sans-serif;
    }
    ::-webkit-scrollbar { width: 4px; height: 4px; }
    ::-webkit-scrollbar-track { background: #f0f0f0; }
    ::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 999px; }
    ::-webkit-scrollbar-corner { background: #f0f0f0; }
    @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
  </style>
```

- [ ] **Step 2: Replace C token object**

Replace the entire `const C = { ... };` block (lines 348–364) with:

```js
    const C = {
      bg:           '#f5f7fa',
      surface:      '#ffffff',
      panel:        '#f9fafb',
      card:         '#ffffff',
      cardAlt:      '#f3f4f6',
      elevated:     '#f3f4f6',
      border:       '#e5e7eb',
      borderStrong: '#d1d5db',
      text:         '#111827',
      sub:          '#6b7280',
      dim:          '#9ca3af',
      primary:      '#3B82F6',
      primaryAlt:   '#2563eb',
      primaryBg:    '#eff6ff',
      primaryBorder:'#bfdbfe',
      bull:         '#16a34a',
      bear:         '#dc2626',
      neutral:      '#d97706',
      heatHigh:     '#b45309',
      cvdPos:       '#0891b2',
      cvdNeg:       '#ea580c',
      convergence:  '#7c3aed',
    };
```

- [ ] **Step 3: Verify token and font change**

Run:
```bash
node -e "const fs=require('fs'); const h=fs.readFileSync('reports/20260418_dashboard.html','utf8'); if(!h.includes('Poppins')) throw new Error('missing Poppins'); if(!h.includes('#f5f7fa')) throw new Error('missing bg token'); if(!h.includes('#3B82F6')) throw new Error('missing primary token'); console.log('task1-ok');"
```
Expected: `task1-ok`

- [ ] **Step 4: Commit**

```bash
git add reports/20260418_dashboard.html
git commit -m "feat: replace dark tokens and fonts with TypeUI Clean light theme"
```

---

### Task 2: Update Shared Primitives

**Files:**
- Modify: `reports/20260418_dashboard.html:379-475` (Badge, Card, SectionTitle, TFPill, PairSelector)

- [ ] **Step 1: Replace Badge**

Replace the `function Badge(...)` block (lines 379–396) with:

```js
    function Badge({ color, children, small }) {
      return (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: small ? '2px 8px' : '4px 10px',
          borderRadius: '999px',
          fontSize: small ? '10px' : '11px',
          fontWeight: 600,
          background: color + '18',
          color,
          border: '1px solid ' + color + '35',
          whiteSpace: 'nowrap',
          fontFamily: "'Inconsolata', monospace",
        }}>{children}</span>
      );
    }
```

- [ ] **Step 2: Replace Card**

Replace the `function Card(...)` block (lines 398–411) with:

```js
    function Card({ children, style }) {
      return (
        <div style={{
          background: C.card,
          borderRadius: '10px',
          padding: '16px',
          border: '1px solid ' + C.border,
          ...style,
        }}>
          {children}
        </div>
      );
    }
```

- [ ] **Step 3: Replace SectionTitle**

Replace the `function SectionTitle(...)` block (lines 413–424) with:

```js
    function SectionTitle({ children }) {
      return (
        <div style={{
          fontSize: '10px',
          fontFamily: "'Roboto', sans-serif",
          fontWeight: 500,
          color: C.dim,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          marginBottom: '10px',
        }}>
          {children}
        </div>
      );
    }
```

- [ ] **Step 4: Replace TFPill**

Replace the `function TFPill(...)` block (lines 437–452) with:

```js
    function TFPill({ active, onClick, children }) {
      return (
        <button onClick={onClick} style={{
          padding: '5px 12px',
          borderRadius: '999px',
          fontSize: '11px',
          fontWeight: 600,
          fontFamily: "'Inconsolata', monospace",
          cursor: 'pointer',
          border: '1px solid ' + (active ? C.primary : C.border),
          background: active ? C.primary : C.surface,
          color: active ? '#ffffff' : C.sub,
          transition: 'background 0.15s, border-color 0.15s, color 0.15s',
        }}>{children}</button>
      );
    }
```

- [ ] **Step 5: Replace PairSelector**

Replace the `function PairSelector(...)` block (lines 454–475) with:

```js
    function PairSelector({ pairs, selected, onSelect }) {
      return (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
          {pairs.map(p => {
            const active = selected === p.symbol;
            return (
              <button key={p.symbol} onClick={() => onSelect(p.symbol)} style={{
                padding: '7px 14px',
                borderRadius: '8px',
                border: '1px solid ' + (active ? biasColor(p.bias) : C.border),
                background: active ? biasColor(p.bias) + '18' : C.surface,
                color: active ? C.text : C.sub,
                fontSize: '12px',
                fontWeight: 700,
                fontFamily: "'Poppins', sans-serif",
                cursor: 'pointer',
                transition: 'background 0.15s, border-color 0.15s',
              }}>{p.short}</button>
            );
          })}
        </div>
      );
    }
```

- [ ] **Step 6: Verify primitives**

Run:
```bash
node -e "const fs=require('fs'); const h=fs.readFileSync('reports/20260418_dashboard.html','utf8'); if(!h.includes(\"fontFamily: \\\"'Inconsolata'\")) throw new Error('missing Inconsolata in Badge'); if(!h.includes('background: C.card')) throw new Error('Card not flat'); console.log('task2-ok');"
```
Expected: `task2-ok`

- [ ] **Step 7: Commit**

```bash
git add reports/20260418_dashboard.html
git commit -m "feat: update shared primitives for Clean light theme"
```

---

### Task 3: Rebuild Dashboard Shell (Header + Tab Bar + Footer + Body bg)

**Files:**
- Modify: `reports/20260418_dashboard.html:1238-1315` (Dashboard render)

- [ ] **Step 1: Replace Dashboard outer wrapper and header**

In `Dashboard()`, find the return block starting at line 1238. Replace the outer `<div>` and header `<div>` as follows.

Find this block (line 1239–1265):
```jsx
        <div style={{ minHeight: '100vh', background: C.bg }}>
          <div style={{
            background: 'linear-gradient(180deg, rgba(16,21,34,0.98) 0%, rgba(16,21,34,0.92) 100%)',
            borderBottom: '1px solid ' + C.borderStrong,
            padding: headerPadding,
          }}>
            {isMobile ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: C.text, letterSpacing: '-0.3px', fontFamily: "'IBM Plex Sans', sans-serif" }}>Crypto Futures Analysis</div>
                  <div style={{ fontSize: '11px', color: C.dim, marginTop: '2px' }}>2026-04-18 · EW + ICT/SMC + Orderflow</div>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {PAIRS.map(p => <Badge key={p.symbol} color={biasColor(p.bias)} small>{p.short}: {p.biasLabel}</Badge>)}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '22px', fontWeight: 700, color: C.text, letterSpacing: '-0.5px', fontFamily: "'IBM Plex Sans', sans-serif" }}>Crypto Futures Analysis</div>
                  <div style={{ fontSize: '12px', color: C.dim, marginTop: '3px', fontFamily: "'IBM Plex Mono', monospace" }}>2026-04-18 · EW + ICT/SMC + Orderflow · BTC $77,054 / ETH $2,421 / SOL $88.9 / HYPE $44.5</div>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {PAIRS.map(p => <Badge key={p.symbol} color={biasColor(p.bias)}>{p.short}: {p.biasLabel}</Badge>)}
                </div>
              </div>
            )}
          </div>
```

Replace with:
```jsx
        <div style={{ minHeight: '100vh', background: C.bg }}>
          <div style={{
            background: C.surface,
            borderBottom: '1px solid ' + C.border,
            padding: headerPadding,
          }}>
            {isMobile ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: C.text, letterSpacing: '-0.02em', fontFamily: "'Poppins', sans-serif" }}>Crypto Futures Analysis</div>
                  <div style={{ fontSize: '11px', color: C.dim, marginTop: '2px', fontFamily: "'Inconsolata', monospace" }}>2026-04-18 · EW + ICT/SMC + Orderflow</div>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {PAIRS.map(p => <Badge key={p.symbol} color={biasColor(p.bias)} small>{p.short}: {p.biasLabel}</Badge>)}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '22px', fontWeight: 700, color: C.text, letterSpacing: '-0.02em', fontFamily: "'Poppins', sans-serif" }}>Crypto Futures Analysis</div>
                  <div style={{ fontSize: '12px', color: C.dim, marginTop: '3px', fontFamily: "'Inconsolata', monospace" }}>2026-04-18 · EW + ICT/SMC + Orderflow · BTC $77,054 / ETH $2,421 / SOL $88.9 / HYPE $44.5</div>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {PAIRS.map(p => <Badge key={p.symbol} color={biasColor(p.bias)}>{p.short}: {p.biasLabel}</Badge>)}
                </div>
              </div>
            )}
          </div>
```

- [ ] **Step 2: Replace tab bar with underline-active style**

Find the tab bar block (lines 1268–1298):
```jsx
          <div ref={tabBarRef} style={{
            background: C.panel,
            borderBottom: '1px solid ' + C.border,
            display: 'flex',
            gap: '4px',
            overflowX: 'auto',
            padding: isMobile ? '8px 12px' : '8px 24px',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}>
            {TABS.map(tab => (
              <button
                key={tab}
                data-active={activeTab === tab ? 'true' : 'false'}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: isMobile ? '10px 14px' : '9px 16px',
                  background: activeTab === tab ? C.cardAlt : 'transparent',
                  border: '1px solid ' + (activeTab === tab ? C.borderStrong : 'transparent'),
                  borderRadius: '999px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: activeTab === tab ? 700 : 500,
                  color: activeTab === tab ? C.text : C.sub,
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  transition: 'background 0.15s, border-color 0.15s, color 0.15s',
                }}
              >{tab}</button>
            ))}
          </div>
```

Replace with:
```jsx
          <div ref={tabBarRef} style={{
            background: C.surface,
            borderBottom: '1px solid ' + C.border,
            display: 'flex',
            gap: '0px',
            overflowX: 'auto',
            padding: isMobile ? '0 12px' : '0 24px',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}>
            {TABS.map(tab => (
              <button
                key={tab}
                data-active={activeTab === tab ? 'true' : 'false'}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: isMobile ? '14px 14px' : '12px 16px',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: '2px solid ' + (activeTab === tab ? C.primary : 'transparent'),
                  marginBottom: '-1px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: activeTab === tab ? 600 : 400,
                  fontFamily: "'Poppins', sans-serif",
                  color: activeTab === tab ? C.primary : C.sub,
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  transition: 'color 0.15s, border-color 0.15s',
                }}
              >{tab}</button>
            ))}
          </div>
```

- [ ] **Step 3: Verify shell**

Run:
```bash
node -e "const fs=require('fs'); const h=fs.readFileSync('reports/20260418_dashboard.html','utf8'); if(h.includes('rgba(16,21,34')) throw new Error('dark header gradient still present'); if(!h.includes(\"background: C.surface\")) throw new Error('header not white'); if(!h.includes(\"borderBottom: '2px solid \")) throw new Error('underline tab not found'); console.log('task3-ok');"
```
Expected: `task3-ok`

- [ ] **Step 4: Commit**

```bash
git add reports/20260418_dashboard.html
git commit -m "feat: rebuild dashboard shell with Clean light header and tab bar"
```

---

### Task 4: Remove Dark-Only Inline Decorations

These are hardcoded dark-theme patterns that exist outside the C token system and will look wrong on a white surface.

**Files:**
- Modify: `reports/20260418_dashboard.html` (lines 728, 967, 1143)

- [ ] **Step 1: Fix Macro event card (line 728)**

Find:
```js
background: `linear-gradient(180deg, ${C.card} 0%, ${C.cardAlt} 100%)`, borderRadius: '12px', padding: '14px 16px', border: '1px solid ' + C.border, borderLeft: '4px solid ' + borderColor(ev.importance), boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)'
```

Replace with:
```js
background: C.card, borderRadius: '10px', padding: '14px 16px', border: '1px solid ' + C.border, borderLeft: '3px solid ' + borderColor(ev.importance)
```

- [ ] **Step 2: Fix AnalysisCard outer panel (line 967)**

Find:
```js
background: `linear-gradient(180deg, ${C.panel} 0%, ${C.card} 100%)`, borderRadius: '14px', padding: isMobile ? '14px' : '18px', border: '1px solid ' + C.borderStrong, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)'
```

Replace with:
```js
background: C.surface, borderRadius: '10px', padding: isMobile ? '14px' : '18px', border: '1px solid ' + C.border
```

- [ ] **Step 3: Fix Scenarios cards (line 1143)**

Find:
```js
background: `linear-gradient(180deg, ${C.card} 0%, ${C.cardAlt} 100%)`, borderRadius: '12px', padding: '14px', border: '1px solid ' + c + '40', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)'
```

Replace with:
```js
background: C.card, borderRadius: '10px', padding: '14px', border: '1px solid ' + C.border, borderTop: '3px solid ' + c
```

- [ ] **Step 4: Verify no dark-only decorations remain**

Run:
```bash
node -e "const fs=require('fs'); const h=fs.readFileSync('reports/20260418_dashboard.html','utf8'); const dark=['rgba(255,255,255,0.03)','rgba(255,255,255,0.04)','IBM Plex','#050816','#0b0e14','rgba(16,21,34']; dark.forEach(p=>{ if(h.includes(p)) throw new Error('dark pattern still present: '+p); }); console.log('task4-ok');"
```
Expected: `task4-ok`

- [ ] **Step 5: Commit**

```bash
git add reports/20260418_dashboard.html
git commit -m "feat: remove dark-only inline decorations from tab surfaces"
```

---

### Task 5: Verify and Record Lessons

**Files:**
- Verify: `reports/20260418_dashboard.html`
- Modify: `docs/todo.md`
- Modify: `docs/lessons.md`

- [ ] **Step 1: Print the file URL for browser verification**

Run:
```bash
node -e "const path=require('path'); console.log('file://' + path.resolve('reports/20260418_dashboard.html'))"
```
Expected: a `file://` path — open it in Chrome, verify all 6 tabs render, test pair selector in 분석 tab, check 393px mobile width in DevTools.

- [ ] **Step 2: Run regression script**

Run:
```bash
node scripts/verify-unified-analysis-dashboard.js
```
Expected: PASS with no unified-analysis regressions.

- [ ] **Step 3: Update docs/todo.md redesign entry**

Append under the `## Review` section of the `2026-04-18 Dashboard Redesign` entry:

```md
## Review

- Applied TypeUI Clean light theme: white surfaces, Poppins/Roboto/Inconsolata, #3B82F6 primary, underline tab active state.
- Token swap + primitive updates handled 80% of the change; dark-only inset shadows and gradients required manual neutralization.
- All tab contracts, data rendering, and mobile layout preserved.
```

- [ ] **Step 4: Append lesson to docs/lessons.md**

```md
- Dark-theme dashboards generated from templates carry hardcoded dark-only patterns (inset white shadows, dark gradients) that live outside the token object. When retheming, always grep for `rgba(255,255,255,0.0` and `linear-gradient.*C.card` after token swap.
```

- [ ] **Step 5: Final commit**

```bash
git add reports/20260418_dashboard.html docs/todo.md docs/lessons.md
git commit -m "feat: complete TypeUI Clean light theme redesign for trading dashboard"
```
