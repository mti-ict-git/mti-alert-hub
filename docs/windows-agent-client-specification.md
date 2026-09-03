# MTI Alert Windows Agent Client Specification

## Document Status
- Version: `0.4`
- Status: `Draft Baseline`
- Last Updated: `2026-08-26`
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
- recurring reminder lifecycle ownership, including versioning, expiry, and cancellation
- delivery state persistence
- auditability

The Windows Agent is responsible for:
- identifying the device to the server
- maintaining realtime connectivity
- reporting heartbeat and connection health
- receiving communication payloads
- synchronizing approved recurring reminder policies for bounded local execution
- rendering content according to policy
- reporting displayed, read, and response events
- reporting locally executed reminder occurrences and outcomes when connectivity is available

## Locked Client Platform Decisions
The following client-platform decisions are now considered the baseline for MVP implementation and should not be treated as open unless this document is revised again.

### Framework And App Mode
- desktop framework: `WPF`
- application mode: `tray-first desktop app`
- runtime behavior: the agent should start into background operation with a system tray presence and only surface full UI when interaction is required
- the primary user-facing runtime should not depend on a Windows Service for normal tray behavior, but rollout and lifecycle management may introduce a separate updater helper or service when explicitly documented

### Target Operating System
- supported OS baseline: `Windows 10` and `Windows 11`
- the client should avoid implementation choices that unnecessarily depend on Windows 11-only UI capabilities

### Packaging, Startup, And Update Model
- packaging baseline: `classic internal installer`, not `MSIX`, for MVP
- preferred package shape: `MSI` built for managed enterprise deployment, with silent install, silent uninstall, and upgrade support
- startup policy: `auto start at user login` is required
- preferred startup registration: installer-created `Scheduled Task at logon`; `Run` registry startup may exist only as a fallback
- deployment expectation: internal managed rollout by IT or operations for bootstrap and emergency recovery
- update policy baseline: hybrid centrally governed rollout. Routine update and uninstall may be initiated through the running agent, but execution must be delegated to a dedicated updater component rather than direct self-replacement by the tray app

### Rollout And Recovery Model
- bootstrap install should remain compatible with enterprise endpoint-management tooling such as `GPO`, `Intune`, `SCCM`, or `PDQ`
- the same endpoint-management path should remain available as the break-glass recovery and forced-removal channel
- the running agent may receive approved rollout intent from the server for update, repair, or uninstall orchestration
- the updater component must validate package origin, version intent, checksum, and signature before execution
- the server should send approved rollout metadata such as desired version, package location, checksum, signature, rollout scope, and deadline rather than arbitrary command text
- the client should report enough rollout telemetry for supportability, including current app version, updater state, startup-registration state, and the last rollout result when available

### Local Persistence And Logging Baseline
- local persistence is allowed and expected where it improves resilience
- preferred local persistence engine: `SQLite`
- local persistence may be used for pending queue state, deduplication markers, reconciliation helpers, versioned reminder policies, reminder execution markers, and lightweight cached client state
- local file logging is required for operational diagnostics
- telemetry forwarding is also desired; the client should keep logging and telemetry transport abstracted so local logging remains reliable even if remote telemetry is unavailable

### UI Quality Baseline
- the initial release should target an `enterprise-polished` UX baseline, not a merely minimal functional shell
- tray presence may stay lightweight, but modal, toast, and response surfaces should look intentional, production-ready, and operationally clear from the start
- wellness-oriented recurring reminders may intentionally use a brighter and friendlier visual language than the operational alert baseline, especially white surfaces with blue and green accents that match the approved eye-break and stretching mockups
- the client should support themed reminder templates so the same agent can render:
  - neutral operational notifications
  - blue eye-break reminder surfaces
  - green stretching reminder surfaces

### Device Identity Baseline
- the client should generate a stable `deviceIdentifier` during first install or first successful initialization
- the generated identifier must be persisted locally and reused across normal restarts and application updates
- `hostname` should be sent as supporting metadata, not used as the authoritative device identifier
- MVP should not rely on hardware serial or machine fingerprint as the primary identity source unless a later trust model explicitly requires it
- updates must preserve the existing local device identity and any persisted rollout state unless a controlled uninstall path explicitly removes them

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
- fetch approved reminder policies for bounded local execution
- execute synchronized routine reminder policies even when the server is temporarily unreachable
- render messages according to template policy
- render structured wellness reminder experiences when the policy payload provides specialized template, action, and step data
- support workflow responses
- report delivery lifecycle events accurately

## Server Dependencies Required By The Client
The client depends on the server providing:
- a device session endpoint
- a realtime negotiation endpoint
- a heartbeat endpoint
- a pending message retrieval or reconciliation endpoint
- a reminder policy sync endpoint for approved local routine reminders
- displayed acknowledgement endpoint
- read acknowledgement endpoint
- response submission endpoint
- a reminder occurrence event endpoint

These are represented in `docs/openapi.yaml` as:
- `POST /agent/session`
- `POST /agent/realtime/negotiate`
- `POST /agent/heartbeat`
- `GET /agent/messages`
- `GET /agent/reminder-policies`
- `POST /agent/messages/{messageId}/displayed`
- `POST /agent/messages/{messageId}/read`
- `POST /agent/messages/{messageId}/response`
- `POST /agent/reminder-policies/{policyId}/events`

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

### Current Implementation Baseline
The current server baseline for the first go-live slice uses:
- `POST /agent/realtime/negotiate` to return `transport = SSE`
- `GET /agent/realtime-hub` as the concrete realtime stream endpoint
- `Authorization: Bearer <sessionToken>` on the stream request
- `connectionUrl` query parameters supplied by the server for `connectionId` and `deviceIdentifier`

The client should treat this as the current working transport, while keeping the hub abstraction isolated enough to tolerate a later move to a different server technology.

### Validated MVP Runtime Baseline
The current runtime baseline has now been explicitly validated against the server implementation:
- session creation works before realtime negotiation
- realtime negotiation returns a fresh `connectionId` for reconnect
- opening the negotiated `SSE` stream returns `connected` followed by `messages.snapshot`
- reconnect requires a fresh negotiate step before opening the next stream
- publishing a Windows Agent-targeted communication while connected emits `messages.available`
- after reconnect, the agent can still recover the same pending communication through both `messages.snapshot` and `GET /agent/messages`

## Earliest Client Test Start Point
The Windows Agent engineer can start real integration testing against the server now.

The current server baseline is already sufficient for the first client-server test loop when the client can do at least:
- persist or reuse a stable `deviceIdentifier`
- call `POST /agent/session`
- call `POST /agent/realtime/negotiate`
- open `GET /agent/realtime-hub` over `SSE`
- call `POST /agent/heartbeat`
- call `GET /agent/messages` for reconciliation

This means the client engineer does **not** need to wait for:
- WhatsApp delivery work
- dashboard or reporting endpoints
- richer admin monitoring beyond the current thin visibility baseline
- final production-grade realtime technology beyond the current `SSE` transport
- complete reminder local-execution coverage for every future scenario

### Minimum First Integration Test
The first practical client-server integration test should cover only this narrow loop:
1. create or refresh the agent session
2. negotiate and open the realtime stream
3. send heartbeat successfully
4. receive `connected`
5. receive `messages.snapshot`
6. publish a Windows Agent-targeted communication from the admin side
7. observe `messages.available`
8. reconnect and recover the same communication through `GET /agent/messages`

### Recommended Implementation Order For The Client Engineer
To keep pace with the current backend readiness, implement and test in this order:
1. local device identity persistence
2. session creation
3. realtime negotiation and `SSE` stream handling
4. heartbeat loop
5. startup and reconnect reconciliation through `GET /agent/messages`
6. basic message rendering
7. displayed and read reporting
8. workflow response submission
9. reminder policy synchronization and local routine execution

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

Current Phase 4 note:
- `activeUserIdentifier` is now also used for best-effort directory enrichment on the backend so the admin device view can show the latest active AD user context such as department, title, mobile number, and employee ID when available.
- If the identifier is not found in the directory, the device may be shown as `NonEmployee` without changing device trust semantics.

### Implementation Guidance
The client should:
- persist a stable `deviceIdentifier`
- generate that identifier locally during first install or first initialization if one does not already exist
- treat the device session as the authoritative agent credential
- treat `hostname` as useful metadata but not as the canonical device identity
- avoid assuming employee binding is mandatory for desktop delivery
- send active user context only when available and trustworthy, because backend directory enrichment is only as good as the current signed-in user signal

## Connection And Startup Flow
Recommended client startup sequence:

1. Load or establish local device identity.
2. Call `POST /agent/session`.
3. Receive session token and device metadata.
4. Call `POST /agent/realtime/negotiate`.
5. Establish the `SSE` realtime stream using returned hub metadata and the current agent session token.
6. Start heartbeat cycle.
7. Call `GET /agent/messages` to reconcile any pending messages after startup or reconnect.
8. Call `GET /agent/reminder-policies` to refresh locally executable reminder policies.
9. Begin normal realtime event handling.

The tray application should auto start on user login and execute this sequence without requiring the user to manually open the full desktop UI.

Reconnect guidance for MVP:
- on disconnect, the client should negotiate again to obtain a new `connectionId`
- the client should not assume the previous realtime connection remains reusable after reconnect
- after reopening the stream, the client should still call `GET /agent/messages` as the recovery path even if `messages.snapshot` already arrives

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

### Current Stream Events
The current hub baseline emits:
- `connected`
- `messages.snapshot`
- `messages.available`

The client should:
- process `messages.snapshot` as the current server view after connect
- process `messages.available` as a prompt to ingest or refresh pending messages
- keep local deduplication in place because the server may emit the full active message set for a device instead of only the newest message

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

For MVP, the client may persist reconciliation and deduplication state locally in `SQLite` when that improves safe retry behavior and duplicate suppression.

## Routine Reminder Local Execution Model
### Applicability
Local recurring execution is allowed only for approved routine reminder policies, such as wellness or OHIH prompts.

It is not the default model for:
- critical alerts
- emergency communications
- ad hoc operational announcements

### Source Of Truth Rule
The server remains authoritative for:
- recurrence rule definition
- policy version
- enable or disable state
- expiration and cancellation

The agent must not invent or continue a reminder policy outside the validity window last approved by the server.

### Agent Execution Rule
When the server marks a reminder policy as locally executable, the agent may:
- store the policy locally
- evaluate the recurrence rule on-device
- render the reminder without requiring a fresh push from the server for each occurrence

The agent must:
- replace older policy versions with the newest accepted version
- stop local execution when the policy is expired, cancelled, or superseded
- avoid replaying a backlog of missed occurrences after long sleep or disconnection
- resume from the next eligible occurrence after reconnect or wake-up unless a future server contract says otherwise

### Audit And Reporting Rule
Local execution does not remove server auditability.

The agent should report reminder occurrence evidence such as:
- local trigger time
- displayed time
- read or interaction time when applicable
- dismissal, snooze, or response action when supported by policy

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
- keep approved local routine reminders running while the synchronized policy remains valid
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
- write local rotating log files suitable for operational support and field troubleshooting
- prepare structured telemetry emission through an abstraction so remote telemetry can be enabled without redesigning the logging pipeline
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

### Quality Bar
- the MVP should look operationally production-ready rather than prototype-like
- dialog layout, typography, spacing, and action emphasis should be clear enough for shared-device enterprise environments
- tray UI, modal UI, and response UI should feel visually consistent with one another
- the first wellness rendering slice may intentionally break away from the dark operational shell by using a dedicated white friendly card surface for eye-break reminders, as long as operational alerts remain on their existing alert-oriented surface

## Current Wellness Rendering Baseline
The current first client-side wellness rendering baseline is now:
- narrowed to `SimpleReminder` eye-break reminders first
- driven from `wellnessProgram` inside synced reminder policies
- rendered through a dedicated wellness-specific WPF window instead of the generic operational `NotificationWindow`
- currently themed for the approved `Blue` eye-break direction
- now consuming authored `title`, `body`, and `instruction` content consistently across the first eye-break template set instead of relying on fixed copy
- now supporting local countdown state inside the dedicated wellness surface for countdown-oriented eye-break layouts
- now persisting reminder activity locally when the agent cannot reach the backend yet, then retrying the queued reminder events after the session and sync loop recover
- now positioned as a smaller toast-like notice surface near the bottom-right work area instead of a centered modal-style card
- currently implemented for:
  - `ReminderCard`
  - `CountdownCard`
  - `OverviewCard`
  - `CompletionCard`

The following remain intentionally open after that first slice:
- green stretching visuals
- guided routine rendering
- progress indicators and multi-step guidance

## Recommended Client Architecture
Recommended internal client components:
- `Device Identity Service`
- `Session Service`
- `Realtime Connection Service`
- `Heartbeat Service`
- `Pending Message Sync Service`
- `Local Persistence Service`
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
- `docs/windows-agent-integration-checklist.md`
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

For the most practical execution order, endpoint-by-endpoint success criteria, and first integration test loop, use:
- `docs/windows-agent-integration-checklist.md`
