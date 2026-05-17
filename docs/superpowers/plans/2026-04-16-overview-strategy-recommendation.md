# Overview Strategy Recommendation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an auto-computed strategy recommendation grid to the `Overview` tab so each pair shows `Primary` and `Alternate` plans with action, entry, TP, SL, and rationale derived from existing analysis data.

**Architecture:** Keep `PAIRS` unchanged and compute overview strategies at render time from `scenarios`, `support/resistance`, `bsl/ssl`, and `ew/ict[4H]` fields. Add small helper functions for scenario ranking and level selection, then render a new `OverviewStrategyGrid` between the pair cards and `MarketOverview`.

**Tech Stack:** Standalone HTML, React 18 via CDN, Babel inline JSX, inline style objects, Playwright/manual browser verification

---

## File Map

| File | Change Type | Responsibility |
|------|-------------|----------------|
| `reports/20260416_dashboard.html` | Modify | Add strategy derivation helpers and Overview strategy UI components |
| `docs/todo.md` | Modify | Track plan/review status for this feature |
| `docs/lessons.md` | Modify | Record implementation lesson after completion |

---

## Task 1: Track the feature in project task docs

**Files:**
- Modify: `docs/todo.md`

- [ ] **Step 1: Add a new task section for the feature**

Append a new section to `docs/todo.md`:

```md
# 2026-04-16 Overview Strategy Recommendation

## Plan

- [ ] Add reusable helpers that rank scenarios and derive entry/TP/SL levels from existing pair data.
- [ ] Render a strategy recommendation grid in `Overview` with Primary and Alternate blocks for all pairs.
- [ ] Verify desktop/mobile rendering and confirm Wait fallback paths do not throw runtime errors.
- [ ] Capture review notes and lessons learned.

## Review

- Pending.
```

- [ ] **Step 2: Verify the task doc was updated**

Run:

```bash
sed -n '1,220p' docs/todo.md
```

Expected: the new `# 2026-04-16 Overview Strategy Recommendation` section is present.

- [ ] **Step 3: Commit the planning doc update**

```bash
git add docs/todo.md docs/superpowers/plans/2026-04-16-overview-strategy-recommendation.md
git commit -m "docs: add overview strategy recommendation plan"
```

---

## Task 2: Add pure strategy derivation helpers

**Files:**
- Modify: `reports/20260416_dashboard.html` (insert before `OverviewTab`)

- [ ] **Step 1: Write a failing verification script for strategy derivation**

Create a temporary Node-based verification script to assert that all pairs produce two strategy objects with stable keys:

```javascript
const fs = require('fs');

const html = fs.readFileSync('reports/20260416_dashboard.html', 'utf8');

if (!html.includes('function buildStrategyRecommendation')) {
  throw new Error('missing strategy derivation helper');
}
```

Run:

```bash
node -e "const fs=require('fs');const html=fs.readFileSync('reports/20260416_dashboard.html','utf8');if(!html.includes('function buildStrategyRecommendation')){throw new Error('missing strategy derivation helper')}"
```

Expected: FAIL with `missing strategy derivation helper`.

- [ ] **Step 2: Add numeric helper functions**

Insert helpers near the existing formatting helpers:

```javascript
function asNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function dedupeLevels(levels) {
  return [...new Set(levels.filter(value => typeof value === 'number' && Number.isFinite(value)))];
}

function pickNearest(levels, predicate, sortFn) {
  const filtered = dedupeLevels(levels).filter(predicate);
  if (filtered.length === 0) return null;
  return [...filtered].sort(sortFn)[0];
}

function formatStrategyPrice(value) {
  return value != null ? `$${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '—';
}
```

- [ ] **Step 3: Add scenario ranking and level collection helpers**

Insert helpers that convert `p.scenarios` into a sorted array and gather long/short candidate levels from existing fields:

```javascript
function sortScenariosByProbability(pair) {
  return [
    { key: 'bull', ...pair.scenarios.bull },
    { key: 'bear', ...pair.scenarios.bear },
    { key: 'neutral', ...pair.scenarios.neutral }
  ].sort((left, right) => right.prob - left.prob);
}

function collectStrategyLevels(pair) {
  const price = pair.price;
  const ict4h = pair.ict?.['4H'] || {};
  const ew4h = pair.ew?.['4H'] || {};
  const support = dedupeLevels(pair.support || []);
  const resistance = dedupeLevels(pair.resistance || []);
  const bsl = dedupeLevels(pair.bsl || []);
  const ssl = dedupeLevels(pair.ssl || []);
  const poi = asNumber(ict4h.poi_level);
  const target = asNumber(ew4h.target);

  return {
    price,
    longEntries: dedupeLevels([...support, ...ssl, poi != null && poi <= price * 1.01 ? poi : null]),
    longTargets: dedupeLevels([...resistance.filter(value => value > price), target]),
    shortEntries: dedupeLevels([...resistance, ...bsl, poi != null && poi >= price * 0.99 ? poi : null]),
    shortTargets: dedupeLevels([...support.filter(value => value < price), ...ssl]),
    bullStops: dedupeLevels([...support, ...ssl, poi]),
    bearStops: dedupeLevels([...resistance, ...bsl, poi])
  };
}
```

- [ ] **Step 4: Add the recommendation builder**

Add a pure helper that returns `action`, `entry`, `tp`, `sl`, `rationale`, `scenarioKey`, and `prob`:

```javascript
function buildStrategyRecommendation(pair, rankedScenario, variant) {
  const { price, longEntries, longTargets, shortEntries, shortTargets, bullStops, bearStops } = collectStrategyLevels(pair);
  const scenarioKey = rankedScenario?.key || 'neutral';
  const prob = rankedScenario?.prob ?? 0;
  const tags = (pair.confluence || []).slice(0, 2).join(' + ');

  if (scenarioKey === 'neutral') {
    return {
      label: variant,
      scenarioKey,
      prob,
      action: 'Wait',
      entry: null,
      tp: null,
      sl: null,
      rationale: `${rankedScenario?.title || 'Neutral bias'} keeps the setup in wait mode.`
    };
  }

  if (scenarioKey === 'bull') {
    const entry = pickNearest(longEntries, value => value <= price * 1.02, (a, b) => Math.abs(a - price) - Math.abs(b - price));
    const tp = pickNearest(longTargets, value => value > price, (a, b) => a - b);
    const sl = entry != null
      ? pickNearest(bullStops, value => value < entry, (a, b) => b - a)
      : null;
    if (entry == null || tp == null || sl == null) {
      return { label: variant, scenarioKey, prob, action: 'Wait', entry: null, tp: null, sl: null, rationale: 'Bullish direction exists, but structured levels are incomplete.' };
    }
    return {
      label: variant,
      scenarioKey,
      prob,
      action: Math.abs(tp - price) / price < 0.02 ? 'Breakout Long' : 'Pullback Long',
      entry,
      tp,
      sl,
      rationale: `Bull ${prob}% + ${pair.biasLabel} bias${tags ? ` + ${tags}` : ''}.`
    };
  }

  const entry = pickNearest(shortEntries, value => value >= price * 0.98, (a, b) => Math.abs(a - price) - Math.abs(b - price));
  const tp = pickNearest(shortTargets, value => value < price, (a, b) => b - a);
  const sl = entry != null
    ? pickNearest(bearStops, value => value > entry, (a, b) => a - b)
    : null;
  if (entry == null || tp == null || sl == null) {
    return { label: variant, scenarioKey: 'bear', prob, action: 'Wait', entry: null, tp: null, sl: null, rationale: 'Bearish direction exists, but structured levels are incomplete.' };
  }
  return {
    label: variant,
    scenarioKey: 'bear',
    prob,
    action: Math.abs(price - tp) / price < 0.02 ? 'Breakdown Short' : 'Rejection Short',
    entry,
    tp,
    sl,
    rationale: `Bear ${prob}% + ${pair.biasLabel} bias${tags ? ` + ${tags}` : ''}.`
  };
}
```

- [ ] **Step 5: Re-run the helper existence check**

Run:

```bash
node -e "const fs=require('fs');const html=fs.readFileSync('reports/20260416_dashboard.html','utf8');if(!html.includes('function buildStrategyRecommendation')){throw new Error('missing strategy derivation helper')}"
```

Expected: PASS with no output.

- [ ] **Step 6: Commit helper implementation**

```bash
git add reports/20260416_dashboard.html
git commit -m "feat: add overview strategy derivation helpers"
```

---

## Task 3: Render the Overview strategy components

**Files:**
- Modify: `reports/20260416_dashboard.html` (insert near Overview components)

- [ ] **Step 1: Add a failing render check for the strategy section**

Run:

```bash
node -e "const fs=require('fs');const html=fs.readFileSync('reports/20260416_dashboard.html','utf8');if(!html.includes('Overview Strategy')){throw new Error('missing overview strategy section')}"
```

Expected: FAIL with `missing overview strategy section`.

- [ ] **Step 2: Add `StrategyKVRow`, `StrategyBlock`, `OverviewStrategyCard`, and `OverviewStrategyGrid`**

Insert new components before `OverviewTab`:

```javascript
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

- [ ] **Step 3: Mount the strategy grid inside `OverviewTab`**

Update both mobile and desktop branches in `OverviewTab`:

```javascript
<OverviewStrategyGrid pairs={pairs} isMobile={isMobile} />
```

Insert it between the pair-card section and `<MarketOverview pairs={pairs} isMobile={isMobile} />`.

- [ ] **Step 4: Re-run the render check**

Run:

```bash
node -e "const fs=require('fs');const html=fs.readFileSync('reports/20260416_dashboard.html','utf8');if(!html.includes('Overview Strategy')){throw new Error('missing overview strategy section')}"
```

Expected: PASS with no output.

- [ ] **Step 5: Commit the Overview UI**

```bash
git add reports/20260416_dashboard.html
git commit -m "feat: render overview strategy recommendation cards"
```

---

## Task 4: Verify browser behavior on desktop and mobile

**Files:**
- Verify: `reports/20260416_dashboard.html`

- [ ] **Step 1: Start a local static server**

Run:

```bash
python3 -m http.server 4173
```

Expected: `Serving HTTP on ... port 4173 ...`

- [ ] **Step 2: Verify desktop rendering**

Open `http://127.0.0.1:4173/reports/20260416_dashboard.html` and confirm:

```text
- Overview tab loads by default
- Four pair cards render
- Four strategy cards render
- Each strategy card shows Primary and Alternate blocks
- Entry / TP / SL rows render with either prices or —
```

- [ ] **Step 3: Verify mobile rendering**

Resize to `393x852` and confirm:

```text
- Pair card carousel still scrolls
- Strategy cards collapse to one column
- No text overflow breaks the card layout
```

- [ ] **Step 4: Verify runtime console state**

Run browser console inspection and confirm:

```text
- No uncaught exceptions
- No React runtime warnings tied to new components
```

- [ ] **Step 5: Stop the local server**

Terminate the `python3 -m http.server 4173` process.

- [ ] **Step 6: Commit verification-safe cleanup if needed**

If no source files changed during verification, no commit is required. If any verification support files were created, remove them and commit only if tracked files changed.

---

## Task 5: Update project records after verification

**Files:**
- Modify: `docs/todo.md`
- Modify: `docs/lessons.md`

- [ ] **Step 1: Mark the new todo section complete and replace review placeholder**

Update the section in `docs/todo.md` to:

```md
# 2026-04-16 Overview Strategy Recommendation

## Plan

- [x] Add reusable helpers that rank scenarios and derive entry/TP/SL levels from existing pair data.
- [x] Render a strategy recommendation grid in `Overview` with Primary and Alternate blocks for all pairs.
- [x] Verify desktop/mobile rendering and confirm Wait fallback paths do not throw runtime errors.
- [x] Capture review notes and lessons learned.

## Review

- Added overview-only strategy derivation helpers that convert scenario probabilities and existing price levels into actionable Primary/Alternate plans without changing the `PAIRS` schema.
- Inserted a responsive strategy grid between the pair summary cards and market EMA overview so each pair now exposes action, entry, TP, SL, and rationale at a glance.
- Verified the dashboard in desktop and mobile layouts with no runtime errors and confirmed fallback `Wait` rendering remains stable when numeric inputs are unavailable.
```

- [ ] **Step 2: Append a lessons entry**

Add this line to `docs/lessons.md`:

```md
- For this standalone dashboard, derive new overview summaries from existing structured analysis fields instead of introducing duplicate strategy data into `PAIRS`; this keeps analyst-authored inputs single-sourced.
```

- [ ] **Step 3: Verify final diff**

Run:

```bash
git diff -- reports/20260416_dashboard.html docs/todo.md docs/lessons.md
```

Expected: diff shows only the Overview strategy feature and documentation updates.

- [ ] **Step 4: Commit project record updates**

```bash
git add docs/todo.md docs/lessons.md
git commit -m "docs: record overview strategy recommendation completion"
```

---

## Self-Review

- Spec coverage:
  - strategy derivation rules -> Task 2
  - Overview placement/layout -> Task 3
  - Wait fallback and browser verification -> Task 4
  - task/lesson documentation -> Task 1 and Task 5
- Placeholder scan: no `TODO`/`TBD` placeholders remain in executable steps.
- Type consistency:
  - helper output consistently uses `action`, `entry`, `tp`, `sl`, `rationale`, `prob`
  - rendering components only consume these keys
