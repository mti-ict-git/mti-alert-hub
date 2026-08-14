# MTI Alert Wellness Program Execution Checklist

## Document Status
- Version: `0.3`
- Status: `Open Execution Checklist`
- Last Updated: `2026-07-17`
- Owner: `Product / Engineering`

## Purpose
This document turns the current `Wellness Programs` blueprint into an execution checklist that can be tracked across:
- backend server work
- admin web work
- Windows Agent work
- verification and rollout preparation

This checklist is intentionally detailed so implementation can be split across separate threads without losing alignment.

## Source Documents
- `docs/ohih-program-module-blueprint.md`
- `docs/wellness-program-server-design.md`
- `docs/functional-specification.md`
- `docs/reminder-hybrid-ux.md`
- `docs/windows-agent-client-specification.md`
- `docs/openapi.yaml`
- `docs/open-questions-and-challenges.md`

## Current Product Decision
The current recommended product shape is:
- keep `Wellness Programs` inside the broader `Notifications` domain
- add a dedicated admin menu entry for `Wellness Programs`
- reuse the recurring reminder policy foundation
- let the Windows Agent execute the routine locally
- support bright wellness-specific themes aligned with the approved mockup:
  - `Blue` for eye-break
  - `Green` for stretching

The current MVP lock for Product and UX is:
- final menu name: `Wellness Programs`
- admin IA:
  - `Notification Center`
  - `Create Notification`
  - `Wellness Programs`
- initial program types:
  - `SimpleReminder`
  - `GuidedRoutine`
- initial theme set:
  - `Blue`
  - `Green`
- initial CTA vocabulary:
  - `GotIt`
  - `Done`
  - `Start`
  - `Next`
  - `RemindMeLater`
- multilingual authoring: deferred beyond MVP, with one locale plus fallback acceptable for the first slice
- Office Stretching MVP shape: narrowed guided flow first, not the fully generalized multi-step routine engine

## Delivery Strategy
### MVP Goal
Deliver one specialized recurring wellness flow that proves:
- policy sync works
- local routine execution works
- configurable CTA buttons work
- the server receives activity evidence
- the UI theme matches the expected blue and green mockup direction

### Recommended MVP Scope
- `SimpleReminder` for Eye Break
- narrowed `GuidedRoutine` for Office Stretching
- device-bound assignment first
- one locale plus fallback acceptable for the first slice

## Checklist

### 1. Product And UX Lock
- `[x]` Confirm the final menu name is `Wellness Programs`.
- `[x]` Confirm the admin IA under Notifications:
  - `Notification Center`
  - `Create Notification`
  - `Wellness Programs`
- `[x]` Confirm the initial program types:
  - `SimpleReminder`
  - `GuidedRoutine`
- `[x]` Confirm the initial supported themes:
  - `Blue`
  - `Green`
- `[x]` Confirm CTA vocabulary for MVP:
  - `GotIt`
  - `Done`
  - `Start`
  - `Next`
  - `RemindMeLater`
- `[x]` Confirm whether multilingual authoring is required in MVP or deferred.
- `[x]` Confirm whether Office Stretching starts as true multi-step or narrowed guided step flow.

### 2. Backend Data Model
- `[x]` Lock the persistence shape for structured `wellnessProgram` payload on reminder drafts and published reminder policies.
- `[x]` Decide whether MVP uses:
  - structured JSON payload in existing reminder-capable entities, or
  - dedicated `wellness_programs` tables.
- `[x]` Define the published program identity model:
  - `programId`
  - `programVersion`
  - `programType`
  - `theme`
  - `layoutVariant`
- `[x]` Define step persistence shape:
  - `stepKey`
  - `title`
  - `description`
  - `assetUrl`
  - `durationSeconds`
  - `sortOrder`
- `[x]` Define action persistence shape:
  - `actionKey`
  - `kind`
  - `label`
  - `style`
  - `snoozeMinutes`
- `[x]` Define localization persistence shape if enabled in MVP.
- `[x]` Define assignment persistence shape:
  - scope type
  - scope value
  - recurrence
  - timezone
  - active window
  - valid until
  - active status
- `[x]` Implement schema migration and persistence wiring for `wellness_program_json` on `communications` and `agent_reminder_policies`.

### 3. Backend Contract And Service Layer
- `[x]` Finalize the MVP contract direction for `wellnessProgram` request and response semantics in `docs/openapi.yaml`.
- `[x]` Lock that wellness payload is valid only for eligible reminder-style flows.
- `[x]` Lock `AgentLocalRoutine` as the required execution mode for locally executed wellness programs.
- `[x]` Lock device-bound recipient eligibility for locally executed wellness assignments.
- `[x]` Lock validation requirements for `SimpleReminder` payload shape.
- `[x]` Lock validation requirements for `GuidedRoutine` payload shape.
- `[x]` Lock validation requirements for CTA combinations, including snooze actions.
- `[x]` Lock validation requirements for theme and layout combinations.
- `[x]` Lock validation requirements for step ordering and duration constraints.
- `[x]` Lock publish-time versioning behavior for wellness program payloads.
- `[x]` Implement backend request validation, publish-time checks, and policy materialization for the locked wellness contract.

### 4. Backend Admin APIs
- `[x]` Decide whether MVP starts with dedicated `Wellness Programs` endpoints or uses reminder draft endpoints plus a specialized payload.
- `[ ]` If dedicated endpoints are used, define and implement:
  - `GET /wellness-programs`
  - `POST /wellness-programs`
  - `GET /wellness-programs/{programId}`
  - `PATCH /wellness-programs/{programId}`
  - `POST /wellness-programs/{programId}/publish`
- `[ ]` Define assignment APIs or equivalent reminder assignment flow.
- `[ ]` Define activity APIs for program-level monitoring.
- `[ ]` Ensure operator-facing detail reads return effective schedule, theme, actions, and step metadata.

### 5. Agent Policy Sync Contract
- `[x]` Decide whether wellness stays inside `GET /agent/reminder-policies` for MVP.
- `[x]` Add policy sync fields needed by agent:
  - theme
  - layout
  - countdown
  - actions
  - steps
  - localization
- `[ ]` Define policy invalidation and update semantics when a program changes version.
- `[ ]` Ensure the agent can distinguish:
  - generic reminder policy
  - wellness simple reminder
  - wellness guided routine
- `[x]` Extend reminder event ingestion to support:
  - `Started`
  - `StepAdvanced`
  - `Completed`
  - `TimedOut`

## Latest Backend Implementation Evidence
- `2026-07-16`: backend MVP wellness persistence and contract wiring now exists in runtime code.
- Added migration `backend/migrations/0013_phase4_wellness_programs.up.sql` for:
  - `communications.wellness_program_json`
  - `agent_reminder_policies.wellness_program_json`
  - expanded `agent_reminder_events` type constraint
- Communication draft create, update, detail, duplicate, recurring publish validation, and agent reminder policy materialization now carry `wellnessProgram`.
- Agent reminder policy sync now returns `wellnessProgram`.
- Agent reminder policy event validation now accepts:
  - `Started`
  - `StepAdvanced`
  - `Completed`
  - `TimedOut`
- Verification passed with:
  - `npm run backend:typecheck`
  - `npm run backend:build`

## Locked Backend MVP Decisions
- The locked backend MVP shape is captured in `docs/wellness-program-server-design.md`.
- `Wellness Programs` remains communication-rooted in MVP:
  - `programId = communicationId`
  - `programVersion = scheduleVersion`
- Persistence reuses existing reminder-capable entities with structured JSON:
  - `communications.wellness_program_json`
  - `agent_reminder_policies.wellness_program_json`
- MVP does not introduce dedicated `/wellness-programs` endpoints.
- MVP keeps agent sync on:
  - `GET /agent/reminder-policies`
  - `POST /agent/reminder-policies/{policyId}/events`
- The remaining backend work is implementation, not product-shape discovery.

### 6. Admin Web Navigation And List Views
- `[x]` Add `Wellness Programs` menu entry to the Notifications cluster.
- `[x]` Create a `Wellness Programs` list page.
- `[x]` Show program type, theme, recurrence summary, status, and last updated metadata in the list.
- `[x]` Add draft/published status visibility if the server model distinguishes them.
- `[x]` Add quick actions:
  - view
  - edit
  - publish
  - duplicate
  - deactivate

### 7. Admin Web Authoring Form
- `[x]` Provide a dedicated `Wellness Programs` authoring entry for MVP instead of embedding wellness inside the generic `Create Notification` form.
- `[x]` Add program-type selection:
  - `SimpleReminder`
  - `GuidedRoutine`
- `[x]` Add theme selection:
  - `Blue`
  - `Green`
- `[x]` Add layout selection:
  - `ReminderCard`
  - `CountdownCard`
  - `OverviewCard`
  - `GuidedRoutine`
  - `CompletionCard`
- `[x]` Add CTA editor for one or two visible actions per card where applicable.
- `[x]` Add snooze configuration editor.
- `[x]` Add step editor for guided routines.
- `[x]` Add recurrence and validity configuration in the form, not only at publish time.
- `[x]` Add device-bound targeting or assignment UI with guardrails.
- `[x]` Add a visual preview panel aligned to the approved bright mockup direction.
- `[x]` Add clear operator guidance distinguishing:
  - simple reminder
  - guided routine
  - local agent execution

## Latest Admin Web Implementation Evidence
- `2026-07-16`: the admin web now carries `wellnessProgram` through shared frontend types and notification-service mapping, so create, edit, detail, and publish flows can read and write the structured payload without separate endpoints.
- `2026-07-16`: the admin sidebar now exposes a dedicated `Wellness Programs` entry, and the new list page groups all reminder communications that carry a structured `wellnessProgram` payload.
- `2026-07-17`: `Create Notification` is now refocused on standard communications only, while wellness authoring moves to a dedicated `Create Wellness Program` route under the `Wellness Programs` submenu.
- `2026-07-18`: wellness draft editing now also stays inside the dedicated `Wellness Programs` authoring route. The shared notification detail page no longer exposes a `Wellness Program Mode` toggle, and draft-edit actions from the wellness list now open the dedicated wellness editor instead of the generic notification editor.
- `2026-07-18`: wellness detail, publish, and lifecycle review now also stay on a dedicated `Wellness Programs` detail route. Wellness list `View` and `Publish` actions no longer bounce operators back into the generic notification detail page, while the route still reuses the existing reminder-oriented backend APIs and monitoring endpoints.
- The dedicated list now shows:
  - program type
  - theme
  - recurrence summary
  - current status
  - last updated timestamp
- The dedicated list now provides quick actions for:
  - view
  - edit draft
  - publish draft
  - duplicate
  - deactivate
- `2026-07-16`: the admin web now derives wellness monitoring from the existing reminder activity contract rather than waiting for dedicated wellness endpoints.
- The dedicated list now surfaces:
  - triggered, started, snoozed, completed, and timed-out counts
  - active policy count
  - last sync timestamp
  - last activity timestamp
  - aggregate compliance percentage
- The dedicated wellness authoring flow now exposes:
  - program type, theme, and layout selection
  - CTA editor with snooze support
  - guided-step editor
  - device-bound and `AgentLocalRoutine` guardrails
  - a dedicated desktop wellness preview
- Detail view now surfaces effective wellness metadata:
  - program type
  - theme
  - layout
  - action labels
  - step count
- Detail `Reminder Activity` now adds wellness-specific monitoring:
  - summary counters
  - compliance cards
  - device-level last sync and last activity visibility
  - recent wellness timeline for troubleshooting
- Windows Agent preview now switches to a wellness-specific mock surface when `wellnessProgram` is present, using the approved bright blue or green direction rather than the generic operational alert card.
- Verification passed with:
  - `npm run build`

### 8. Admin Web Monitoring
- `[x]` Add wellness activity view with counts for:
  - triggered
  - displayed
  - started
  - snoozed
  - completed
  - timed out
- `[x]` Add device-level last sync or last activity visibility.
- `[x]` Add timeline or recent-events view for troubleshooting.
- `[x]` Add compliance summary view suitable for operational review.

### 9. Windows Agent Rendering
- `[x]` Introduce a dedicated wellness rendering path separate from the generic notification surface.
- `[x]` Implement the `Blue` theme for eye-break surfaces.
- `[ ]` Implement the `Green` theme for stretching surfaces.
- `[x]` Implement `ReminderCard` rendering.
- `[x]` Implement `CountdownCard` rendering.
- `[x]` Implement `OverviewCard` rendering for the English eye-break summary variant.
- `[ ]` Implement narrowed `GuidedRoutine` rendering.
- `[x]` Implement `CompletionCard` rendering.
- `[x]` Support one or two configurable CTA buttons depending on payload.
- `[x]` Support configurable snooze actions.
- `[ ]` Support optional hero asset display.
- `[ ]` Support progress indicators for guided routines.
- `[x]` Keep wellness surfaces visually distinct from operational alert surfaces.

## Latest Windows Agent Rendering Evidence
- `2026-07-16`: the Windows Agent now carries `wellnessProgram` through the reminder-policy contract, local SQLite reminder-policy persistence, runtime request mapping, and the reminder renderer entry point.
- The first client rendering slice is intentionally narrowed to `SimpleReminder` eye-break experiences on the `Blue` theme.
- A dedicated `WellnessReminderWindow` now renders separately from the existing dark operational `NotificationWindow`, so eye-break reminders no longer inherit the alert-oriented shell.
- Implemented initial eye-break templates:
  - `ReminderCard`
  - `CountdownCard`
  - `OverviewCard`
  - `CompletionCard`
- Implemented CTA handling from the structured wellness payload:
  - primary acknowledgement / done action
  - optional `RemindMeLater` secondary action with `snoozeMinutes`
- Wellness actions now report specialized reminder events from the agent:
  - `Completed`
  - `Snoozed`
  - `Started`
  - `StepAdvanced`
- Added debug scenarios for the eye-break template set so the renderer can be exercised locally without waiting for the full integrated routine engine.
- `2026-07-17`: the eye-break renderer now consumes authored `title`, `body`, and `instruction` content consistently across `ReminderCard`, `CountdownCard`, `OverviewCard`, and `CompletionCard` instead of relying on mostly hardcoded copy.
- `2026-07-17`: countdown-oriented eye-break layouts now maintain local countdown state inside the dedicated wellness window, and the surface now exposes inline interaction status plus inline error feedback without falling back to the operational notification shell.
- `2026-07-17`: the eye-break surface is now also rendered as a smaller toast-like wellness notice anchored to the bottom-right work area, keeping the white friendly card language while avoiding a centered modal footprint.
- `2026-07-17`: the Windows Agent now also renders an English `OverviewCard` eye-break variant (`A4`) with compact toast sizing and local preview support from the shell.
- `2026-07-17`: `RemindMeLater` now also schedules a true local snooze and re-trigger timestamp inside agent persistence, and the reminder scheduler prioritizes that snoozed occurrence before returning to the normal recurrence cadence.
- `2026-07-17`: reminder activity is now queued locally in SQLite whenever the backend/session is unavailable, then flushed and reconciled automatically from the agent connection loop once the session recovers. The queue is persisted per reminder event payload so `Triggered`, `Displayed`, `Snoozed`, `Started`, and `Completed` no longer disappear just because the device was briefly offline.
- Verification passed with:
  - `dotnet build .\\MTI.Alert.Agent\\MTI.Alert.Agent.csproj --no-restore`
  - `dotnet test .\\MTI.Alert.Agent\\Tests\\MTI.Alert.Agent.Tests\\MTI.Alert.Agent.Tests.csproj --no-restore`

### 10. Windows Agent Routine Engine
- `[ ]` Extend the local reminder executor to understand wellness payload variants.
- `[ ]` Support countdown execution locally without live server dependency.
- `[ ]` Support step advancement for guided routines.
- `[ ]` Support completion flow and completion card.
- `[ ]` Support timeout behavior where required.
- `[x]` Support snooze and re-trigger behavior.
- `[x]` Queue activity locally while offline and reconcile later.

### 11. Visual Fidelity And Theme Quality
- `[ ]` Match the approved mockup direction for white surfaces with blue and green accents.
- `[ ]` Use rounded cards and soft spacing instead of operational-alert chrome.
- `[ ]` Ensure CTA hierarchy is visually clear and consistent.
- `[ ]` Ensure typography remains readable at common Windows desktop scaling factors.
- `[ ]` Review the resulting UI against the mockup for theme consistency before declaring MVP complete.

### 12. Verification
- `[ ]` Verify one complete `SimpleReminder` flow end to end:
  - author
  - publish
  - sync
  - execute
  - snooze
  - complete
  - report activity
- `[ ]` Verify one complete narrowed `GuidedRoutine` flow end to end.
- `[ ]` Verify offline execution then later event reconciliation.
- `[ ]` Verify policy update behavior when a published program changes.
- `[ ]` Verify that unsupported audience or channel combinations are rejected cleanly.
- `[ ]` Verify the UI theme and button labels against the approved mockup expectations.
- `[ ]` Verify no existing operational notification flows regress.

### 13. Rollout Control
- `[ ]` Keep `Wellness Programs` behind a controlled scope flag until the first integrated slice is validated.
- `[ ]` Decide whether the first release is limited to a subset of devices or sites.
- `[ ]` Document support and rollback behavior if a wellness program payload causes client render failures.
- `[ ]` Document fallback behavior when a client receives a wellness payload shape it cannot render.

## Suggested Execution Order
1. Lock product and UX decisions.
2. Finalize contract and persistence shape.
3. Implement backend validation and sync.
4. Build admin list and authoring flow.
5. Build agent renderer and routine execution.
6. Add monitoring.
7. Run integrated verification.

## Definition Of Done
Wellness Programs should not be considered done until:
- the dedicated admin entry exists
- structured payloads are versioned and validated
- the Windows Agent can execute at least one blue eye-break reminder and one green stretching routine locally
- configurable CTA behavior works
- activity evidence is visible from the admin flow
- verification proves policy sync, local execution, and reconciliation without manual database inspection
