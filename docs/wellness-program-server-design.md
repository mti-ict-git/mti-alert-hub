# MTI Alert Wellness Program Server Design

## Document Status
- Version: `0.1`
- Status: `Draft Baseline`
- Last Updated: `2026-07-16`
- Audience: `Backend Engineers`, `Frontend Engineers`, `Windows Agent Engineers`

## Purpose
This document locks the backend MVP design for `Wellness Programs`.

It answers:
- which aggregate owns the data
- how the server persists wellness configuration
- which API shape the admin UI should use first
- how policy sync reaches the Windows Agent
- which parts are explicitly deferred beyond MVP

## Source Documents
- `docs/wellness-program-execution-checklist.md`
- `docs/ohih-program-module-blueprint.md`
- `docs/database-schema-specification.md`
- `docs/technical-implementation-plan.md`
- `docs/openapi.yaml`

## MVP Design Decision Summary
The backend MVP for `Wellness Programs` should:
- reuse the existing `communications` aggregate
- reuse the existing recurring reminder schedule model
- reuse the existing `agent_reminder_policies` sync boundary
- persist structured wellness configuration as JSON, not as a dedicated top-level program table family
- avoid dedicated `/wellness-programs` endpoints in the first slice
- let the admin UI present a dedicated `Wellness Programs` experience, separate from `Create Notification`, while still talking to the existing reminder-oriented communication APIs

This keeps the runtime model coherent and avoids creating a second orchestration engine before the first one is proven.

## Why This Is The Recommended MVP Shape
`Wellness Programs` is product-specialized, but not infrastructure-specialized enough to justify a second orchestration stack in MVP.

The existing backend already has:
- communication drafts
- recurring reminder schedules
- `AgentLocalRoutine`
- versioned agent reminder policy sync
- reminder event reconciliation

The missing part is not a new control plane. The missing part is:
- structured wellness payload
- dedicated admin UX
- richer agent rendering and event semantics

## Aggregate Ownership
### Primary Aggregate
For MVP, the primary aggregate remains:
- `communications`

Required conditions:
- `communicationType = Reminder`
- schedule uses recurring reminder semantics
- `executionMode = AgentLocalRoutine` for locally executed wellness flows
- `wellnessProgram` payload must be present for `Wellness Programs`

### Meaning
In MVP, a published wellness program is not a brand-new root entity.

It is:
- a specialized recurring reminder communication
- with a structured wellness payload
- exposed through a dedicated admin surface

## Persistence Decision
### MVP Persistence Strategy
Use structured JSON in existing reminder-capable entities.

This means:
- add `wellness_program_json` to `communications`
- add `wellness_program_json` snapshot to `agent_reminder_policies`
- continue to use `communication_schedules` for recurrence, execution mode, timezone, and validity window
- continue to use `agent_reminder_events` for reconciled agent evidence

### Why JSON First
JSON is preferred for MVP because:
- the payload is highly presentation-oriented
- the step and action structure may change rapidly during the first design iterations
- the agent contract needs one versioned blob more than it needs relational query flexibility
- authoring complexity is still modest compared with a general CMS

### Explicit MVP Non-Decision
Do **not** introduce these tables in the first slice unless implementation pressure proves the JSON shape unworkable:
- `wellness_programs`
- `wellness_program_steps`
- `wellness_program_assignments`
- `wellness_program_localizations`

Those remain acceptable future refactors, not MVP prerequisites.

## Database Shape Decision
### communications
Add:
- `wellness_program_json` nullable

Purpose:
- stores draft-time and published-source structured wellness configuration

Expected contents:
- `programType`
- `theme`
- `layoutVariant`
- `heroAssetUrl`
- `countdownSeconds`
- `rotationMode`
- `actions`
- `steps`
- `localizations`

### communication_schedules
No new top-level table is required for MVP.

Reuse existing columns:
- `recurrence_rule`
- `timezone`
- `execution_mode`
- `schedule_version`
- `valid_from`
- `valid_until`

Meaning:
- schedule ownership stays on the server
- assignment semantics remain attached to the same reminder publication flow

### agent_reminder_policies
Add:
- `wellness_program_json` nullable

Purpose:
- snapshot the exact structured experience the agent should execute for the synchronized policy version

### agent_reminder_events
No new table is required for MVP.

Expand allowed `event_type` values to include wellness-specific progression:
- `Started`
- `StepAdvanced`
- `Completed`
- `TimedOut`

## Program Identity Decision
For MVP:
- `programId = communicationId`
- `programVersion = scheduleVersion`

Why:
- the first slice does not require a standalone program catalog identity
- the schedule version already expresses the publish-time local execution contract
- this keeps agent reconciliation aligned with current reminder policy semantics

### Consequence
The admin UI may still label items as `Wellness Programs`, but the backend identity remains communication-rooted in MVP.

## Assignment Decision
For MVP, do not create a separate assignment subsystem.

Use the existing combination of:
- `communication_targets`
- `communication_schedules`
- `AgentLocalRoutine`
- device-bound audience resolution rules

Meaning:
- targeting remains part of the reminder publication flow
- the first controlled path should be device-centric whenever practical
- a separate `Assignments` page in the admin UI may still exist, but it should operate over the existing communication and schedule model rather than new assignment tables

## Admin API Strategy Decision
### MVP Strategy
Do **not** add dedicated `/wellness-programs` backend endpoints in the first slice.

Instead:
- reuse `POST /communications`
- reuse `PATCH /communications/{communicationId}`
- reuse `GET /communications/{communicationId}`
- reuse the existing reminder publish flow
- carry structured wellness data in `wellnessProgram`

### Why
This keeps:
- authorization rules unchanged
- draft lifecycle unchanged
- publish orchestration unchanged
- agent policy materialization unchanged

The specialized experience should begin in the admin web routing and UX, not by duplicating the server draft lifecycle.
That means the first operator path should be:
- dedicated `Wellness Programs` list
- dedicated `Create Wellness Program` entry
- dedicated wellness-focused monitoring

It should not depend on a `Wellness Program Mode` toggle inside the generic notification form.

### Acceptable Admin Filtering
The admin UI may define `Wellness Programs` as:
- `communicationType = Reminder`
- plus `wellnessProgram != null`

## Agent Policy Sync Strategy Decision
### MVP Strategy
Keep wellness inside:
- `GET /agent/reminder-policies`
- `POST /agent/reminder-policies/{policyId}/events`

Do not create a separate agent endpoint family for wellness in MVP.

### Required Extension
The reminder policy response must carry:
- `wellnessProgram`

The event reporting endpoint must accept the expanded reminder event types required by guided wellness flows.

### Why
The Windows Agent already expects:
- a bounded recurring policy
- local execution
- evidence reporting

Wellness is an enriched version of the same pattern, not a different trust boundary.

## Contract Decision
### wellnessProgram Payload
The `wellnessProgram` payload is now the contract boundary for specialized wellness behavior.

Minimum fields:
- `programType`
- `theme`
- `layoutVariant`
- `actions`

Optional MVP fields:
- `heroAssetUrl`
- `countdownSeconds`
- `rotationMode`
- `steps`
- `localizations`

### Contract Semantics
Validation rules should enforce:
- `wellnessProgram` only appears on eligible reminder-style communication flows
- `SimpleReminder` does not require steps
- `GuidedRoutine` requires at least one step
- `RemindMeLater` action may optionally carry `snoozeMinutes`
- theme must be one of the locked MVP variants
- layout must be compatible with the selected program type

## Validation Decision
### Create And Update Validation
The backend should validate:
- `communicationType = Reminder` when `wellnessProgram` is present
- `reminderSchedule` is present before publish
- `executionMode = AgentLocalRoutine` for locally executed wellness experiences
- audience resolves to at least one eligible Windows Agent device
- `Emergency` or unrelated ad hoc critical semantics are not mixed with wellness flows

### Payload Validation
The backend should validate:
- action key uniqueness
- step key uniqueness
- ascending step order
- positive durations where provided
- at least one visible CTA for executable cards
- no unsupported theme/layout combination

## Publication Behavior
Publishing a wellness program in MVP should:
1. keep the existing reminder publish flow
2. persist the structured wellness payload on the source communication
3. materialize or refresh `agent_reminder_policies`
4. snapshot `wellness_program_json` into the materialized policy row
5. increment or propagate `scheduleVersion` as the policy version boundary

## Event Model Decision
### Required Wellness Event Types
The server MVP should support:
- `Triggered`
- `Displayed`
- `Snoozed`
- `Started`
- `StepAdvanced`
- `Completed`
- `TimedOut`

### Kept Existing Generic Types
The generic reminder event model may still allow:
- `Read`
- `Dismissed`
- `Responded`

This is useful for mixed or future reminder experiences even if the first wellness slice uses only a subset.

## What The Admin UI Should Assume
The admin UI should assume:
- a dedicated `Wellness Programs` screen exists at the UX layer
- a dedicated create flow exists under `Wellness Programs`, not under `Create Notification`
- it still talks to the existing communication draft and reminder publish APIs
- a wellness item is a reminder communication with structured wellness payload

The admin UI should not assume:
- new standalone backend CRUD endpoints exist
- a separate assignment engine exists
- a separate policy sync endpoint exists

## What The Agent Should Assume
The agent should assume:
- wellness rides on top of reminder policy sync
- structured payload drives specialized rendering
- policy identity is still rooted in reminder policy IDs and versions

The agent should not assume:
- the server will stream each step in real time
- the server will maintain per-step interactive session state

## Explicit MVP Deferred Items
Defer beyond MVP:
- standalone relational wellness program catalog
- standalone assignment subsystem
- standalone agent wellness endpoint family
- full multilingual authoring management
- generalized media library workflow
- arbitrary drag-and-drop routine designer

## Recommended Next Implementation Slice
The next backend-focused slice should do exactly this:
1. add schema support for `wellness_program_json`
2. update request validation and OpenAPI alignment
3. update reminder policy materialization to include the wellness snapshot
4. expand reminder event type validation
5. keep all routing under existing communication and agent reminder endpoints

## Definition Of Done
The backend MVP design for `Wellness Programs` is considered implemented when:
- `wellness_program_json` exists on the source communication and materialized agent reminder policy
- existing reminder draft and publish APIs accept and validate the structured wellness payload
- agent reminder policy sync returns the structured wellness payload
- agent reminder event reporting accepts the expanded event model
- no dedicated wellness backend CRUD is required for the first integrated admin and agent slice
