# Overview Strategy Recommendation Design

## Goal

Add an auto-computed strategy recommendation surface to the `Overview` tab so each pair shows a primary and alternate trade plan with `entry`, `TP`, and `SL` derived from existing analysis data.

## Scope

- Target file: `reports/20260416_dashboard.html`
- Target tab: `Overview`
- Strategy output must be computed from existing `PAIRS` fields only
- No new analyst-authored strategy fields will be added to `PAIRS`

## Current Context

The current `Overview` tab renders:

- pair summary cards
- a market-wide EMA alignment card

The dashboard already contains richer analysis inputs in other sections:

- `bias` / `biasLabel`
- `confluence[]`
- `ew[TF]`
- `ict[TF]`
- `support[]` / `resistance[]`
- `bsl[]` / `ssl[]`
- `scenarios.bull` / `scenarios.bear` / `scenarios.neutral`

This means the dashboard already has enough directional and level data to synthesize a lightweight execution plan without introducing a second source of truth.

## Requirements

### Strategy Presentation

Each pair in `Overview` should show:

- `Primary` strategy
- `Alternate` strategy

Each strategy block should include:

- action label
- suggested entry
- TP
- SL
- short rationale

### Computation Rules

Direction selection should follow existing scenario probabilities:

- `Primary` = highest probability scenario
- `Alternate` = second highest probability scenario

Price levels should come from existing numeric analysis fields:

- long entries prefer nearest support / ICT POI below or near price
- long TP prefers nearest resistance above price or EW target if available
- long SL prefers nearest invalidation-level proxy below entry
- short entries prefer nearest resistance / liquidity above or near price
- short TP prefers nearest support or SSL below price
- short SL prefers nearest invalidation-level proxy above entry

### Neutral Handling

The system must not force a trade setup when market structure is unclear.

If the top-ranked scenario is neutral, or if required price levels are missing, the strategy should degrade to:

- `Action: Wait`
- unavailable numeric fields displayed as `—`

### Data Safety

- No inferred analyst-only numbers
- No fabricated levels
- Missing input data must remain missing in UI
- Existing `PAIRS` schema remains unchanged

## Recommended Approach

Use a hybrid derivation model:

1. Use `scenarios` probabilities to determine directional priority.
2. Use existing levels plus EW/ICT reference values to derive numeric execution levels.
3. Fall back to `Wait` when the scenario direction is neutral or level quality is insufficient.

This preserves analyst intent from the manually-authored scenarios while keeping the strategy numbers anchored to the existing structured data.

## Strategy Derivation Design

### 1. Normalize Scenario Ranking

Create a helper that converts `bull`, `bear`, and `neutral` into a sorted list by probability.

Output shape:

```js
[
  { key: 'bull', prob: 45, title: '...', trigger: '...', target: '...', invalid: '...' },
  { key: 'neutral', prob: 35, title: '...', trigger: '...', target: '...', invalid: '...' },
  { key: 'bear', prob: 20, title: '...', trigger: '...', target: '...', invalid: '...' }
]
```

### 2. Collect Candidate Levels

Create level collectors from the existing pair fields:

- bullish candidates:
  - `support[]`
  - `ict[4H].poi_level`
  - lower-side values from `ssl[]`
- bearish candidates:
  - `resistance[]`
  - upper-side values from `bsl[]`
  - `ict[4H].poi_level` when above price
- target candidates:
  - bullish: resistance above price, `ew[4H].target`
  - bearish: support below price, `ssl[]`
- stop candidates:
  - bullish: nearest level below entry not used as entry
  - bearish: nearest level above entry not used as entry

The default decision timeframe for strategy calculation should be `4H`, because the dashboard already uses `4H` as the default analysis focus and it provides a reasonable trade horizon for overview recommendations.

### 3. Build Action Labels

Map ranked scenarios into concise strategy actions:

- `bull`:
  - if current price is near resistance -> `Breakout Long`
  - otherwise -> `Pullback Long`
- `bear`:
  - if current price is near support breakdown area -> `Breakdown Short`
  - otherwise -> `Rejection Short`
- `neutral`:
  - `Wait`

### 4. Build Rationale Text

The rationale should be a single short line using already-available evidence:

- top scenario probability
- pair bias
- first one or two `confluence` tags
- optional EW/ICT structure summary

Example pattern:

`Bull 45% + bullish bias + EMA/ICT confluence, using nearest support as entry.`

### 5. Fallback Rules

Return `Wait` when any of these are true:

- top scenario is `neutral`
- no valid entry level exists for the scenario direction
- no valid stop level exists
- TP cannot be derived from existing structured levels

In fallback mode:

- `action = Wait`
- `entry = null`
- `tp = null`
- `sl = null`
- rationale explains the missing clarity

## UI Design

### Placement

Insert a new strategy section inside `OverviewTab`, below the pair cards and above or below `MarketOverview`.

Recommended order:

1. pair cards
2. strategy recommendation grid
3. market EMA overview

This keeps the execution-oriented content close to the top while preserving the market structure summary.

### Layout

- desktop: `repeat(2, 1fr)` strategy card grid for 4 pairs
- mobile: `1fr`

Each pair strategy card should contain:

- pair name and bias badge
- current price
- `Primary` block
- `Alternate` block

Each strategy block should contain compact key-value rows:

- `Action`
- `Entry`
- `TP`
- `SL`
- rationale text

Primary should use stronger visual emphasis than Alternate.

### Visual Direction

Use existing dashboard colors:

- bullish: `C.bull`
- bearish: `C.bear`
- neutral/wait: `C.neutral`
- alternate block can use dimmer panel styling than primary

Do not introduce a new visual system. Reuse `Card`, `Badge`, `Divider`, and the current dashboard tokens.

## Components and Helpers

Add focused helpers near the Overview components:

- `sortScenariosByProbability(pair)`
- `pickNearestLevel(levels, comparator)`
- `buildStrategyRecommendation(pair, scenarioKey)`
- `formatStrategyPrice(value)`
- `StrategyKVRow`
- `StrategyBlock`
- `OverviewStrategyCard`
- `OverviewStrategyGrid`

These helpers should keep calculation logic out of rendering loops and avoid inflating `OverviewTab`.

## Error Handling

- Filter non-numeric levels before computation
- Guard against empty arrays
- Guard against missing `ict[4H]` or `ew[4H]`
- Never call numeric formatting on nullish values

## Testing and Verification

Verification should cover:

- desktop rendering
- mobile rendering
- no runtime console errors
- all 4 pairs show `Primary` and `Alternate`
- `Wait` state renders without broken formatting
- missing data paths still render `—` rather than throwing

Manual verification target file:

- `reports/20260416_dashboard.html`

## Out of Scope

- editing source analysis values
- changing scenario probabilities
- adding persistence or user interaction for strategy overrides
- creating new backend or JSON sources
