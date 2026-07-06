# MTI Alert Windows Agent Client Specification

## Document Status
- Version: `0.1`
- Status: `Draft Baseline`
- Last Updated: `2026-07-06`
- Audience: `Windows Agent Engineers`

## Purpose
This document is the handoff specification for the `MTI Alert Windows Agent` client application.

It explains:
- what the Windows Agent is responsible for
- what the server is expected to provide
- which server contracts the client depends on
- how delivery, display, read, and response semantics work
- how critical alerts should behave on the client

This document is intended to let a Windows Agent engineer start implementation without reconstructing the system behavior from multiple files.

## Source Of Truth
This specification is derived from:
- `docs/functional-specification.md`
- `docs/technical-implementation-plan.md`
- `docs/openapi.yaml`
- `docs/template-policy-schema.md`
- `docs/open-questions-and-challenges.md`

If there is a conflict, follow:
1. `docs/openapi.yaml` for API contract behavior
2. `docs/functional-specification.md` for product behavior
3. `docs/technical-implementation-plan.md` for integration direction

## System Role
The Windows Agent is a separate `C#` desktop client that connects to the central MTI Alert server.

The server is responsible for:
- communication lifecycle orchestration
- targeting resolution
- policy evaluation
- delivery state persistence
- auditability

The Windows Agent is responsible for:
- identifying the device to the server
- maintaining realtime connectivity
- reporting heartbeat and connection health
- receiving communication payloads
- rendering content according to policy
- reporting displayed, read, and response events

## Core Operating Model
### Device-Centric Delivery
For MVP, desktop delivery is `device-centric`, not `person-centric`.

Implications:
- the primary delivery endpoint is the device
- shared PCs and laptops are first-class supported
- location context matters more than user ownership for desktop delivery
- active user identity may be sent as optional audit metadata, but it is not the primary desktop recipient identity

### Location-Oriented Devices
For MVP, device records are operationally flat but should carry:
- `site`
- `area`
- `locationLabel`
- `ownershipMode`

The current desktop targeting direction is:
- `DeviceByLocation`
- primary scope dimensions: `site + area`

## Client Objectives
The Windows Agent should be able to:
- register or refresh a secure device session
- negotiate a realtime connection
- maintain connection health and heartbeat
- receive pushed communications
- reconcile missed messages after disconnection
- render messages according to template policy
- support workflow responses
- report delivery lifecycle events accurately

## Server Dependencies Required By The Client
The client depends on the server providing:
- a device session endpoint
- a realtime negotiation endpoint
- a heartbeat endpoint
- a pending message retrieval or reconciliation endpoint
- displayed acknowledgement endpoint
- read acknowledgement endpoint
- response submission endpoint

These are represented in `docs/openapi.yaml` as:
- `POST /agent/session`
- `POST /agent/realtime/negotiate`
- `POST /agent/heartbeat`
- `GET /agent/messages`
- `POST /agent/messages/{messageId}/displayed`
- `POST /agent/messages/{messageId}/read`
- `POST /agent/messages/{messageId}/response`

## Realtime Model
### Direction
The Windows Agent should use a `push-first` realtime model aligned with a `SignalR-style` interaction pattern.

### Expectations
The client should:
- establish a server-approved realtime connection after session creation
- maintain the connection as long as the agent is healthy
- reconnect automatically after transient failures
- continue to send heartbeat updates even if the realtime layer is degraded, if the chosen implementation supports that

### Current Open Point
The exact backend technology for the SignalR-style server implementation is not yet locked. The client should therefore be built around a hub-based realtime model, not around a server-specific assumption beyond the published contract.

## Authentication And Session Model
### Current Direction
The current safe direction is:
- device registration or session creation through the server
- renewable device session token
- optional active user context sent as audit metadata

### Client Inputs
The current API contract indicates the agent may send:
- `deviceIdentifier`
- `employeeNumber` nullable
- `agentVersion`
- `activeUserIdentifier` nullable

### Implementation Guidance
The client should:
- persist a stable `deviceIdentifier`
- treat the device session as the authoritative agent credential
- avoid assuming employee binding is mandatory for desktop delivery
- send active user context only when available and trustworthy

## Connection And Startup Flow
Recommended client startup sequence:

1. Load or establish local device identity.
2. Call `POST /agent/session`.
3. Receive session token and device metadata.
4. Call `POST /agent/realtime/negotiate`.
5. Establish realtime connection using returned hub metadata.
6. Start heartbeat cycle.
7. Call `GET /agent/messages` to reconcile any pending messages after startup or reconnect.
8. Begin normal realtime event handling.

## Heartbeat And Device Health
### Required Client Behavior
The client should periodically report:
- device liveness
- current agent version
- relevant runtime health state if required by the final implementation

### Health States
The documented device health states are:
- `Online`
- `Offline`
- `Stale`

### Semantics
- `Online`: device is connected and fresh
- `Offline`: device is not currently reachable
- `Stale`: the server considers the device connection or heartbeat too old relative to configured thresholds

### Policy Note
Threshold values such as heartbeat interval or stale timeout are expected to be policy-driven and configurable by the server side.

## Message Retrieval Model
### Primary Mode
Messages are expected to arrive through realtime push.

### Recovery Mode
The client must support recovery by querying:
- `GET /agent/messages`

This endpoint should be used after:
- startup
- reconnect
- resume from network failure
- suspected message loss

### Client Rule
The agent should never assume realtime delivery alone is sufficient. Reconciliation is part of the normal reliability model.

## Message Rendering Model
### Policy-Driven Rendering
The client must render each incoming communication according to effective template policy, not merely by priority text.

Relevant policy inputs include:
- `windowsAgentPresentation`
- `requiresResponse`
- `workflow`
- template version
- critical behavior policy

### Supported Presentation Modes
Current documented Windows Agent presentation values:
- `Toast`
- `Modal`
- `Fullscreen`

### MVP Critical Rule
Critical communications must start as an `immediate modal`, not as a toast.

### Critical Escalation Rule
For MVP, the client should support a `ModalThenStronger` behavior where:
- a critical message starts as a modal
- if there is no interaction within policy limits, the same device may re-alert more aggressively

The exact timing may be policy-driven, but the behavioral expectation is already established.

## Delivery Lifecycle Semantics
The client must help the server distinguish delivery lifecycle states correctly.

### `Sent`
Represents that the server or delivery pipeline has dispatched the communication toward the endpoint.

### `Displayed`
For Windows Agent, `Displayed` must only be reported when the communication is actually rendered on the device.

It must not be reported merely because:
- a payload was received
- a realtime event arrived
- a local queue item exists

### `Read`
For Windows Agent, `Read` must only be reported after real interaction.

Examples of acceptable interaction:
- opening details
- clicking an acknowledge or response button
- expanding the message into an interactive state
- explicit mark-as-read behavior if implemented

### `Responded`
Represents a workflow response submission.

### Acknowledgment Rule
In MVP, `response implies ack`.

If the user submits a valid workflow response, the backend should treat that as acknowledgment without requiring a separate ack step.

## Response Workflow Support
### Client Expectations
When `requiresResponse = true`, the client should:
- display workflow options provided by the server
- allow optional note input if policy permits
- block invalid response submission states
- submit the selected response to the server

### Workflow Data
The current contract indicates the agent message may include:
- `workflow`
- response options
- response requirement state

### Client Rule
Do not hardcode workflow options for all messages.

The client should render:
- workflow options
- note requirements
- response constraints
from server-provided policy and workflow data.

## Critical Dual-Path Behavior
### Current Direction
Some critical templates may use dual-path delivery:
- `WindowsAgent` first
- `WhatsApp` after a short delay

### Client Implication
The Windows Agent does not control WhatsApp delivery directly.

However, the client should assume:
- the same communication may already be in flight on another channel
- urgency is determined by template policy, not by the desktop client alone

### Important Constraint
The exact short-delay timing is still an open detail. The client should not hardcode arbitrary assumptions beyond the effective behavior expressed in the delivered payload or server policy.

## Offline And Retry Behavior
### Expected Server Direction
The current server-side direction is:
- bounded retry
- pending-message reconciliation
- recipient-only follow-up behavior for overdue or unread critical messages

### Expected Client Direction
The client should:
- survive temporary disconnection
- reconnect automatically
- query pending messages after reconnect
- avoid duplicate destructive actions if the same message is received again after reconciliation

### Idempotency Guidance
The client should treat message handling and event reporting as idempotency-sensitive.

Examples:
- repeated `Displayed` reports should not corrupt the lifecycle
- repeated `Read` reports should be safe
- repeated response attempts should be handled with explicit server validation

## Audit Semantics
### Device-Authoritative Model
For desktop delivery, device events are the authoritative evidence.

The server should be able to rely on the client for:
- display evidence at device level
- read evidence at device level
- response submission at device level

### Optional User Context
If the Windows session can reliably provide an active user identifier, the client may send it as optional metadata.

It should be treated as:
- additional audit context
- not the sole proof of message delivery
- not a substitute for device identity

## Expected Payload Capabilities
The current OpenAPI contract indicates the agent message should provide, at minimum:
- `messageId`
- `communicationId`
- `title`
- `body`
- `priority`
- `windowsAgentPresentation`
- `requiresResponse`
- `templateVersion` nullable
- `workflow`

The client should be designed to tolerate extension of this payload over time.

## Error Handling Expectations
The client should be prepared for:
- expired or invalid device session
- realtime negotiation failure
- transient network failure
- duplicate or already-processed lifecycle event submissions
- invalid workflow response submission
- server-side validation failures

The client should:
- log local operational errors
- retry where safe and bounded
- re-authenticate or renew session when required
- surface operationally meaningful diagnostics for support use

## UI And UX Expectations
### Non-Critical
- lighter notification modes are allowed
- a toast or less intrusive presentation may be used when policy indicates

### Critical
- immediate modal on first render
- stronger repeat behavior if no interaction occurs
- clear response action affordances when workflow is required
- do not silently downgrade critical rendering

### Shared Device Consideration
Because many devices may be shared:
- UI should prioritize clarity and urgency over personalization
- do not assume a stable single-user identity
- location and device context matter operationally

## Recommended Client Architecture
Recommended internal client components:
- `Device Identity Service`
- `Session Service`
- `Realtime Connection Service`
- `Heartbeat Service`
- `Pending Message Sync Service`
- `Message Store`
- `Notification Renderer`
- `Workflow Response Handler`
- `Audit Event Reporter`
- `Diagnostics/Logging Service`

This is not mandatory, but it is a practical decomposition aligned with the documented server boundary.

## Open Items The Engineer Should Know
The following areas are not fully closed yet and should be treated carefully:
- exact server technology behind the SignalR-style realtime contract
- exact device trust and authentication flow
- exact delay duration for critical dual-path desktop-to-WhatsApp follow-up
- final policy on how far template behavior is materialized into execution snapshots

The engineer should therefore avoid baking in assumptions that are not explicitly present in the API contract or effective payloads.

## Recommended Handoff Package
The Windows Agent engineer should receive at least:
- `docs/windows-agent-client-specification.md`
- `docs/technical-implementation-plan.md`
- `docs/functional-specification.md`
- `docs/openapi.yaml`
- `docs/template-policy-schema.md`

## Implementation Readiness Summary
The Windows Agent engineer can start with:
- session creation
- realtime negotiation
- heartbeat
- pending message reconciliation
- policy-driven rendering
- displayed/read reporting
- workflow response submission

The main caution is to keep the implementation:
- device-centric
- policy-driven
- resilient to disconnection
- tolerant of contract evolution
