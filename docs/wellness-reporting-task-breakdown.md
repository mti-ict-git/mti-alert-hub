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

- `[x]` Add a backend-side normalization helper that converts raw wellness reminder events into reporting outcomes.
- `[x]` Implement compatibility handling for `actionKind = Close` plus `eventType = Completed` as `AmbiguousCloseCompletion`.
- `[x]` Define server-side formulas for:
  - `displayRate`
  - `engagementRate`
  - `completionRate`
  - `completionRateAfterStart`
  - `deferRate`
  - `dismissRate`
  - `timeoutRate`
  - `startAbandonmentRate`
- `[x]` Confirm that `Read` is counted as engagement, not completion.

### Workstream A2: Backend Read Models

- `[x]` Add a `Program Summary` wellness reporting read model.
- `[x]` Add a `Program x Device Outcome` read model.
- `[x]` Add a `Program Event Timeline` read model with normalized outcome fields.
- `[x]` Include these fields where applicable:
  - `actionKey`
  - `actionKind`
  - `actionLabel`
  - `occurrenceUtc`
  - `snoozedUntilUtc`
  - `activeUserIdentifier`
  - `normalizedOutcome`
  - `ambiguousCloseCount`
- `[x]` Preserve device-centric reporting as the primary monitoring grain.

### Workstream A3: Backend API Contract

- `[x]` Add a dedicated wellness reporting endpoint family or extend the existing reminder activity endpoint with reporting payloads.
- `[x]` Expose:
  - program summary metrics
  - device outcome rows
  - outcome funnel counts
  - action breakdown counts
  - timeline rows
- `[x]` Document the chosen contract in `docs/openapi.yaml`.
- `[x]` Ensure the API clearly labels ambiguous close-derived results instead of folding them into clean completion.

### Workstream A4: Frontend Program Detail

- `[x]` Add an `Outcome Funnel` section to wellness detail.
- `[x]` Add an `Action Breakdown` section to wellness detail.
- `[x]` Extend `Recipients` so operators can see:
  - `Last Event`
  - `Last Terminal Outcome`
  - `Next Run`
  - `Schedule State`
- `[x]` Extend `Wellness Activity` with outcome-focused wording rather than raw event counts only.
- `[x]` Label ambiguous close outcomes explicitly in the UI.

### Workstream A5: Frontend Global Reports

- `[x]` Add a dedicated `Wellness` section or page under `Reports`.
- `[x]` Add a program performance table with:
  - family
  - cadence
  - target size
  - displayed
  - completed
  - deferred
  - dismissed
  - timed out
  - completion rate
- `[x]` Add at least one trend visualization:
  - defer versus complete over time
  - or hourly effectiveness by displayed versus completed
- `[x]` Add filters for:
  - family
  - status
  - site
  - area
  - date range

### Workstream A6: Export Baseline

- `[x]` Add `Program Summary CSV` export.
- `[x]` Add `Program x Device Outcome CSV` export.
- `[x]` Add `Program Event Timeline CSV` export.
- `[x]` Include normalized outcome fields in exported data, not only raw event types.

### Workstream A7: Documentation

- `[x]` Sync `docs/functional-specification.md` if endpoint shape or UI scope changes.
- `[x]` Sync `docs/wellness-reporting-reference.md` if implementation choices refine the metric semantics.
- `[x]` Sync `docs/implementation-roadmap.md` with completed reporting milestones and verification evidence.

### Challenge / Verification

- `[x]` Backend typecheck passes.
- `[x]` Frontend build passes.
- `[x]` Reporting endpoint returns expected output for:
  - `Completed`
  - `Deferred`
  - `Dismissed`
  - `TimedOut`
  - `AmbiguousCloseCompletion`
- `[x]` UI review confirms an operator can distinguish:
  - shown but untouched
  - deferred
  - dismissed
  - completed
- `[x]` CSV export contains the same normalized outcome semantics shown in the UI.

### Phase A Verification Evidence

- `2026-09-04`: `npm run test:wellness-reporting` covers normalized `Completed`, `Deferred`, `Dismissed`, `TimedOut`, and `AmbiguousCloseCompletion` outcomes, confirms `Read` contributes to engagement rather than completion, preserves site and area context, and exercises `CommunicationDraftService.getCommunicationWellnessReporting()` through a database stub.
- `2026-09-04`: `npm run backend:typecheck`, `npm run backend:build`, `npm run build`, and targeted ESLint checks passed for the reporting implementation.
- `2026-09-04`: browser review against a deterministic local API fixture confirmed the global Wellness report table, family/status/site/area/date filters, complete-versus-defer trend, and explicit ambiguous-close labeling. A read-only real-database smoke also connected successfully, loaded four wellness programs, and verified both rollup and program-detail reporting shapes.
- `2026-09-04`: CSV tests confirm escaping and stable filenames, while the summary, device-outcome, and event-timeline exporters consume the same normalized reporting read models used by the UI.

## Phase B: Agent Contract Cleanup

### Objective

Make terminal wellness outcome semantics reliable enough for clean effectiveness reporting.

### Important Note

This phase **does require Windows Agent changes** and therefore **will require rebuild/package work**.

### Workstream B1: Event Contract Clarification

- `[x]` Decide final semantics for CTA or close-driven outcomes:
  - `window close button`
  - `Close` action kind
  - `GotIt`
  - `Done`
  - `RemindMeLater`
- `[x]` Resolve `OQ-16` explicitly before implementation finishes.

### Workstream B2: Agent Event Emission Changes

- `[x]` Update the agent event mapping so passive or close-only exits no longer report as `Completed`.
- `[x]` Reserve `Completed` for explicit completion confirmation only.
- `[x]` Ensure close-button dismissal and CTA-driven dismissal produce a stable dismissal outcome.
- `[x]` Add explicit `terminalOutcome` metadata to terminal wellness CTA event reporting.

### Workstream B3: Backend And UI Cleanup

- `[x]` Restrict `AmbiguousCloseCompletion` fallback handling to historical `Completed + Close` payloads while new agents emit `Dismissed`.
- `[x]` Update reporting normalization to trust coherent explicit `terminalOutcome` metadata from the new agent contract.
- `[x]` Keep the ambiguity label only for historical evidence; new close-only evidence appears as `Dismissed` without requiring a separate UI bucket.

### Challenge / Verification

- `[x]` Agent build passes.
- `[x]` Agent tests cover:
  - close button dismissal
  - `GotIt`
  - `Done`
  - `RemindMeLater`
  - stretching `Start` / `Next`
- `[ ]` Real-device verification proves close-only exit is no longer counted as confirmed completion.

### Phase B Implementation Evidence

- `2026-09-04`: product approved the final `OQ-16` mapping: `GotIt` and `Done` are `Completed`, `RemindMeLater` is deferred, `Start` and `Next` are progress evidence, and both a window close and `Close` CTA are `Dismissed`; no `Skipped` bucket was added.
- `2026-09-04`: `ReminderEventService` now emits `Close` as `Dismissed` and adds coherent `terminalOutcome` metadata for terminal CTA actions. Backend normalization trusts matching explicit terminal metadata while preserving `AmbiguousCloseCompletion` for historical `Completed + Close` payloads.
- `2026-09-04`: `dotnet build .\MTI.Alert.Agent\MTI.Alert.Agent.csproj -c Release --no-restore` passed with zero warnings and zero errors; the full agent test suite passed all 34 tests, including focused coverage for close button, `Close`, `GotIt`, `Done`, `RemindMeLater`, `Start`, and `Next` paths. `npm run test:wellness-reporting` passed all 7 tests, and backend typecheck plus targeted ESLint passed.
- `2026-09-04`: a signed production-profile `1.0.12` candidate MSI was built without upload or rollout. The package targets `https://mtialert.merdekabattery.com/`, has SHA-256 `1B1BF0CE7EF73D485F34AEAEC3B6B7DEDAA76932B6959D56C43F517B8F8C2B79`, product code `{81D176D9-9B8C-4629-B392-BDE785C00CDC}`, and a valid Authenticode signature. Phase B remains open only for explicit real-device rollout verification.

## Phase C: Advanced Analytics

### Objective

Expand OHIH reporting from operational visibility into effectiveness analytics.

### Workstream C1: Comparative Analytics

- `[x]` Add family comparison:
  - `20-20-20 Rule`
  - `Office Stretching`
- `[x]` Add cadence comparison.
- `[x]` Add distribution mode comparison:
  - `Synchronized`
  - `Staggered`
- `[x]` Add site and area comparisons.

### Workstream C2: Time Pattern Analytics

- `[x]` Add hourly performance trend.
- `[x]` Add daily or weekly trend views.
- `[x]` Identify high defer-rate versus high completion-rate windows.

### Workstream C3: Guided Routine Depth

- `[x]` Add step-depth analytics for stretching:
  - started
  - step advanced
  - completed
  - start abandonment
- `[x]` Decide whether partial completion should become its own visible KPI.

### Workstream C4: Optional Audit Rollups

- `[ ]` Add active-user audit rollups only after confirming the organization is comfortable with the visibility boundary.
- `[x]` Keep device-centric aggregation as the default primary view.

### Phase C Implementation Evidence

- `2026-09-04`: the reporting read model now exposes normalized occurrence rows with device-local date and hour, site and area context, final outcome, start evidence, and step-advance depth. Program rollups also expose `variantKeys` and the latest persisted `distributionMode`, enabling family, cadence, distribution, site, and area comparisons without querying operational tables from the browser.
- `2026-09-04`: `Reports > Wellness Program Outcomes` now includes program and location comparison tables, hourly completion/defer analysis, daily and Monday-based weekly trend views, strongest observed completion/defer windows, and guided-routine depth. Every chart retains a semantic table alternative and site/area filters scope analytics at the occurrence grain.
- `2026-09-04`: partial completion is not introduced as a success KPI. The UI reports `Started, not completed` as start abandonment and keeps `Step advanced events` as progress evidence because the current event contract does not prove completed steps against the routine's total step count.
- `2026-09-04`: verification passed with backend typecheck, production frontend build, targeted ESLint, and all 12 wellness-reporting tests. A live read-only PostgreSQL smoke returned 4 programs across both families and both distribution modes with 53 normalized occurrences; no active-user rollup was exposed. Authenticated browser QA against the same local backend verified family and distribution comparisons, daily and weekly tables, an open keyboard-capable Radix Select popup, the no-defer edge case, and a 390 px viewport with page-level horizontal overflow eliminated while dense tables retain their own scroll regions. The strict premium UI audit reported 33 repository-wide findings; the Phase C controls use the documented Radix Select owner and the existing documented platform-owned date inputs, but the static scanner still treats the authored JSX `Select` name as a native element.

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
