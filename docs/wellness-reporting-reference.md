# Wellness Reporting Reference

## Document Status

- Version: `0.1`
- Status: `Draft Baseline`
- Last Updated: `2026-09-04`
- Audience: `Product Owner`, `Backend Engineers`, `Frontend Engineers`, `Windows Agent Engineers`, `Operations`

## Purpose

This document defines the reporting contract for `Wellness Programs` (`OHIH`) so future implementation can measure program effectiveness, not only reminder delivery.

The reporting point of view is:

- a wellness owner wants to know whether the program is helping users act
- operations wants to know which devices are active, late, snoozed, or no longer engaging
- engineering needs a stable event-to-metric contract so dashboards, exports, and audits do not drift

## Source Of Truth

This reference builds on:

- `docs/functional-specification.md`
- `docs/ohih-program-module-blueprint.md`
- `docs/wellness-program-execution-checklist.md`
- `docs/implementation-roadmap.md`
- `docs/wellness-reporting-task-breakdown.md`

If a conflict exists:

1. `docs/functional-specification.md`
2. `docs/ohih-program-module-blueprint.md`
3. this document for reporting semantics only

## Problem Statement

Current wellness monitoring already shows whether reminder policies are active and whether core reminder events are arriving. That is useful for operational troubleshooting, but it is not yet enough to answer:

- did users actually act on the program
- did they defer it
- did they dismiss it
- did they start but not finish
- which program family, cadence, or rollout pattern is working better

For wellness, `Displayed` alone is not a success metric.

## Reporting Goals

The reporting layer should answer these product questions:

- how often was a wellness routine actually shown
- how often did a user engage with it
- how often was it completed versus deferred or dismissed
- for stretching, how often did users start but abandon before completion
- which sites, areas, devices, cadence settings, and time windows perform better or worse

## Scope

This reference covers:

- event semantics for wellness outcomes
- derived KPI definitions
- recommended admin reporting surfaces
- recommended read-model and export shape

This reference does not yet define:

- survey-style usefulness ratings
- HR wellness scoring
- person-level wellness outcomes outside optional audit context

## Current Delivered Baseline

Today the system already has:

- per-program monitoring cards for `Triggered`, `Displayed`, `Started`, `Snoozed`, `Completed`, `Timed Out`, `Step Advanced`, and a simple `Compliance` percentage
- per-device policy visibility including `Last Synced`, `Last Activity`, `Latest Event`, `Next Run`, and schedule state
- recent event timeline visibility
- agent-side event capture for:
  - `Triggered`
  - `Displayed`
  - `Read`
  - `Dismissed`
  - `Snoozed`
  - `Started`
  - `StepAdvanced`
  - `Completed`
  - `TimedOut`
- event metadata such as:
  - `occurrenceUtc`
  - `actionKey`
  - `actionKind`
  - `actionLabel`
  - `snoozedUntilUtc`
  - `activeUserIdentifier`

Current gaps:

- no dedicated wellness outcome report in the global `Reports` menu
- no normalized action breakdown for `GotIt`, `Done`, `RemindMeLater`, `Close`, or `Dismissed`
- no explicit conversion funnel from `Displayed` to `Engaged` to `Completed`
- one semantic ambiguity remains in the current agent contract:
  - closing the window through the window close path reports `Dismissed`
  - `AgentWellnessAction.Kind = Close` currently maps to `Completed`

## Reporting Contract

### 1. Grains

Reporting should support these grains:

- `Program Summary`
  - one row per wellness communication
- `Program x Day`
  - daily trend for one wellness communication
- `Program x Device`
  - per-device effectiveness and schedule health
- `Program x Event`
  - audit-level raw timeline
- `Family / Variant Rollup`
  - cross-program comparison for `20-20-20 Rule` versus `Office Stretching`, plus variant-level comparisons where useful

### 2. Dimensions

Recommended dimensions:

- `communicationId`
- `programFamily`
  - `20-20-20 Rule`
  - `Office Stretching`
- `programType`
  - `SimpleReminder`
  - `GuidedRoutine`
- `variantKeys`
- `rotationMode`
- `distributionMode`
- `timezone`
- `recurrenceRule`
- `site`
- `area`
- `deviceId`
- `deviceIdentifier`
- `hostname`
- `activeUserIdentifier` as optional audit dimension only
- `date bucket`
- `hour-of-day bucket`

### 3. Outcome Taxonomy

Each occurrence should eventually be normalized into one primary outcome bucket:

- `Completed`
  - user explicitly confirms the routine
  - examples:
    - `Done`
    - `GotIt`
- `Deferred`
  - user explicitly postpones
  - examples:
    - `RemindMeLater`
    - local snooze
- `Dismissed`
  - user closes or abandons the popup without completion
- `TimedOut`
  - window or routine expires without explicit confirmation
- `InProgress`
  - user started but no terminal outcome is recorded yet
- `NoInteraction`
  - shown but no interaction event is yet available

For `GuidedRoutine`, `Started` and `StepAdvanced` are engagement signals, but not terminal success by themselves.

### 4. Raw Event Semantics

Raw events remain the authoritative low-level evidence.

- `Triggered`
  - the policy occurrence became eligible locally
- `Displayed`
  - the reminder surface was actually rendered
- `Read`
  - user interacted beyond passive display
- `Dismissed`
  - user closed the reminder without a stronger completion signal
- `Snoozed`
  - user deferred using `RemindMeLater`
- `Started`
  - user explicitly started a guided routine
- `StepAdvanced`
  - user advanced inside a guided routine
- `Completed`
  - user explicitly confirmed completion
- `TimedOut`
  - routine timed out without completion

### 5. CTA Mapping Rules

The normalized reporting contract should map CTA actions like this:

- `GotIt` -> `Completed`
- `Done` -> `Completed`
- `RemindMeLater` -> `Deferred`
- `Start` -> `InProgress`
- `Next` -> `InProgress`
- window close button -> `Dismissed`

Temporary compatibility rule for the current runtime:

- if the agent reports `eventType = Completed` with `actionKind = Close`, reporting must treat it as `AmbiguousCloseCompletion` until the agent contract is corrected
- `AmbiguousCloseCompletion` must not be silently merged into confirmed completion KPI

## KPI Definitions

### Core Delivery And Reach

- `Targeted Devices`
  - total eligible device recipients
- `Active Policies`
  - materialized active reminder policies
- `Displayed Count`
  - total `Displayed` events
- `Display Rate`
  - `Displayed Devices / Active Policies`

### Engagement

- `Started Count`
  - total `Started` events
- `Engaged Count`
  - count of occurrences with at least one meaningful action:
    - `Read`
    - `Started`
    - `StepAdvanced`
    - `Completed`
    - `Snoozed`
    - `Dismissed`
- `Engagement Rate`
  - `Engaged Occurrences / Displayed Occurrences`

### Outcome

- `Completion Count`
  - confirmed completion only
- `Completion Rate`
  - `Completed Occurrences / Displayed Occurrences`
- `Completion Rate After Start`
  - `Completed Occurrences / Started Occurrences`
- `Deferred Count`
  - total snoozed or remind-later outcomes
- `Deferred Rate`
  - `Deferred Occurrences / Displayed Occurrences`
- `Dismissed Count`
  - explicit dismissal outcomes
- `Dismiss Rate`
  - `Dismissed Occurrences / Displayed Occurrences`
- `Timed Out Count`
  - total timed out outcomes
- `Timeout Rate`
  - `TimedOut Occurrences / Displayed Occurrences`

### Guided Routine Depth

- `Average Steps Advanced`
  - average `StepAdvanced` count per started occurrence
- `Started But Not Completed`
  - started occurrences with no confirmed completion
- `Start Abandonment Rate`
  - `(Started - Completed) / Started`

### Operational Health

- `Last Synced At`
- `Last Activity At`
- `Next Run`
- `Schedule State`

## Recommended Reporting Surfaces

### A. Wellness Program Detail

Keep this as the first operational view.

Required sections:

- `Outcome Funnel`
  - `Triggered -> Displayed -> Engaged -> Completed`
- `Action Breakdown`
  - `Completed`
  - `Deferred`
  - `Dismissed`
  - `Timed Out`
  - `Ambiguous Close`
- `Recipient Outcomes`
  - per-device `Last Event`
  - `Next Run`
  - `Schedule State`
  - `Last Terminal Outcome`

### B. Global Reports > Wellness

Add a dedicated wellness reporting page or subsection instead of relying on generic content-type rollups only.

Recommended widgets:

- program performance table
- family comparison (`20-20-20` vs `Office Stretching`)
- hourly effectiveness heatmap
- cadence comparison
- site / area comparison
- defer versus complete trend

### C. Export

Recommended export slices:

- `Program Summary CSV`
- `Program x Device CSV`
- `Program Event Timeline CSV`

## Recommended Read Models

### 1. Program Summary Read Model

Recommended fields:

- `communicationId`
- `title`
- `programFamily`
- `programType`
- `variantKeys`
- `rotationMode`
- `distributionMode`
- `targetedDevices`
- `activePolicies`
- `displayedCount`
- `engagedCount`
- `startedCount`
- `completedCount`
- `deferredCount`
- `dismissedCount`
- `timedOutCount`
- `ambiguousCloseCount`
- `displayRate`
- `engagementRate`
- `completionRate`
- `completionRateAfterStart`
- `deferRate`
- `dismissRate`
- `timeoutRate`
- `lastActivityAt`

### 2. Program Device Outcome Read Model

Recommended fields:

- `communicationId`
- `policyId`
- `deviceId`
- `deviceIdentifier`
- `hostname`
- `site`
- `area`
- `activeUserIdentifier`
- `lastSyncedAt`
- `lastActivityAt`
- `latestEventType`
- `latestActionKind`
- `nextRunAt`
- `scheduleState`
- `terminalOutcome`
- `startedCount`
- `stepAdvancedCount`
- `completedCount`
- `deferredCount`
- `dismissedCount`
- `timedOutCount`

### 3. Event Timeline Read Model

Recommended fields:

- `eventId`
- `communicationId`
- `policyId`
- `deviceId`
- `occurredAt`
- `eventType`
- `actionKey`
- `actionKind`
- `actionLabel`
- `occurrenceUtc`
- `snoozedUntilUtc`
- `activeUserIdentifier`
- `normalizedOutcome`

## Implementation Recommendation

### Phase 1: Reporting Baseline Without Agent Rebuild

Use the current backend plus frontend contracts to deliver:

- outcome funnel
- action breakdown
- device outcome table
- dedicated wellness report page
- exportable device and event tables

This phase should treat `actionKind = Close` plus `eventType = Completed` as `AmbiguousCloseCompletion`, not as clean completion.

### Phase 2: Agent Contract Cleanup

Requires a Windows Agent contract adjustment.

Goals:

- ensure close-button dismissal and CTA-driven close are reported distinctly
- reserve `Completed` only for explicit confirmation semantics
- optionally send a normalized `terminalOutcome` field directly from the agent

### Phase 3: Advanced Program Analytics

Optional later additions:

- family-to-family comparison
- cadence effectiveness comparison
- distribution-mode comparison
- site and area benchmarks
- optional user audit rollups

## Acceptance Criteria For Reporting

The wellness reporting slice should not be considered complete until:

- an operator can see per-program outcome funnel metrics without database access
- an operator can distinguish completion, defer, dismiss, and timeout behavior
- bulk device rollouts still show per-device next run and terminal outcome
- `RemindMeLater` is treated as defer, not completion
- ambiguous close semantics are either corrected at the agent contract layer or explicitly labeled in reports

## Open Questions

- Should `Read` count as engagement for all wellness variants, or only for variants that require an explicit CTA?
- Should `Started` without `Completed` count as partial success for stretching, or only as engagement?
- Once the agent contract is corrected, should `Close` be fully mapped to `Dismissed`, or should there be a separate `Skipped` outcome bucket?
- Should global wellness reporting stay under the current `Reports` menu or get a dedicated `Wellness Analytics` page later?
