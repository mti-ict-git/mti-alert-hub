# MTI Alert Technical Implementation Plan

## Document Status
- Version: `0.2`
- Status: `Draft Baseline`
- Last Updated: `2026-09-01`

## Purpose
This document defines the recommended technical shape of the `MTI Alert` server so backend, frontend, and Windows Agent teams can work from one consistent implementation direction.

## System Positioning
`MTI Alert` is the central server platform. It is responsible for:
- administrative authentication and authorization
- communication lifecycle management
- audience resolution
- channel orchestration
- status tracking
- response collection
- reporting and auditability

It is not the desktop receiver itself. The `Windows Agent` is a separate client application, expected to be implemented in `C#`.
Administrative authentication should rely on LDAP or Active Directory, while authorization and scope mapping remain owned by MTI Alert.

## Recommended Architecture
### Logical Components
- `Admin API`: serves the web admin frontend.
- `Agent API`: serves the Windows Agent for device registration, realtime negotiation, acknowledgment, response submission, and heartbeat.
- `Realtime Hub`: maintains SignalR-style push connectivity for Windows Agent delivery and status callbacks.
- `Channel Connectors`: integration modules for WhatsApp and future channels.
- `Communication Engine`: handles communication lifecycle and orchestration.
- `Audience Resolver`: resolves targeting rules into concrete recipients.
- `Workflow Engine`: handles response models, template-driven policy, and recipient-only escalation timers for MVP.
- `Delivery Tracker`: stores attempts, status transitions, and channel events.
- `Reporting Layer`: provides dashboard and report queries.

### Suggested Backend Style
- Modular monolith for MVP.
- Clear domain boundaries by module.
- Event-friendly internal design to allow future asynchronous scaling.

## Suggested Modules
### 1. Auth And Access Module
- LDAP or Active Directory login and session/token issuance
- Local role and scope mapping
- Permission checks
- Phase 1 baseline may use opaque bearer session tokens backed by an in-memory session store until persistent session infrastructure is introduced
- Phase 1 baseline access mapping may default to a documented global scope placeholder before site and area scoped records are implemented

### 2. Organization Module
- Sites
- Areas
- Departments
- Sections
- Roles
- Employee directory references
- Scheduled batch HR synchronization for basic org data
- Limited override support where explicitly allowed

### 3. Communication Module
- Communication drafts
- Publication state
- Scheduling
- Recurrence
- Execution mode selection for recurring schedules, including bounded local routine reminder execution on Windows Agent
- Templates
- Template versioning and policy snapshots
- Template policies for response, presentation, targeting constraints, channel rules, and default delivery strategy
- Publish preview and confirmation workflow

### 4. Audience Module
- Audience rules
- Audience preview
- Saved groups
- Resolved recipient snapshots
- Device-by-location resolution for Windows Agent targeting

### 5. Workflow Module
- Response workflow definitions
- Response options
- Recipient-only escalation rules for MVP
- Ack and response semantics

### 6. Delivery Module
- Delivery jobs
- Delivery attempts
- Channel-specific payload rendering
- Delivery state reconciliation
- User-preference-aware channel selection
- Template-driven mandatory and optional channel rules
- Bounded retry orchestration

### 7. Windows Agent Module
- Device registration
- Pending device enrollment capture and admin approval workflow for unknown endpoints
- Realtime connection negotiation
- Device heartbeat
- Presence tracking
- Approved rollout intent retrieval for updater execution
- Updater lifecycle status reporting
- Push message dispatch
- Routine reminder policy sync for approved local reminder execution
- Delivery confirmation
- Display confirmation
- Read confirmation
- Response submission
- Local reminder occurrence reporting
- Client capability reporting
- Flat device metadata with site, area, and location label
- Location-owned device targeting support
- Wellness activity evidence that remains device-centric while optionally carrying the currently active Windows user as audit metadata when the endpoint can report it safely

### 8. WhatsApp Module
- Outbound message dispatch
- Template mapping
- Provider callback processing
- Inbound response parsing if used

### 9. Reporting And Audit Module
- Dashboard queries
- Historical reports
- Audit trails

## Recommended Technology Direction
The current repository already leans toward TypeScript for the admin application. For the server:

### Preferred
- `Node.js + TypeScript`
- `PostgreSQL`
- `Redis` for queueing, caching, or scheduling assistance
- `SignalR-compatible realtime layer` or equivalent hub-based push implementation for the Windows Agent contract
- `OpenAPI` as the authoritative API contract

### Acceptable Alternatives
- Another backend stack is acceptable only if the OpenAPI contract, workflows, and data model remain aligned with the documents.

## Communication Execution Model
### Authoring Stage
- Communication is created as `Draft`.
- Audience rules and channels are attached.
- Response workflow and schedule are configured.

### Publication Stage
- Audience resolver generates a recipient snapshot.
- Delivery jobs are created per recipient and per selected or policy-resolved channel.
- Communication state moves to `Queued` or `Sending`.
- Publish preview must resolve target audience, device counts, channel plan, and critical policy summary before final confirmation.

### Recurring Routine Reminder Stage
- The server remains the authoritative owner of the recurrence rule, execution mode, policy version, and cancellation state.
- Recurring schedules may execute in one of two modes:
  - `ServerGenerated` for normal scheduled execution
  - `AgentLocalRoutine` for approved Windows Agent reminder policies that must remain reliable during temporary disconnection
- For `AgentLocalRoutine`, the server materializes a versioned reminder policy with a bounded validity window for eligible devices.
- The agent executes only the synchronized policy window and must stop using a policy when it is expired, replaced, or cancelled by the server.

### Delivery Stage
- Channel connector or realtime hub attempts delivery.
- Delivery attempt records are written.
- Recipient channel status is updated as callbacks or agent confirmations arrive.
- Employee channel preference influences the default initial channel choice when multiple eligible channels are available.
- Critical templates may override normal preference flow using desktop-first with short-delay WhatsApp dual-path behavior.
- Agent delivery retries must be bounded by configurable policy.
- Locally executed routine reminders must reconcile occurrence and interaction evidence back to the server when connectivity is available.

### Response Stage
- If response is required, recipients enter `AwaitingResponse`.
- Responses update workflow tracking and dashboards.
- In MVP, overdue timers may trigger recipient-only follow-up behavior such as re-alerting the same recipient.
- A workflow response should also satisfy acknowledgment in MVP.

## Windows Agent Integration Direction
### Responsibilities Of The Agent
- Register the device and user context with the server.
- Establish and maintain a realtime connection using the server's SignalR-style contract.
- Send periodic heartbeat.
- Receive pushed communications in near real time.
- Synchronize approved recurring reminder policies for bounded local execution.
- Execute approved routine reminder policies locally within the server-defined validity window.
- Render desktop notifications using policy-driven behavior.
- Show critical communications as immediate modal alerts in MVP.
- Report `Displayed` only when content is actually rendered on the device.
- Report `Read` only after real interaction occurs.
- Confirm display, read, and user response.
- Report locally executed reminder occurrences and outcomes when the server becomes reachable.

### Minimum Agent API Needs
- authenticate or register device session
- capture unknown device enrollment requests without silently auto-trusting the endpoint
- negotiate realtime connection or obtain hub credentials
- send heartbeat
- fetch approved rollout intent metadata for updater execution
- receive or reconcile pending messages
- fetch active reminder policies eligible for local execution
- acknowledge display state
- acknowledge display/read
- submit workflow response
- submit reminder occurrence or local interaction events
- submit updater lifecycle status for rollout visibility
- report agent version and device state
- report active user context only as optional audit metadata and shared-device replay suppression input, not as the primary desktop recipient identity

## WhatsApp Integration Direction
### Responsibilities Of The Server
- Render channel-specific WhatsApp payloads from the unified communication source.
- Dispatch through the configured provider or gateway.
- Receive webhook callbacks for delivery state changes.
- Map delivery state back to the communication and recipient model.
- Only promote WhatsApp to `Read` when a provider or gateway emits a real read receipt.

## Data Strategy
- Use normalized operational tables for authoritative state.
- Use append-only event records for status transitions where possible.
- Keep resolved audience snapshots to preserve historical targeting truth even if org structure later changes.
- Store template policy and channel preference state needed for delivery decisions and auditability.
- Store template version snapshots on communications and delivery records when policy materially affects execution.
- Store recurring schedule execution mode, schedule version, and bounded validity windows when local routine reminder execution is enabled.
- Keep Windows Agent pending-message reconciliation bounded by the server-authoritative schedule window, and apply a finite replay TTL for one-time desktop delivery when no explicit validity window exists.
- Preserve local reminder occurrence evidence after reconciliation so monitoring and audit trails remain server-queryable.
- Keep flat device records with site, area, and location metadata directly on the device model for MVP simplicity.
- Treat wellness-program assignment and execution evidence as device-primary in MVP. Optional active-user context may enrich auditability, but it must not replace device identity as the authoritative assignment boundary on shared endpoints.

## Security Direction
- Enforce authentication for all admin APIs.
- Enforce scoped authorization for all create, publish, and report actions.
- Protect agent endpoints with device credentials, signed tokens, or equivalent secure mechanism.
- Keep Windows Agent trust server-owned: unknown endpoints may appear in a pending enrollment queue, but they must not create trusted sessions until an admin approves them into the device baseline.
- Log high-risk actions such as publish, cancel, scope changes, and role changes.
- Block template-locked field overrides at the API layer and return explicit validation errors.

## Observability
- Structured logs per module
- Audit log for product actions
- Connector health monitoring
- Delivery error tracking by channel
- Heartbeat freshness visibility for Windows Agents
- Realtime connection health and stale connection visibility for Windows Agents
- Preview-to-publish auditability for critical communications

## API Contract Rules
- `docs/openapi.yaml` is the source of truth for backend contract.
- Backend behavior changes must update the OpenAPI contract.
- Frontend and Windows Agent integrations should be generated or validated against the OpenAPI spec where practical.

## Implementation Notes For AI Builders
- Treat `Communication` as the primary aggregate root.
- Do not create separate engines for reminders, alerts, and news unless the specification is updated.
- Preserve role scope enforcement as a backend rule, not only a frontend restriction.
- Keep channel-specific logic behind connector boundaries.
- Model recipient delivery and recipient response separately.
- Implement template-driven policy as backend behavior, not only UI metadata.
- Do not add approval gates to MVP publication unless the specification is updated.
- Treat Windows Agent desktop targeting as device-centric and location-oriented for MVP.
- Keep site and area as the primary scope dimensions for device-targeted desktop delivery.
