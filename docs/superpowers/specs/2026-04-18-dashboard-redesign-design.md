# Trading Dashboard Redesign Design

## Goal

Apply a stronger, more intentional visual system to the standalone trading dashboard so the UI feels closer to a cloud analytics product while preserving the existing tab contract, data contract, and mobile usability.

## Scope

- Target file: `reports/20260418_dashboard.html`
- Target surface: the standalone dashboard shell and all tab-level presentation components
- Preserve the existing tab order:
  - `Overview`
  - `Macro`
  - `분석`
  - `Orderflow`
  - `Scenarios`
  - `Risk`
- Preserve the existing embedded-data pattern:
  - `const PAIRS = [...]`
  - `const MACRO_EVENTS = [...]`
  - `const ORDERFLOW_DATA = {...}`
- Keep the dashboard as a standalone React/Babel HTML file

## Current Context

The dashboard already has a functional dark theme and improved information architecture from the unified `분석` tab work, but its current visual system still reads as utilitarian rather than intentional.

Current issues in `reports/20260418_dashboard.html`:

- the page still uses a generic system font stack
- color use is functional but not sufficiently tiered for summary vs detail surfaces
- cards, pills, tab buttons, and headers use similar box language, which flattens hierarchy
- the header does not establish a strong control-tower feel for the dashboard
- analysis, scenario, and risk surfaces do not visually distinguish priority levels strongly enough
- mobile patterns are serviceable but not yet visually cohesive with the desktop shell

## Design Direction

### Primary Reference

Use the TypeUI `Dashboard` direction as the primary reference:

- dark product-grade shell
- modular grid system
- strong data hierarchy
- restrained depth
- semantic token usage

This is the best fit for a trading dashboard because the project is already a dark, data-dense, long-session analytical interface rather than a marketing page or document-first product.

### Secondary Influence

Use the TypeUI `Perspective` direction only as a secondary influence:

- slightly stronger surface depth
- more intentional heading contrast
- better foreground/background separation

Do not adopt `Perspective` as the primary color model because its single-accent green system conflicts with this project's semantic `bull / bear / neutral` color language.

### Rejected Primary Directions

- `Paper`: too light and whitespace-driven for this dashboard's use case
- `Perspective` as a full system: over-constrains accent usage
- novelty-first skills like `Neobrutalism` or `Artistic`: too expressive for repeated analytical use

## Requirements

### 1. Preserve Analytical Semantics

The redesign must keep semantic trading signals intact:

- bullish = `C.bull`
- bearish = `C.bear`
- neutral / caution = `C.neutral`
- orderflow / supporting analytical accents remain distinct

No redesign may collapse these into a single brand accent.

### 2. Strengthen Hierarchy

The redesign must make these layers visually distinct:

- app shell
- tab navigation
- summary cards
- sectional sub-panels
- inline status elements
- tertiary metadata

The user should be able to scan the page in this order:

1. page identity
2. active tab
3. selected pair or selected timeframe
4. high-priority signal cards
5. supporting detail

### 3. Keep Density Readable

The redesign must improve aesthetics without turning the dashboard into a sparse layout.

Required behavior:

- desktop remains comfortable for four-pair scanning
- mobile remains usable without introducing tiny touch targets
- existing tables and compact data panels stay legible
- text-heavy analytical content remains secondary to summary surfaces

### 4. Maintain Existing Architecture

Out of scope:

- moving the dashboard to a bundled build system
- changing the dashboard to CSS modules or Tailwind
- altering the tab contract
- changing analysis generation rules in `run-analysis.md`
- introducing remote assets that would make the dashboard fail offline except standard font loading

## Visual System Design

### Typography

Replace the generic system stack with a more intentional engineering-grade family:

- primary/display: `IBM Plex Sans`
- monospace/data: `IBM Plex Mono`

Rationale:

- fits the TypeUI `Dashboard` tone
- improves data density readability
- gives the page an analytical voice without looking generic

Typography hierarchy:

- page title: 18px mobile / 22px desktop, 700
- tab labels: 12-13px, 600-700
- card titles: 13-15px, 700
- section labels: 10-11px uppercase, 700, increased letter spacing
- value emphasis: 12-16px, 600-700
- metadata: 10-11px, 400-500

### Color Tokens

Expand the current token object into shell, surface, and accent layers:

```js
const C = {
  shell: '#050816',
  bg: '#0b0e14',
  panel: '#101522',
  card: '#171d2b',
  cardAlt: '#1c2333',
  elevated: '#20293b',
  border: '#2a3347',
  borderStrong: '#3a4762',
  text: '#ecf1f7',
  sub: '#9aa4b2',
  dim: '#667085',
  primary: '#0C5CAB',
  primaryAlt: '#0A4A8A',
  bull: '#4ade80',
  bear: '#f87171',
  neutral: '#fbbf24',
  heatHigh: '#f59e0b',
  cvdPos: '#22d3ee',
  cvdNeg: '#fb923c',
  convergence: '#a78bfa',
};
```

Rules:

- use semantic tokens instead of scattering raw hex values
- reserve stronger contrast for active or selected surfaces
- use gradients sparingly on shell and high-level panels only

### Spacing and Radius

Normalize spacing and corner rules:

- shell gutters: `12px` mobile / `24px` desktop
- card padding: `14px` mobile / `16px` desktop
- section gap: `12px` mobile / `16px` desktop
- outer radius: `14px`
- card radius: `12px`
- inner panel radius: `8px`
- pills and badges: `999px` only when they represent state chips, not all controls

### Depth

Adopt restrained product-style depth:

- shell background uses a subtle gradient rather than a flat color
- top header and active cards get low-opacity highlight overlays
- cards differentiate by elevation and stroke, not by heavy shadows
- avoid glassmorphism blur-heavy treatment

## Component Changes

### Header Shell

Redesign the header into a stronger control-bar:

- title block on the left
- compact market snapshot line below or beside title
- pair bias badges grouped as a live status rail
- stronger separation from the content area

The header should feel like a persistent control surface, not just a banner.

### Tab Bar

Redesign the tab bar so the active state reads immediately:

- inactive tabs sit on the shared shell surface
- active tab gets stronger fill, border, and text emphasis
- mobile keeps horizontal scrolling
- tab controls should visually align with the new token system instead of plain underline-only state

### Cards

Update `Card`, `Badge`, `TFPill`, and pair selectors into a consistent family:

- cards gain clearer stroke and surface differentiation
- badges become smaller signal chips, not mini-cards
- timeframe pills and pair selectors adopt a distinct control language
- section titles should be visually tied to the card they govern

### Overview

Improve scanability of summary cards and strategy cards:

- stronger split between headline stats and supporting metrics
- cleaner grouping of RSI / EMA / OI information
- strategy blocks use clearer primary vs alternate hierarchy

### Macro

Keep the timeline structure but improve event priority visibility:

- stronger left-border and card contrast
- clearer metadata row for time / region / category
- improved spacing between summary and impact tags

### 분석

This tab should become the visual centerpiece:

- selected pair controls and TF pills should feel intentional and high-signal
- `TFAlignmentBar` should read as a synchronized status strip
- `EWWaveStep` and `ICTGrid` should feel like related modules on the same plane
- confluence tags should read as signal badges, not generic chips

### Orderflow / Scenarios / Risk

These tabs need stronger visual priority handling:

- orderflow summary cards should read as compact monitoring panels
- scenario cards should show probability and direction more aggressively
- risk cards should distinguish execution-critical values from explanation text

## Motion and Interaction

Motion should stay minimal and purposeful:

- subtle active-state transitions on tabs and pills
- no decorative animation loops
- mobile scroll behavior remains unchanged
- reduced-motion support is preferred if simple to add with CSS media queries

## Error Handling and Compatibility

The redesign must not break:

- null-safe rendering paths
- existing `selectedPair` / `activeTab` state handling
- `tabContent` variable routing
- mobile horizontal tab scrolling
- standalone HTML execution in Chromium

## Verification

Verification must include:

- dashboard renders with no runtime errors
- all tabs still switch correctly
- pair selection still works in `분석`
- timeframe selection still works
- mobile layout still renders without overlap or unreadable controls
- no regression in existing strategy, macro, or risk blocks

## Phased Rollout

### Phase 1: Foundation

- add font loading
- expand tokens
- normalize shell, spacing, and control primitives

### Phase 2: Structure

- rebuild header
- rebuild tab bar
- update card and section hierarchy across tabs

### Phase 3: Accent

- add restrained gradient treatment
- tune emphasis states for analysis, scenarios, and risk sections
- refine mobile polish

## Out of Scope

- redesigning `reports/index.html`
- changing report generation pipeline behavior
- changing the data schema
- adding chart libraries or external UI frameworks
