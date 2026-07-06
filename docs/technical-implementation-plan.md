# MTI Alert Technical Implementation Plan

## Document Status
- Version: `0.1`
- Status: `Draft Baseline`
- Last Updated: `2026-07-06`

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
- Admin login and session/token issuance
- User roles and scope enforcement
- Permission checks

### 2. Organization Module
- Sites
- Departments
- Sections
- Roles
- Employee directory references
- Import, synchronization, and limited override support

### 3. Communication Module
- Communication drafts
- Publication state
- Scheduling
- Recurrence
- Templates
- Template policies for response, presentation, and default delivery strategy

### 4. Audience Module
- Audience rules
- Audience preview
- Saved groups
- Resolved recipient snapshots

### 5. Workflow Module
- Response workflow definitions
- Response options
- Escalation rules

### 6. Delivery Module
- Delivery jobs
- Delivery attempts
- Channel-specific payload rendering
- Delivery state reconciliation
- User-preference-aware channel selection

### 7. Windows Agent Module
- Device registration
- Realtime connection negotiation
- Device heartbeat
- Presence tracking
- Push message dispatch
- Delivery confirmation
- Display confirmation
- Read confirmation
- Response submission
- Client capability reporting

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

### Delivery Stage
- Channel connector or realtime hub attempts delivery.
- Delivery attempt records are written.
- Recipient channel status is updated as callbacks or agent confirmations arrive.
- Employee channel preference influences the default initial channel choice when multiple eligible channels are available.

### Response Stage
- If response is required, recipients enter `AwaitingResponse`.
- Responses update workflow tracking and dashboards.
- In MVP, overdue timers may trigger recipient-only follow-up behavior such as re-alerting the same recipient.

## Windows Agent Integration Direction
### Responsibilities Of The Agent
- Register the device and user context with the server.
- Establish and maintain a realtime connection using the server's SignalR-style contract.
- Send periodic heartbeat.
- Receive pushed communications in near real time.
- Render desktop notifications using policy-driven behavior.
- Show critical communications as immediate modal alerts in MVP.
- Confirm display, read, and user response.

### Minimum Agent API Needs
- authenticate or register device session
- negotiate realtime connection or obtain hub credentials
- send heartbeat
- receive or reconcile pending messages
- acknowledge display state
- acknowledge display/read
- submit workflow response
- report agent version and device state

## WhatsApp Integration Direction
### Responsibilities Of The Server
- Render channel-specific WhatsApp payloads from the unified communication source.
- Dispatch through the configured provider or gateway.
- Receive webhook callbacks for delivery state changes.
- Map delivery state back to the communication and recipient model.

## Data Strategy
- Use normalized operational tables for authoritative state.
- Use append-only event records for status transitions where possible.
- Keep resolved audience snapshots to preserve historical targeting truth even if org structure later changes.
- Store template policy and channel preference state needed for delivery decisions and auditability.

## Security Direction
- Enforce authentication for all admin APIs.
- Enforce scoped authorization for all create, publish, and report actions.
- Protect agent endpoints with device credentials, signed tokens, or equivalent secure mechanism.
- Log high-risk actions such as publish, cancel, scope changes, and role changes.

## Observability
- Structured logs per module
- Audit log for product actions
- Connector health monitoring
- Delivery error tracking by channel
- Heartbeat freshness visibility for Windows Agents
- Realtime connection health and stale connection visibility for Windows Agents

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
