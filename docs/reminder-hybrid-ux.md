# MTI Alert Hybrid Reminder UX

## Document Status
- Version: `0.3`
- Status: `Draft Baseline`
- Last Updated: `2026-07-16`
- Owner: `Product / Engineering`

## Purpose
This document defines the minimum admin UX needed to operate hybrid recurring reminders correctly.

Hybrid reminder behavior already exists in the backend contract and data model through:
- recurring `communication_schedules`
- `execution_mode = ServerGenerated | AgentLocalRoutine`
- synchronized `agent_reminder_policies`
- reconciled `agent_reminder_events`

The purpose of this document is to close the remaining operator-UX gap so reminder behavior is understandable and controllable from the admin application, not only from backend APIs.

## Problem Statement
The current notification authoring UI is optimized for ad hoc notification sending.

That is not sufficient for hybrid recurring reminders because operators must be able to understand and control:
- recurrence timing
- timezone behavior
- validity window
- execution strategy
- device eligibility for local execution
- reminder-policy synchronization status
- reminder evidence after local execution

Without these surfaces, the backend capability is technically present but operationally incomplete.

## UX Goals
- Let an operator create a recurring reminder without needing to understand internal tables or endpoints.
- Make the difference between server-triggered and locally executed reminders obvious before publish.
- Prevent operators from selecting incompatible audience or channel combinations for `AgentLocalRoutine`.
- Make reminder-policy lifecycle and reminder evidence reviewable after publish.

## Authoring Experience
When `communicationType = Reminder`, the admin UI should expose a reminder-specific authoring section.

### Required Authoring Inputs
- recurrence rule
- timezone
- start time
- optional end time or `validUntil`
- execution mode:
  - `ServerGenerated`
  - `AgentLocalRoutine`

### Required Authoring Guidance
The UI should explain:
- `ServerGenerated` means the server remains responsible for triggering each occurrence.
- `AgentLocalRoutine` means the server distributes a bounded reminder policy and Windows Agent may execute the reminder locally while the policy remains valid.
- the reminder draft stores that recurring definition before publish so the operator is not forced to define recurrence for the first time in the publish dialog

### Required Guardrails For `AgentLocalRoutine`
The UI should prevent or clearly reject publish attempts unless:
- `Desktop Agent` / `WindowsAgent` remains selected
- the audience resolves to at least one eligible device-bound Windows Agent recipient
- the authoring flow offers an explicit device-targeting path so operators can intentionally bind a recurring local routine to a known Windows Agent device when needed
- a bounded validity window is provided
- the reminder is treated as a routine prompt, not an emergency or ad hoc critical alert

## Publish Confirmation
Before publish, the operator should see a reminder-specific confirmation summary including:
- recurrence summary in human-readable form
- timezone
- execution mode
- validity window
- targeted device count
- whether the publish will create reminder policies for local execution or server-generated scheduled executions

Publish confirmation should primarily reuse the recurring definition already stored on the draft. Minor overrides may still be tolerated in early iterations, but publish should not be the first place where reminder cadence becomes visible.

## Post-Publish Detail Experience
After publish, the communication detail experience for reminders should expose at least:
- recurrence rule
- timezone
- execution mode
- schedule version
- validity window
- active or inactive policy state
- target device count
- last policy sync or change timestamp

## Monitoring Experience
For reminders using `AgentLocalRoutine`, operators should be able to review:
- which devices currently have an active reminder policy
- whether a policy became inactive due to update, expiry, or cancellation
- reconciled reminder evidence such as `Triggered`, `Acknowledged`, `Dismissed`, `Snoozed`, or other supported reminder event types
- reminder activity timeline per communication or per policy

The monitoring surface does not need a separate reminder-only dashboard in the first iteration, but the evidence must be reachable from the admin workflow without database access.

## UX Scope Recommendation
Two acceptable UX approaches exist:

### Option A: Unified Form With Reminder Section
Keep the current unified communication form, but reveal reminder-specific schedule and execution controls whenever `communicationType = Reminder`.

### Option B: Dedicated Reminder Flow
Keep the same backend model, but provide a dedicated create/edit experience for reminders so scheduling and execution controls are not hidden inside the generic notification form.

### Option C: Dedicated `Wellness Programs` Flow Under Notifications
Keep reminders inside the same broad notifications domain, but add a dedicated menu entry for ergonomic recurring programs so the operator sees:
- specialized visual template selection
- configurable CTA buttons such as `Got it`, `Remind me in 10 min`, `Start`, or `Done`
- richer presentation variants such as countdown cards and guided routines
- dedicated monitoring for locally executed wellness activity

Current safe recommendation:
- keep generic recurring reminders functional in the shared communication flow
- treat OHIH-style ergonomic routines as the first approved case for `Option C`
- ensure the detail and monitoring views still surface reminder-specific state explicitly

## Definition Of Done
Hybrid reminder UX is not considered complete until:
- operators can author recurring reminders with explicit execution mode selection
- publish confirmation explains how the reminder will execute
- `AgentLocalRoutine` guardrails are visible and enforced in the admin flow
- reminder detail screens expose schedule and policy metadata
- reminder evidence is visible from the admin experience
- challenge or verification demonstrates at least one end-to-end `AgentLocalRoutine` reminder flow

## Current State
As of `2026-07-15`, the admin UX now surfaces:
- explicit `Reminder` authoring
- explicit `Device` targeting
- recurring authoring controls in create and edit draft for first occurrence, recurrence rule, timezone, execution mode, and validity window
- draft persistence for recurring reminder configuration before publish
- recurring publish confirmation prefilled from the stored draft definition
- reminder schedule metadata
- reminder policy and reminder event monitoring
- visible `AgentLocalRoutine` publish guardrails in the admin flow

Remaining follow-up focus:
- review operator-facing wording and layout polish after the first end-to-end browser validation pass
- decide whether all reminder types remain in one shared admin flow or whether `Wellness Programs` becomes the first specialized reminder submodule under `Notifications`
