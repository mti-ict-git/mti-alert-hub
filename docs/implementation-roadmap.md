# MTI Alert Implementation Roadmap

## Document Status
- Version: `0.3`
- Status: `Active`
- Last Updated: `2026-07-08`

## Active Phase
- `Phase 2 - Delivery Orchestration`

## Roadmap Execution Gate
- Every roadmap checklist step must include a matching challenge/verification activity before it can be marked complete.
- Challenge/verification must test the changed behavior, contract, workflow path, authorization path, or failure path relevant to that step.
- Completion evidence must be written into the owning phase `Challenge / Verification` section or a referenced supporting verification document before status changes are declared.
- A checked checklist item without recorded verification evidence is treated as `not yet complete`.

## Phase 0 - Documentation Baseline
### Status
- `Completed`

### Objective
Establish the baseline source-of-truth documentation for the MTI Alert server so implementation can proceed with explicit product, workflow, data, and API guidance.

### Source Documents
- `docs/project-plan.md`
- `docs/product-principles.md`
- `docs/functional-specification.md`
- `docs/technical-implementation-plan.md`
- `docs/database-schema-specification.md`
- `docs/openapi.yaml`
- `docs/open-questions-and-challenges.md`
- `docs/template-policy-schema.md`

### Supporting Documents
- `docs/architecture-decisions.md`
- `docs/testing-strategy.md`
- `docs/deployment-and-environment.md`
- `docs/windows-agent-client-specification.md`
- `docs/backend-module-breakdown.md`
- `docs/phase-1-execution-plan.md`

### Checklist
- `[x]` Documentation baseline: define the project vision and MVP scope.
- `[x]` Documentation baseline: define product principles and operating constraints.
- `[x]` Documentation baseline: define functional domains and key workflows.
- `[x]` Documentation baseline: define conceptual backend architecture.
- `[x]` Documentation baseline: define conceptual database schema.
- `[x]` Documentation baseline: define the initial OpenAPI contract.
- `[x]` Documentation baseline: record unresolved questions and challenges.
- `[x]` Documentation refinement: align the mandatory documents with user decisions.
- `[x]` Documentation refinement: add supporting references where ambiguity remained high.
- `[x]` Documentation refinement: add template policy schema support.
- `[x]` Documentation refinement: align the OpenAPI contract with phased implementation boundaries and reusable contract patterns.
- `[x]` Documentation refinement: add backend module breakdown guidance for implementation planning.
- `[x]` Documentation refinement: add a Phase 1 execution plan for implementation sequencing and verification.

### Output
- A complete baseline documentation package in `docs/`.
- Repository entry documents should guide humans and AI agents into the authoritative `docs/` set.
- Supporting schema references may be added when they reduce implementation ambiguity.

### Challenge / Verification
- Verification target: required documentation files exist and form a coherent baseline for implementation.
- Challenge: key architecture decisions were narrowed, but several implementation details remain open and are tracked in `docs/open-questions-and-challenges.md`.
- Evidence: mandatory baseline documents were created and refined against explicit user decisions on `2026-07-06`, then extended with supporting baseline references, a template policy schema reference, repository entry documentation guidance, a more implementation-ready phased OpenAPI contract, backend module breakdown guidance, and a dedicated Phase 1 execution plan on `2026-07-06`.

## Phase 1 - Core Backend Foundation
### Status
- `Completed`

### Objective
Implement the core backend foundation for authentication, role scope enforcement, organization data, communication management, and audience resolution.

### Source Documents
- `docs/project-plan.md`
- `docs/functional-specification.md`
- `docs/technical-implementation-plan.md`
- `docs/database-schema-specification.md`
- `docs/openapi.yaml`

### Supporting Documents
- `docs/architecture-decisions.md`
- `docs/testing-strategy.md`
- `docs/deployment-and-environment.md`
- `docs/template-policy-schema.md`
- `docs/windows-agent-client-specification.md`
- `docs/backend-module-breakdown.md`
- `docs/phase-1-execution-plan.md`

### Checklist
- `[x]` Application baseline: scaffold the backend runtime, config loading, database bootstrap placeholder, request validation utility, shared error handling, and health endpoint.
- `[x]` Auth foundation: define the concrete LDAP or AD login flow.
- `[x]` Auth foundation: define session or token strategy for admin APIs.
- `[x]` Auth foundation: implement `login`, `logout`, and `me` endpoints.
- `[x]` Authorization: define local role mapping and site or area scope model.
- `[x]` Authorization: implement backend scope enforcement guards.
- `[x]` Authorization: challenge unauthorized access scenarios and expected errors.
- `[x]` Database foundation: implement versioned migrations and initial schema for auth, organization, employee, and device tables.
- `[x]` Organization data: defer the HR sync ingestion contract from Phase 1 and record the non-blocking go-live decision. `Deferred To Post-Go-Live`
- `[x]` Organization data: implement reference endpoints for sites, areas, departments, and sections.
- `[x]` Organization data: implement sync-safe read models for employees and devices.
- `[x]` Communication drafts: implement draft create, get, update, and duplicate rules.
- `[x]` Communication drafts: enforce template-locked field validation in the API layer.
- `[x]` Audience preview: implement target resolution for site, area, employee, group, and device target types.
- `[x]` Audience preview: implement publish preview output with recipient counts and channel plan.
- `[x]` Frontend integration: replace mock auth and draft services with backend-backed service calls.
- `[x]` Frontend integration: validate that admin flows still work against the new contract.

### Output
- Running backend foundation with documented API coverage.
- Initial backend modules exist for auth, authorization, organization references, communication drafts, and audience preview.

### Challenge / Verification
- Milestone 0 scaffold builds a separate `backend/` runtime foundation without changing current business behavior.
- Milestone 1 and Milestone 2 baseline currently use LDAP-backed admin authentication, opaque in-memory bearer sessions, role metadata, and a documented global-scope placeholder until organization-scoped records arrive.
- Versioned migration support now exists through `backend:migrate` and `backend:migrate:status`, with the initial Phase 1 foundation schema recorded in `backend/migrations/0001_phase1_foundation.up.sql`.
- Milestone 3 and Milestone 4 baseline now expose `GET /reference/organization`, `GET /reference/sites`, `GET /reference/areas`, `GET /reference/departments`, `GET /reference/sections`, `GET /employees`, and `GET /devices`.
- Live PostgreSQL connectivity was verified against the target `ictMTIAlertHub` database on `2026-07-07`, and the initial schema migration has now been applied for `users`, `user_scopes`, `sites`, `areas`, `departments`, `sections`, `employees`, and `devices`.
- Build and typecheck pass.
- API contract matches implementation.
- Authorization scope is challenged with unauthorized access scenarios.
- Representative authenticated smoke tests for organization and device endpoints return `200`, and an unauthenticated `GET /devices` request returns `401`.
- Table existence and zero-row baseline were verified after migration application, confirming that current empty-state endpoint responses now come from unseeded tables rather than missing schema.
- Admin login, template selection, draft authoring, draft detail, draft update, draft duplication, and audience preview flows now consume backend-backed services instead of relying on mock notification state or static targeting references.
- Employee directory, device list, and dashboard summary metrics now consume backend-backed read models for employees and devices, while unsupported mutate actions remain explicitly disabled at the UI layer.
- Publish preview output is challenged with representative target combinations.
- `2026-07-08`: targeted API verification confirms `POST /communications`, `GET /communications/{communicationId}`, `PATCH /communications/{communicationId}`, `POST /communications/{communicationId}/duplicate`, and `POST /communications/{communicationId}/audience-preview` all work against the live database-backed runtime.
- `2026-07-08`: template-locked field enforcement is challenged by attempting to remove a mandatory template channel, and the API correctly returns `422 MANDATORY_CHANNEL_REQUIRED`.
- `2026-07-08`: saved-group audience resolution is now backed by `audience_groups` and `audience_group_members`, and representative `Group` plus `Device` target previews return expected recipients with zero preview warnings.
- Go-live fast-track decision on `2026-07-07`: HR or organization baseline ingestion is not treated as a go-live blocker and is explicitly deferred until after the first live release unless operational needs force it back into scope.
- `2026-07-08`: frontend-to-backend CORS compatibility was updated for local Phase 1 admin verification origins on `4173` and `5173`, and direct preflight plus authenticated login requests from the frontend origin to the backend verification runtime returned the expected headers and `200` login response.
- `2026-07-08`: frontend smoke verification remains partially constrained by the current browser automation environment because cross-port localhost requests from the tool fail with `net::ERR_FAILED`, but the Phase 1 admin contract was still challenged through successful frontend build, backend-backed service wiring, and direct runtime checks against the same frontend origin and backend target.

## Phase 2 - Delivery Orchestration
### Status
- `In Progress`

### Objective
Implement communication publication, scheduling, recipient snapshots, delivery job orchestration, and routine reminder policy distribution for Windows Agent and WhatsApp.

### Source Documents
- `docs/functional-specification.md`
- `docs/technical-implementation-plan.md`
- `docs/database-schema-specification.md`
- `docs/openapi.yaml`
- `docs/open-questions-and-challenges.md`

### Supporting Documents
- `docs/architecture-decisions.md`
- `docs/testing-strategy.md`
- `docs/deployment-and-environment.md`
- `docs/template-policy-schema.md`
- `docs/windows-agent-client-specification.md`
- `docs/backend-module-breakdown.md`
- `docs/phase-2-agent-minimum-slice-plan.md`

### Checklist
- `[x]` Slice 2.1 Publish guardrails: require confirmed preview and reject publish attempts for non-draft communications.
- `[x]` Slice 2.1 Publish guardrails: validate `publishMode`, `scheduledAt`, `recurrenceRule`, `timezone`, `executionMode`, and `validUntil` combinations before state changes.
- `[x]` Slice 2.1 Publish guardrails: reject template-policy violations that would make execution behavior ambiguous at publish time.
- `[x]` Slice 2.2 Immediate publish acceptance: implement `publish now` state transition from `Draft` into an execution-ready backend state.
- `[x]` Slice 2.2 Immediate publish acceptance: persist the operator-confirmed publish request together with effective publish metadata needed by downstream orchestration.
- `[x]` Slice 2.3 Scheduled publication foundation: persist one-time scheduled publication with the authoritative schedule timestamp and timezone context.
- `[x]` Slice 2.3 Scheduled publication foundation: implement cancel validation and the state transition for scheduled or active communications through `POST /communications/{communicationId}/cancel`.
- `[x]` Slice 2.4 Recurring schedule foundation: persist recurring schedule definition, execution mode, version, and cancellation state on the server.
- `[x]` Slice 2.4 Recurring schedule foundation: distinguish server-generated recurring execution from approved Windows Agent local routine reminder policy execution.
- `[x]` Slice 2.5 Recipient snapshot foundation: generate immutable recipient snapshots for device-targeted and contact-targeted recipients at publish time.
- `[x]` Slice 2.5 Recipient snapshot foundation: persist template version, workflow version reference, and effective policy snapshot with the execution record.
- `[x]` Slice 2.6 Delivery job foundation: create delivery jobs per recipient and per selected channel from the publish snapshot.
- `[x]` Slice 2.6 Delivery job foundation: persist delivery attempt records, bounded retry metadata, and normalized channel lifecycle status transitions.
- `[x]` Slice 2.7 Windows Agent minimum trust: implement persisted device session issuance and validation for `POST /agent/session`.
- `[x]` Slice 2.7 Windows Agent minimum trust: implement authenticated `POST /agent/heartbeat` with device-session ownership checks and device health refresh.
- `[x]` Slice 2.8 Windows Agent reconciliation: implement `GET /agent/messages` as contract-valid pending-message reconciliation, including safe empty-state behavior.
- `[x]` Slice 2.8 Windows Agent reconciliation: implement idempotent `Displayed` and `Read` evidence ingestion for `POST /agent/messages/{messageId}/displayed` and `POST /agent/messages/{messageId}/read`.
- `[x]` Slice 2.8 Windows Agent reconciliation: implement `POST /agent/messages/{messageId}/response` using workflow-aware response validation when the published communication requires a response.
- `[ ]` Slice 2.9 Realtime compatibility boundary: implement `POST /agent/realtime/negotiate` so the server can return concrete negotiation metadata instead of placeholders.
- `[ ]` Slice 2.9 Reminder policy sync: implement `GET /agent/reminder-policies` plus policy invalidation semantics for approved local routine reminders.
- `[ ]` Slice 2.9 Reminder policy sync: implement `POST /agent/reminder-policies/{policyId}/events` for local occurrence and sync-state reporting.
- `[ ]` Slice 2.10 WhatsApp connector boundary: implement outbound provider interface, callback ingestion contract, and delivery-state normalization.
- `[ ]` Slice 2.10 WhatsApp connector boundary: map actual provider delivery and read receipts into MTI Alert delivery lifecycle states without over-claiming `Read`.
- `[ ]` Slice 2.11 Frontend publish integration: replace mock publish, cancel, delivery, and device-monitoring service calls with backend-backed integrations.
- `[ ]` Slice 2.11 Frontend publish integration: validate the admin publish and delivery monitoring flow against the new Phase 2 contract.

### Output
- Backend supports end-to-end communication dispatch orchestration.
- Delivery orchestration exists for both Windows Agent and WhatsApp with status persistence and retry behavior.
- Routine reminder policies can be synchronized to Windows Agent for bounded local execution without changing server ownership of schedule lifecycle.

### Challenge / Verification
- Scheduled and immediate communications are both verified.
- Approved local routine reminders remain functional across disconnect and reconnect scenarios.
- Failed delivery paths are challenged.
- Delivery state rollup is validated for multi-channel recipients.
- Disconnected-agent recovery is challenged with pending-message reconciliation scenarios.
- `2026-07-08`: Slice 2.1 publish guardrails are now enforced through `POST /communications/{communicationId}/publish`, including draft-only publish, required preview confirmation, scheduling field-combination checks, recurring reminder execution validation, and publish-time template policy consistency checks.
- `2026-07-08`: focused runtime verification against a dedicated backend instance confirmed `422 PREVIEW_CONFIRMATION_REQUIRED`, `422 TIMEZONE_REQUIRED`, `422 TEMPLATE_POLICY_REFERENCE_REQUIRED`, `409 COMMUNICATION_NOT_DRAFT`, and `409 PUBLISH_ACCEPTANCE_NOT_READY`, while `POST /communications/{communicationId}/audience-preview` still returned `200` with resolved recipients for the same draft under test.
- `2026-07-08`: Slice 2.2 now accepts `publishMode = Now` through `POST /communications/{communicationId}/publish`, transitions the communication from `Draft` into `Queued`, and persists an `Immediate` record in `communication_schedules` together with the validated publish request snapshot and actor metadata needed by downstream orchestration.
- `2026-07-08`: Slice 2.3 now accepts one-time scheduled publication through `POST /communications/{communicationId}/publish`, persists timezone-aware schedule metadata in `communication_schedules`, and supports `POST /communications/{communicationId}/cancel` for `Scheduled`, `Queued`, `Sending`, and `Active` communications by transitioning them to `Cancelled` and deactivating the active schedule record.
- `2026-07-08`: Slice 2.4 now accepts recurring publication through `POST /communications/{communicationId}/publish`, persists `Recurring` schedule records with `execution_mode`, validity metadata, and cancellation state in `communication_schedules`, and uses the persisted `execution_mode` to distinguish `ServerGenerated` recurring execution from `AgentLocalRoutine` foundation behavior.
- `2026-07-08`: focused runtime verification against a dedicated backend instance on `BACKEND_PORT=4012` confirmed `publishMode = Now` returns `200` with communication status `Queued`, `publishMode = Scheduled` returns `200` with communication status `Scheduled`, `publishMode = Recurring` returns `200` with communication status `Scheduled`, scheduled cancellation returns `200` with communication status `Cancelled`, and `communication_schedules` persisted the expected `Immediate`, `Scheduled`, and `Recurring` records with the expected active-state transitions.
- `2026-07-08`: Slice 2.5 now writes immutable `communication_recipients` snapshots during publish acceptance for `Device`, `Employee`, and `ContactEndpoint` recipients, carrying template version, workflow reference, and effective policy snapshot data with the execution record.
- `2026-07-08`: Slice 2.6 now writes `delivery_jobs`, initial `delivery_attempts`, and append-only `delivery_events` from the publish snapshot, including bounded retry metadata and cancellation-to-failed normalization for pending jobs when a scheduled communication is cancelled.
- `2026-07-08`: focused runtime verification against a dedicated backend instance on `BACKEND_PORT=4013` confirmed immediate, scheduled, and recurring publish acceptance produced the expected recipient snapshot mix, created per-channel delivery jobs, persisted initial attempts and `Queued` events, and transitioned pending scheduled jobs into `Failed` plus `AdminApi` failure events when the communication was cancelled.
- Compatibility baseline added on `2026-07-08`: the backend now exposes `POST /agent/session`, `POST /agent/realtime/negotiate`, `POST /agent/heartbeat`, `GET /agent/messages`, `GET /agent/reminder-policies`, `POST /agent/messages/{messageId}/displayed`, `POST /agent/messages/{messageId}/read`, `POST /agent/messages/{messageId}/response`, and `POST /agent/reminder-policies/{policyId}/events`.
- Current limitation for that baseline: realtime negotiation still returns placeholder hub metadata, and reminder-policy synchronization remains an empty-safe compatibility handler until local routine policy persistence is implemented.
- Verification evidence on `2026-07-08`: `npm run backend:typecheck` passed, `npm run backend:build` passed, and `npm run backend:migrate:dev` applied `0005_phase2_communication_schedules.up.sql` plus `0006_phase2_delivery_foundation.up.sql` after implementing publish, cancel, recipient snapshot, and delivery foundation persistence.
- `2026-07-08`: Slice 2.7 now persists `POST /agent/session` trust in `device_sessions`, rotates the device token on session refresh, renews expiry on authenticated agent usage, and uses persisted device ownership to validate `POST /agent/heartbeat` before updating device freshness metadata.
- `2026-07-08`: focused runtime verification against a dedicated backend instance on `BACKEND_PORT=4014` confirmed a registered device receives `200` from `POST /agent/session`, exactly one persisted `device_sessions` row remains for that device after session refresh, `POST /agent/heartbeat` returns `204` and updates `devices.last_heartbeat_at` plus `status`, and the replaced token is rejected with `401 UNAUTHORIZED`.
- `2026-07-08`: Slice 2.8 now serves `GET /agent/messages` from persisted `delivery_jobs` plus `communication_recipients`, records idempotent `Displayed` and `Read` delivery events from the Windows Agent, and accepts workflow-validated `POST /agent/messages/{messageId}/response` by transitioning the message into `Responded` while updating recipient response and acknowledgement state.
- `2026-07-08`: focused runtime verification against a dedicated backend instance on `BACKEND_PORT=4015` with `LDAP_ALLOWED_GROUPS=''` confirmed an admin can create and publish a Windows Agent-targeted communication, the target device receives exactly one pending message from `GET /agent/messages`, duplicate `Displayed` and `Read` submissions remain `204` and create only one lifecycle event each, `POST /agent/messages/{messageId}/response` returns `200`, the delivery job transitions to `Responded`, recipient state becomes `Responded` plus `Acknowledged`, and the message no longer appears in reconciliation after response submission.

## Phase 3 - Response Workflow And Monitoring
### Status
- `Pending`

### Objective
Implement recipient response workflows, status monitoring, dashboards, and audit-driven reporting.

### Source Documents
- `docs/functional-specification.md`
- `docs/technical-implementation-plan.md`
- `docs/database-schema-specification.md`
- `docs/openapi.yaml`

### Supporting Documents
- `docs/architecture-decisions.md`
- `docs/testing-strategy.md`
- `docs/template-policy-schema.md`
- `docs/windows-agent-client-specification.md`
- `docs/backend-module-breakdown.md`

### Checklist
- `[ ]` Workflow management: implement workflow definition CRUD or managed seed loading.
- `[ ]` Workflow management: implement workflow option validation rules.
- `[ ]` Response handling: implement response submission for Windows Agent and compatible channel responses.
- `[ ]` Response handling: enforce `response implies ack` semantics in the backend.
- `[ ]` Response handling: store actor context as optional audit metadata where available.
- `[ ]` Monitoring: implement communication-level monitoring endpoints.
- `[ ]` Monitoring: implement recipient-level monitoring endpoints with device and contact distinctions.
- `[ ]` Monitoring: implement dashboard summary endpoints and aggregation queries.
- `[ ]` Monitoring: implement delivery and response state rollups for tracked content types.
- `[ ]` Overdue handling: implement timeout evaluation and recipient-only follow-up triggers.
- `[ ]` Auditability: implement audit logging for publish, cancel, override rejection, response, and state transitions.
- `[ ]` Frontend integration: replace mock reports, dashboards, and response summary services with backend-backed calls.

### Output
- Backend supports monitored response workflows and operational reporting.
- Reporting and monitoring are backed by persisted delivery, response, and audit records.

### Challenge / Verification
- Response state transitions are validated.
- Overdue cases are challenged.
- Dashboard counts reconcile with source records.
- Audit records are challenged against representative lifecycle events.

## Phase 4 - Hardening And Expansion
### Status
- `Pending`

### Objective
Prepare the platform for broader rollout and future channels.

### Source Documents
- `docs/project-plan.md`
- `docs/technical-implementation-plan.md`
- `docs/open-questions-and-challenges.md`
- `docs/openapi.yaml`

### Supporting Documents
- `docs/architecture-decisions.md`
- `docs/testing-strategy.md`
- `docs/deployment-and-environment.md`

### Checklist
- `[ ]` Channel expansion: define and document the email connector contract.
- `[ ]` Channel expansion: implement email delivery orchestration if included in scope.
- `[ ]` Channel expansion: define and document the digital signage connector contract.
- `[ ]` Channel expansion: implement digital signage orchestration if included in scope.
- `[ ]` Observability: harden logging, tracing, and operational alerting.
- `[ ]` Observability: improve connector-health and realtime-hub diagnostics.
- `[ ]` Security: harden session handling, token rotation, and agent trust controls.
- `[ ]` Security: review directory integration security settings and environment handling.
- `[ ]` Reporting: expand historical reporting and export capability.
- `[ ]` Operations: define deployment, rollback, and incident-response runbook guidance.
- `[ ]` Documentation: update source docs and supporting docs for any post-MVP contract changes.

### Output
- Hardened platform with clearer path to post-MVP expansion.
- Operational and security guidance is documented for production-oriented rollout.

### Challenge / Verification
- New channel contracts are documented.
- Operational failure recovery is challenged.
- Security-sensitive actions are re-verified.
- Production-oriented deployment and rollback assumptions are challenged.
