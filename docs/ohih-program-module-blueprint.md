# MTI Alert OHIH Program Module Blueprint

## Document Status
- Version: `0.2`
- Status: `Draft Baseline`
- Last Updated: `2026-07-16`
- Audience: `Product Owner`, `Backend Engineers`, `Frontend Engineers`, `Windows Agent Engineers`

## Purpose
This document defines the recommended product and technical shape for the `OHIH` program module.

The goal is to support ergonomic reminder programs such as:
- `Eye Break / Rule 20-20-20`
- `Office Stretching`

These programs are intentionally different from one-time or ad hoc communications.

## Source Of Truth
This blueprint is derived from:
- `docs/functional-specification.md`
- `docs/technical-implementation-plan.md`
- `docs/windows-agent-client-specification.md`
- `docs/open-questions-and-challenges.md`
- `docs/reminder-hybrid-ux.md`

If there is a conflict, follow:
1. `docs/functional-specification.md` for product behavior
2. `docs/technical-implementation-plan.md` for backend and integration direction
3. this file for the OHIH module boundary only

## Problem Statement
OHIH-style ergonomic reminders are not the same as normal desktop notifications.

Compared with normal communications, they are:
- recurring and long-lived
- highly device-local
- timer-driven
- interactive
- often multi-step
- intended to remain usable even during temporary server disconnect

Because of that, they should not rely on the server to trigger every popup instance in real time.

## Product Positioning
The recommended concept is:
- `server-managed policy`
- `agent-executed routine`

This means:
- the server owns program definition, assignment, versioning, activation, and evidence collection
- the Windows Agent owns local schedule execution, countdowns, step flow, snooze behavior, and local offline resilience

## Recommended Conceptual Model
Treat OHIH as a dedicated sub-domain built on top of the existing recurring reminder foundation.

### Keep
- the existing communication and reminder engine
- existing device-centric Windows Agent trust and reminder-policy sync
- existing audit, policy versioning, and reminder event reconciliation approach

### Add
- a dedicated OHIH authoring and monitoring surface
- a richer program-definition payload
- an agent-side routine player that can render guided flows, not only generic reminders

## Recommended Product Boundary
### What OHIH Is
- a managed ergonomic or wellness routine program
- scheduled by policy
- executed locally on approved Windows Agent devices
- monitored centrally

### What OHIH Is Not
- not an emergency communication
- not an ad hoc one-time alert
- not a generic notification-center replacement
- not a full HR wellness platform

## Recommended Admin IA
Do not force this into the generic `Create Notification` form or the generic `Notification Center` list alone.

Current recommendation:
- keep OHIH inside the broader `Notifications` domain
- add a dedicated menu entry named `Wellness Programs`

Recommended menu cluster:
- `Notification Center`
- `Create Notification`
- `Wellness Programs`

Recommended pages under `Wellness Programs`:
- `Programs`
- `Assignments`
- `Activity`

This keeps the feature discoverable as part of the same communication platform while still acknowledging that ergonomic routines need their own authoring and monitoring flow.

The current MVP menu and IA decision is now locked as:
- `Notification Center`
- `Create Notification`
- `Wellness Programs`

## Recommended Module Split
### 1. OHIH Program Catalog Module
Owns reusable program definitions.

Examples:
- `Eye Break 20-20-20`
- `Office Stretching 2 Hour Routine`

Responsibilities:
- program identity
- localized title and description
- visual assets
- routine variant
- step definitions
- action set
- content versioning

### 2. OHIH Assignment Module
Owns where and when a program applies.

Responsibilities:
- target scope
- active status
- interval or recurrence configuration
- active hours
- active days
- snooze rules
- validity window
- policy version publication

### 3. Agent OHIH Policy Sync Module
Owns distribution of effective OHIH policy to Windows Agent.

Responsibilities:
- expose device-eligible active programs
- return versioned policy payloads
- invalidate or deactivate old policies
- support offline-safe local execution on agent

### 4. OHIH Activity Module
Owns evidence and compliance visibility.

Responsibilities:
- triggered count
- displayed count
- started count
- snoozed count
- completed count
- timed-out count
- last device sync
- optional active-user-at-event visibility when the endpoint can report it safely
- compliance summaries

## Server Versus Agent Responsibility
### Server Control Plane
The server should control:
- which OHIH programs exist
- the current published version of each program
- which devices or scopes receive the program
- when the program is active
- what options are allowed, such as snooze or mandatory completion
- what evidence is collected and reported

### Agent Execution Plane
The agent should control:
- local reminder timing
- popup rendering
- countdown progress
- step navigation
- snooze countdown
- completion UX
- offline buffering of evidence

### Explicit Non-Goals For Server
The server should not control:
- each per-second countdown tick
- each step transition in real time
- whether a popup should repaint frame-by-frame
- per-occurrence UI state once the policy is already synchronized locally

## Recommended Visual Theme
The first version should intentionally match the visual direction in the provided mockup.

Theme direction:
- bright, friendly, reassuring UI
- primary accent families:
  - `Blue` for eye-break or focus-rest themes
  - `Green` for stretching or movement themes
- softer cards, rounded surfaces, and clear CTA hierarchy
- visually polished, not emergency-styled

This is a deliberate departure from the more neutral operational notification surfaces.

The current MVP theme decision is now locked as:
- `Blue` for eye-break experiences
- `Green` for stretching experiences

## Recommended Program Types
### Program Type A: Simple Timed Reminder
Example:
- `Eye Break`

Characteristics:
- small right-bottom reminder
- short instruction
- single countdown
- simple CTA such as `Done` or `Remind me in 10 min`

### Program Type B: Guided Routine
Example:
- `Office Stretching`

Characteristics:
- opening card
- one or more guided steps
- optional image per step
- countdown per step
- progress indicator such as `1 / 6`
- completion state

### MVP Recommendation
Support Type A fully first.

Support Type B in a narrowed form first:
- intro card
- one active step at a time
- next-step progression
- completion state

The current MVP program decision is now locked as:
- `SimpleReminder` for eye-break reminders
- narrowed `GuidedRoutine` for office stretching
- one locale plus fallback for the first slice
- configurable CTA vocabulary limited to:
  - `GotIt`
  - `Done`
  - `Start`
  - `Next`
  - `RemindMeLater`
- CTA semantic lock:
  - `GotIt` and `Done` confirm the routine was performed or completed
  - `RemindMeLater` records a defer or snooze decision, not a completion
- assignment and monitoring remain device-centric in MVP; the currently logged-in Windows user may be captured as optional audit metadata, but not as the authoritative assignment key
- dedicated post-routine feedback prompts for usefulness or need rating remain deferred beyond the current MVP until the survey contract and reporting model are approved

## Suggested OHIH Content Model
The current `title`, `body`, and `instruction` fields are not sufficient on their own for rich guided routines.

Recommended additional structured payload at the program-definition level:

- `programType`
  - `EyeBreak`
  - `StretchRoutine`
- `presentationVariant`
  - `Toast`
  - `CompactCard`
  - `GuidedModal`
- `theme`
  - `Blue`
  - `Green`
  - future variants
- `layoutVariant`
  - `ReminderCard`
  - `CountdownCard`
  - `OverviewCard`
  - `GuidedRoutine`
  - `CompletionCard`
- `defaultLocale`
- `localizations[]`
- `heroAsset`
- `countdownSeconds`
- `snoozeOptions[]`
- `steps[]`
  - `stepKey`
  - `title`
  - `description`
  - `asset`
  - `durationSeconds`
  - `sortOrder`
- `actions[]`
  - `Done`
  - `Start`
  - `Next`
  - `Snooze10Minutes`
  - `GotIt`
  - `RemindMeLater`

The action set should be configurable per template variant so one program may show:
- one primary action only, such as `Done`
- two actions, such as `Got it` and `Remind me in 10 min`
- a guided routine flow, such as `Start`, `Next`, and `OK`

## Suggested Assignment Model
Recommended assignment fields:
- `programId`
- `assignmentScopeType`
  - `Device`
  - `Site`
  - `Area`
- `assignmentScopeValue`
- `isActive`
- `executionMode = AgentLocalRoutine`
- `recurrenceRule` or explicit interval configuration
- `timezone`
- `activeWindowStart`
- `activeWindowEnd`
- `validFrom`
- `validUntil`
- `publishedVersion`

For MVP, keep assignment device-centric whenever practical.

## Recommended Event Model
The current generic reminder event set should expand for OHIH scenarios.

Recommended OHIH event types:
- `Triggered`
- `Displayed`
- `Started`
- `StepAdvanced`
- `Completed`
- `Dismissed`
- `TimedOut`
- `Snoozed`

Optional later:
- `Skipped`
- `Paused`
- `Resumed`

## Recommended Data Model Direction
### Reuse Existing Foundation
Keep using the existing recurring reminder policy concept for:
- device sync
- policy versioning
- activity reconciliation

### Add OHIH-Specific Tables Or JSON Shape
Two acceptable implementation patterns exist:

#### Option A: Dedicated Tables
- `ohih_programs`
- `ohih_program_localizations`
- `ohih_program_steps`
- `ohih_program_assignments`
- `ohih_program_assignment_scopes`
- `ohih_program_activity_rollups`

#### Option B: Program Catalog Plus Structured JSON Payload
- `ohih_programs`
  - includes `content_payload_json`
- `ohih_program_assignments`
  - includes `policy_payload_json`

Current recommendation:
- use `Option B` for MVP speed
- keep step and localization content in structured JSON
- split into dedicated child tables later only if authoring complexity grows

## Recommended API Boundary
### Admin APIs
- `GET /ohih/programs`
- `POST /ohih/programs`
- `GET /ohih/programs/{programId}`
- `PATCH /ohih/programs/{programId}`
- `POST /ohih/programs/{programId}/publish`
- `GET /ohih/assignments`
- `POST /ohih/assignments`
- `PATCH /ohih/assignments/{assignmentId}`
- `POST /ohih/assignments/{assignmentId}/activate`
- `POST /ohih/assignments/{assignmentId}/deactivate`
- `GET /ohih/activity`
- `GET /ohih/activity/{programId}`

### Agent APIs
Prefer extending the existing reminder-policy sync shape rather than inventing a completely separate trust boundary on day one.

Acceptable first approach:
- enrich `GET /agent/reminder-policies`
- enrich `POST /agent/reminder-policies/{policyId}/events`

Only create a separate agent endpoint family if OHIH payload size and behavior clearly diverge from normal reminder policies.

## Recommended UI Strategy
### Admin UI
Use a dedicated `Wellness Programs` screen under the `Notifications` cluster, not the generic notification authoring form.

Why:
- operators think in terms of programs, not one-time communications
- recurrence and validity are first-class inputs
- multi-step content is more complex than the normal title-body-instruction model

### Agent UI
Use dedicated rendering templates:
- compact reminder card
- guided routine modal
- completion card

Do not try to force the full experience into the current generic notification card shape.

## MVP Scope Recommendation
### Include
- one dedicated OHIH program module in admin
- create and edit program definition
- assign by `Device`, `Site`, or `Area`
- local execution on agent
- `Triggered`, `Snoozed`, and `Completed` evidence
- simple monthly activity summary

### Defer
- full media library management
- video playback
- drag-and-drop routine designer
- advanced analytics dashboards
- person-level wellness scoring
- HR-system coupling

## Recommended Delivery And Control Flow
1. Admin creates or edits an OHIH program.
2. Admin publishes a program version.
3. Admin creates or updates assignments.
4. Server materializes effective policy payloads for eligible devices.
5. Agent synchronizes active policy versions.
6. Agent executes the routine locally within the valid window.
7. Agent records events locally when needed.
8. Agent reconciles OHIH activity back to the server.
9. Admin reviews activity and compliance from the OHIH monitoring screen.

## Relationship To Existing Reminder Engine
### Reuse
- device session and trust
- reminder policy sync
- reminder event reporting
- schedule versioning
- validity-window semantics

### Avoid Reusing Blindly
- generic notification-center authoring
- generic one-shot publish monitoring language
- recipient-level delivery semantics that imply ad hoc server-triggered messaging

## Recommended MVP Success Criteria
The first OHIH slice is successful when:
- an admin can create one ergonomic program definition
- an admin can assign it to at least one device-bound audience
- a Windows Agent can sync the program policy
- the program can run locally without needing a live server request per occurrence
- the agent can report `Triggered`, `Snoozed`, and `Completed`
- an admin can review recent activity without database access

## Open Decisions
This blueprint intentionally leaves these decisions open:
- whether OHIH lives under `Programs` or `Management`
- whether the first version uses a dedicated agent endpoint family or enriches existing reminder-policy endpoints
- whether stretching starts as a true multi-step routine or a narrowed single-step guided reminder
- whether multilingual authoring is required in MVP or can start with one locale plus fallback

## Recommendation Summary
The recommended architecture is:
- `dedicated OHIH module in admin`
- `server as control plane`
- `Windows Agent as execution plane`
- `reuse existing reminder-policy foundation`
- `do not treat OHIH as a normal Notification Center feature`
