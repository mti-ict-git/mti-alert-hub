# MTI Alert Phase 2 Agent Minimum Slice Plan

## Document Status
- Version: `0.1`
- Status: `Draft Baseline`
- Last Updated: `2026-07-07`
- Audience: `Backend Engineers`, `Tech Leads`, `AI Builders`

## Purpose
This document defines the minimum practical server-side execution slice required to connect the Windows Agent to the MTI Alert backend.

It is intended to:
- let `server` work proceed in parallel with a separate `agent` workstream
- avoid full Phase 2 scope explosion before the first useful end-to-end connection exists
- define the safest implementation order for `/agent` endpoints
- identify the minimum persistence and module dependencies required for that slice
- define verification evidence before claiming the slice is usable

## Planning Position
The repository roadmap still marks `Phase 1 - Core Backend Foundation` as the active implementation phase in `docs/implementation-roadmap.md`.

This document does **not** change that status.

Instead, it acts as a `Phase 2 planning artifact` so the team can prepare and execute the first Windows Agent server boundary increment once Phase 1 closure is acceptable.

## Source Of Truth
This plan is derived from:
- `docs/implementation-roadmap.md`
- `docs/openapi.yaml`
- `docs/technical-implementation-plan.md`
- `docs/database-schema-specification.md`
- `docs/backend-module-breakdown.md`
- `docs/windows-agent-client-specification.md`
- `docs/open-questions-and-challenges.md`

If there is a conflict, follow:
1. `docs/openapi.yaml` for contract behavior
2. `docs/implementation-roadmap.md` for phase ownership and scope
3. `docs/technical-implementation-plan.md` for integration direction
4. `docs/database-schema-specification.md` for persistence intent

## Goal
The minimum slice is complete when the Windows Agent can:
- create or refresh a device session
- authenticate subsequent agent requests with the issued session token
- submit heartbeat updates
- reconcile pending messages
- report `Displayed`
- report `Read`

This slice is intentionally enough to prove:
- the server can recognize a Windows Agent device
- the device can call authenticated `/agent` endpoints end to end
- message reconciliation and lifecycle evidence can flow back to the backend

## Out Of Scope
This minimum slice does **not** require:
- realtime push implementation
- SignalR or hub deployment
- publish orchestration completion
- full delivery retry orchestration
- reminder policy sync
- reminder event ingestion
- workflow response submission
- reporting dashboards
- admin-facing delivery drilldowns

These remain later Phase 2 or Phase 3 work.

## Minimum Endpoint Scope
### Slice A. Session And Device Trust
- `POST /agent/session`

### Slice B. Device Liveness
- `POST /agent/heartbeat`

### Slice C. Pending Message Reconciliation
- `GET /agent/messages`

### Slice D. Delivery Evidence
- `POST /agent/messages/{messageId}/displayed`
- `POST /agent/messages/{messageId}/read`

## Deferred Endpoints
The following endpoints should stay deferred until the minimum slice is stable:
- `POST /agent/realtime/negotiate`
- `GET /agent/reminder-policies`
- `POST /agent/reminder-policies/{policyId}/events`
- `POST /agent/messages/{messageId}/response`

## Execution Strategy
The recommended strategy is:
- establish agent session trust first
- reuse existing `devices` data instead of inventing a separate device identity source
- introduce the smallest persistence needed for agent sessions and lifecycle evidence
- allow `GET /agent/messages` to return an empty but contract-valid list before publish orchestration is implemented
- keep response and reminder logic out of the first slice

This keeps the server task narrow while still unblocking meaningful end-to-end agent integration.

## Module Ownership
### Agent Module
Owns:
- `POST /agent/session`
- `POST /agent/heartbeat`
- `GET /agent/messages`
- `POST /agent/messages/{messageId}/displayed`
- `POST /agent/messages/{messageId}/read`

Core responsibilities:
- session issuance and validation for devices
- device lookup and refresh
- agent-facing request validation
- message reconciliation query surface
- lifecycle event ingestion

### Devices Module
Provides:
- device registry lookup by `deviceIdentifier`
- device metadata update hooks for heartbeat and session refresh
- admin read model continuity for device health fields

### Deliveries Module
Provides the minimum backing behavior for:
- message reconciliation source
- mapping `messageId` to a device-targeted delivery record
- append-only `Displayed` and `Read` state evidence

The first slice should call this through explicit service boundaries rather than letting the agent module query delivery tables directly without structure.

### Audit Module
Should capture representative events for:
- device session creation or refresh
- rejected agent authentication
- lifecycle evidence acceptance or rejection when useful for supportability

## Minimum Persistence Dependencies
The first useful schema increment should introduce or activate these ownership areas from `docs/database-schema-specification.md`:

### Required
- `device_sessions`
- `delivery_jobs`
- `delivery_events`

### Strongly Recommended
- `device_realtime_connections`

This table may be added now even if realtime negotiation is deferred, because it keeps the schema ready for later connection tracking.

### Not Required For This Slice
- `agent_reminder_policies`
- `agent_reminder_events`
- `recipient_responses`
- dashboard or derived reporting tables

## Behavior Notes Per Endpoint
### `POST /agent/session`
Purpose:
- create or refresh a renewable device session token

Minimum behavior:
- validate the request payload from `AgentSessionRequest`
- find the device by `deviceIdentifier`
- if the device does not exist, reject with explicit error behavior rather than silently creating an untrusted device record unless the contract is revised
- refresh device metadata fields that are safe to update from the agent:
  - `hostname`
  - `agentVersion`
  - `lastConnectionAt`
- issue a new opaque session token or refresh an existing valid session
- return `AgentSessionResponse`

Important rule:
- keep desktop delivery device-centric
- `activeUserIdentifier` and `employeeNumber` are optional metadata, not the primary trust anchor

### `POST /agent/heartbeat`
Purpose:
- keep device liveness and basic runtime metadata fresh

Minimum behavior:
- authenticate with `AgentSessionAuth`
- validate payload from `AgentHeartbeatRequest`
- confirm the token belongs to the same device identified in the payload
- update `lastHeartbeatAt`
- update device `status` if provided
- record `activeUserIdentifier` only as optional audit metadata if stored
- return `204`

### `GET /agent/messages`
Purpose:
- provide startup and reconnect reconciliation

Minimum behavior:
- authenticate the device session
- return a contract-valid `AgentMessageListResponse`
- allow empty-state `items: []` until publish orchestration and recipient snapshot generation are ready
- support the optional `since` cursor shape even if the first implementation treats it as best-effort or ignores it while returning all pending items for the device

Important rule:
- do not fake realtime here
- this endpoint is the reliability fallback and can be useful before hub push exists

### `POST /agent/messages/{messageId}/displayed`
Purpose:
- record authoritative desktop display evidence

Minimum behavior:
- authenticate the device session
- confirm the message belongs to the calling device
- validate `AgentLifecycleEventRequest`
- append a delivery event or equivalent lifecycle record for `Displayed`
- make repeated submissions idempotency-safe
- return `204`

### `POST /agent/messages/{messageId}/read`
Purpose:
- record authoritative desktop read evidence after actual interaction

Minimum behavior:
- authenticate the device session
- confirm the message belongs to the calling device
- validate `AgentLifecycleEventRequest`
- append a delivery event or equivalent lifecycle record for `Read`
- make repeated submissions idempotency-safe
- return `204`

## Recommended Delivery Slice Order
### Slice 1. Agent Session Foundation
Deliver:
- request and response schemas for `POST /agent/session`
- device session token issuance
- agent auth middleware or guard
- session lookup and validation service

Verification:
- known device can create session
- invalid payload returns `422`
- unknown or rejected device returns documented failure
- response shape matches `AgentSessionResponse`

### Slice 2. Heartbeat
Deliver:
- `POST /agent/heartbeat`
- device metadata refresh
- session-token to device consistency check

Verification:
- valid authenticated heartbeat returns `204`
- invalid or missing token returns `401`
- mismatched token and `deviceIdentifier` is rejected
- device heartbeat timestamp updates in persistence

### Slice 3. Empty-State Message Reconciliation
Deliver:
- `GET /agent/messages`
- minimum repository contract for pending device messages
- contract-valid empty-state response

Verification:
- valid authenticated request returns `200`
- payload shape matches `AgentMessageListResponse`
- empty `items` is accepted by the agent integration path

### Slice 4. Displayed And Read Evidence
Deliver:
- `POST /agent/messages/{messageId}/displayed`
- `POST /agent/messages/{messageId}/read`
- delivery event append behavior
- idempotent duplicate submission handling

Verification:
- valid lifecycle posts return `204`
- unknown `messageId` returns `404`
- repeated `Displayed` and `Read` calls remain safe
- event records preserve `occurredAt`

## Minimum Code Shape
The recommended backend additions are:

```text
backend/src/modules/agent/
  controller/
    register-agent-routes.ts
  service/
    agent-session-service.ts
    agent-message-service.ts
    agent-lifecycle-service.ts
  repository/
    agent-session-repository.ts
    agent-message-repository.ts
  model/
    agent-session.ts
  validation/
    agent-request-schemas.ts
```

Cross-cutting additions likely needed:

```text
backend/src/shared/auth/
  agent-auth.ts

backend/src/app/bootstrap/
  create-backend-app.ts
```

Potential supporting infrastructure:

```text
backend/src/infrastructure/db/
  migration support for device session and delivery event tables
```

## Minimum Migration Scope
The first migration for this slice should prioritize:
- `device_sessions`
- any missing delivery tracking tables required to resolve `messageId` for the device and store `Displayed` or `Read`

Avoid bundling unrelated schema work into the same migration set, such as:
- reminder policy storage
- workflow response persistence
- dashboard materialization
- WhatsApp callback support

## Open Questions That Still Matter
The following questions still affect implementation and should be treated carefully:

### OQ-1. Realtime Technology
- do not block this minimum slice on the final hub technology choice

### OQ-2. Windows Agent Authentication Strategy
- the current safe assumption remains valid for the minimum slice:
  - renewable device session token
  - device-centric trust
  - optional user context only as metadata

### OQ-11. Local Routine Reminder Missed-Run Semantics
- not needed for the first slice
- keep reminder logic out until the minimum session and lifecycle path is stable

## Verification Matrix
### Contract
- request and response shapes match `docs/openapi.yaml`
- error responses use existing shared error structure

### Authentication
- session token is required for protected `/agent` endpoints after session creation
- expired or invalid session tokens return `401`

### Ownership
- one device cannot submit lifecycle events for another device's message
- unknown devices cannot create trusted sessions silently

### Idempotency
- repeated `Displayed` submissions do not corrupt lifecycle state
- repeated `Read` submissions do not corrupt lifecycle state

### Persistence
- device session issuance is observable in persistence
- heartbeat updates device freshness metadata
- delivery evidence is queryable for later reporting work

## Suggested Handoff Between Server And Agent Workstreams
The `server` workstream should publish to the `agent` workstream:
- actual request and response samples for implemented `/agent` endpoints
- exact auth header expectation for `AgentSessionAuth`
- known temporary limitations such as empty-state `GET /agent/messages`
- any clarified error codes or idempotency behavior

The `agent` workstream should avoid assuming:
- realtime is available before `POST /agent/realtime/negotiate` is implemented
- reminder sync exists before the policy endpoints are delivered
- workflow response submission is available before Phase 3 response handling starts

## Recommended Definition Of Done For This Plan
This minimum slice is ready to hand off as implemented when:
- the five minimum endpoints exist and match OpenAPI
- backend build and typecheck pass
- representative authenticated smoke tests pass
- at least one end-to-end agent startup path succeeds through:
  - session creation
  - heartbeat
  - message reconciliation
  - displayed or read reporting
- `docs/openapi.yaml` and `docs/implementation-roadmap.md` remain synchronized with actual behavior

## Recommended Next Action
Once this plan is accepted, the next practical server step is:
- implement `Slice 1. Agent Session Foundation`

If the team wants the smallest possible first proof:
- start with `POST /agent/session`
- then `POST /agent/heartbeat`
- then `GET /agent/messages` with an empty but contract-valid response

That sequence creates the earliest stable integration point for the separate Windows Agent workstream.
