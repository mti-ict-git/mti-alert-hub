# Wellness Reporting Task Breakdown

## Document Status

- Version: `0.1`
- Status: `Execution Baseline`
- Last Updated: `2026-09-04`
- Audience: `Product Owner`, `Backend Engineers`, `Frontend Engineers`, `Windows Agent Engineers`, `Operations`

## Purpose

This document breaks `docs/wellness-reporting-reference.md` into implementable work items so the next OHIH reporting slice can be delivered in controlled phases.

## Source Documents

- `docs/wellness-reporting-reference.md`
- `docs/functional-specification.md`
- `docs/ohih-program-module-blueprint.md`
- `docs/open-questions-and-challenges.md`
- `docs/implementation-roadmap.md`

## Delivery Strategy

The reporting work should be delivered in phases so we can unlock useful outcome visibility immediately without blocking on a Windows Agent rebuild.

### Phase A

Backend plus frontend only.

Goal:

- deliver practical wellness outcome reporting from the current event model
- treat close-versus-complete ambiguity explicitly instead of hiding it

### Phase B

Agent contract cleanup.

Goal:

- remove close/completion ambiguity
- make terminal outcome semantics trustworthy enough for long-term KPI reporting

### Phase C

Advanced analytics and exports.

Goal:

- expand from per-program operational reporting into decision-support analytics

## Phase A: Reporting Baseline Without Agent Rebuild

### Objective

Ship the first outcome-oriented OHIH reporting slice using the current reminder-event contract.

### Scope

- no Windows Agent rebuild
- no change to local reminder execution behavior
- no change to current publish or sync contract

### Workstream A1: Metric Semantics Layer

- `[ ]` Add a backend-side normalization helper that converts raw wellness reminder events into reporting outcomes.
- `[ ]` Implement compatibility handling for `actionKind = Close` plus `eventType = Completed` as `AmbiguousCloseCompletion`.
- `[ ]` Define server-side formulas for:
  - `displayRate`
  - `engagementRate`
  - `completionRate`
  - `completionRateAfterStart`
  - `deferRate`
  - `dismissRate`
  - `timeoutRate`
  - `startAbandonmentRate`
- `[ ]` Confirm that `Read` is counted as engagement, not completion.

### Workstream A2: Backend Read Models

- `[ ]` Add a `Program Summary` wellness reporting read model.
- `[ ]` Add a `Program x Device Outcome` read model.
- `[ ]` Add a `Program Event Timeline` read model with normalized outcome fields.
- `[ ]` Include these fields where applicable:
  - `actionKey`
  - `actionKind`
  - `actionLabel`
  - `occurrenceUtc`
  - `snoozedUntilUtc`
  - `activeUserIdentifier`
  - `normalizedOutcome`
  - `ambiguousCloseCount`
- `[ ]` Preserve device-centric reporting as the primary monitoring grain.

### Workstream A3: Backend API Contract

- `[ ]` Add a dedicated wellness reporting endpoint family or extend the existing reminder activity endpoint with reporting payloads.
- `[ ]` Expose:
  - program summary metrics
  - device outcome rows
  - outcome funnel counts
  - action breakdown counts
  - timeline rows
- `[ ]` Document the chosen contract in `docs/openapi.yaml`.
- `[ ]` Ensure the API clearly labels ambiguous close-derived results instead of folding them into clean completion.

### Workstream A4: Frontend Program Detail

- `[ ]` Add an `Outcome Funnel` section to wellness detail.
- `[ ]` Add an `Action Breakdown` section to wellness detail.
- `[ ]` Extend `Recipients` so operators can see:
  - `Last Event`
  - `Last Terminal Outcome`
  - `Next Run`
  - `Schedule State`
- `[ ]` Extend `Wellness Activity` with outcome-focused wording rather than raw event counts only.
- `[ ]` Label ambiguous close outcomes explicitly in the UI.

### Workstream A5: Frontend Global Reports

- `[ ]` Add a dedicated `Wellness` section or page under `Reports`.
- `[ ]` Add a program performance table with:
  - family
  - cadence
  - target size
  - displayed
  - completed
  - deferred
  - dismissed
  - timed out
  - completion rate
- `[ ]` Add at least one trend visualization:
  - defer versus complete over time
  - or hourly effectiveness by displayed versus completed
- `[ ]` Add filters for:
  - family
  - status
  - site
  - area
  - date range

### Workstream A6: Export Baseline

- `[ ]` Add `Program Summary CSV` export.
- `[ ]` Add `Program x Device Outcome CSV` export.
- `[ ]` Add `Program Event Timeline CSV` export.
- `[ ]` Include normalized outcome fields in exported data, not only raw event types.

### Workstream A7: Documentation

- `[ ]` Sync `docs/functional-specification.md` if endpoint shape or UI scope changes.
- `[ ]` Sync `docs/wellness-reporting-reference.md` if implementation choices refine the metric semantics.
- `[ ]` Sync `docs/implementation-roadmap.md` with completed reporting milestones and verification evidence.

### Challenge / Verification

- `[ ]` Backend typecheck passes.
- `[ ]` Frontend build passes.
- `[ ]` Reporting endpoint returns expected output for:
  - `Completed`
  - `Deferred`
  - `Dismissed`
  - `TimedOut`
  - `AmbiguousCloseCompletion`
- `[ ]` UI review confirms an operator can distinguish:
  - shown but untouched
  - deferred
  - dismissed
  - completed
- `[ ]` CSV export contains the same normalized outcome semantics shown in the UI.

## Phase B: Agent Contract Cleanup

### Objective

Make terminal wellness outcome semantics reliable enough for clean effectiveness reporting.

### Important Note

This phase **does require Windows Agent changes** and therefore **will require rebuild/package work**.

### Workstream B1: Event Contract Clarification

- `[ ]` Decide final semantics for CTA or close-driven outcomes:
  - `window close button`
  - `Close` action kind
  - `GotIt`
  - `Done`
  - `RemindMeLater`
- `[ ]` Resolve `OQ-16` explicitly before implementation finishes.

### Workstream B2: Agent Event Emission Changes

- `[ ]` Update the agent event mapping so passive or close-only exits no longer report as `Completed`.
- `[ ]` Reserve `Completed` for explicit completion confirmation only.
- `[ ]` Ensure close-button dismissal and CTA-driven dismissal produce a stable dismissal outcome.
- `[ ]` Optionally add explicit `terminalOutcome` metadata to reminder event reporting.

### Workstream B3: Backend And UI Cleanup

- `[ ]` Remove `AmbiguousCloseCompletion` fallback handling once new agent payloads are proven.
- `[ ]` Backfill the reporting normalization rules to trust the new agent outcome semantics.
- `[ ]` Update UI copy to remove temporary ambiguity labels if no longer needed.

### Challenge / Verification

- `[ ]` Agent build passes.
- `[ ]` Agent tests cover:
  - close button dismissal
  - `GotIt`
  - `Done`
  - `RemindMeLater`
  - stretching `Start` / `Next`
- `[ ]` Real-device verification proves close-only exit is no longer counted as confirmed completion.

## Phase C: Advanced Analytics

### Objective

Expand OHIH reporting from operational visibility into effectiveness analytics.

### Workstream C1: Comparative Analytics

- `[ ]` Add family comparison:
  - `20-20-20 Rule`
  - `Office Stretching`
- `[ ]` Add cadence comparison.
- `[ ]` Add distribution mode comparison:
  - `Synchronized`
  - `Staggered`
- `[ ]` Add site and area comparisons.

### Workstream C2: Time Pattern Analytics

- `[ ]` Add hourly performance trend.
- `[ ]` Add daily or weekly trend views.
- `[ ]` Identify high defer-rate versus high completion-rate windows.

### Workstream C3: Guided Routine Depth

- `[ ]` Add step-depth analytics for stretching:
  - started
  - step advanced
  - completed
  - start abandonment
- `[ ]` Decide whether partial completion should become its own visible KPI.

### Workstream C4: Optional Audit Rollups

- `[ ]` Add active-user audit rollups only after confirming the organization is comfortable with the visibility boundary.
- `[ ]` Keep device-centric aggregation as the default primary view.

## Suggested Delivery Order

1. `A1` Metric semantics layer
2. `A2` Backend read models
3. `A3` API contract
4. `A4` Program detail UI
5. `A5` Global reports UI
6. `A6` Export baseline
7. `A7` Documentation sync
8. `B1-B3` Agent contract cleanup
9. `C1-C4` Advanced analytics

## Parallelization Guidance

These tasks can be worked in parallel after the metric semantics are frozen:

- Backend engineer:
  - `A2`
  - `A3`
  - `A6`
- Frontend engineer:
  - `A4`
  - `A5`
- Product / architecture review:
  - `B1`
  - open-question closure for `Close` vs `Completed`

## Definition Of Done

This reporting expansion is done only when:

- the first outcome-oriented wellness reporting slice is available without database access
- operators can distinguish completion, defer, dismiss, timeout, and ambiguous close behavior
- docs are synchronized with the delivered reporting semantics
- any agent-semantic ambiguity is either labeled explicitly in the product or resolved through a verified agent contract update
