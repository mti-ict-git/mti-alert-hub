# MTI Alert Implementation Roadmap

## Document Status
- Version: `0.3`
- Status: `Active`
- Last Updated: `2026-07-09`

## Active Phase
- `Phase 4 - Hardening And Expansion`

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
- `2026-07-09`: the local development CORS allowlist was expanded to also accept common frontend dev origins on `3000`, `3001`, and `8080` for both `localhost` and `127.0.0.1`, preventing admin UI login failures caused by origin mismatch while preserving the explicit allowlist model.
- `2026-07-08`: frontend smoke verification remains partially constrained by the current browser automation environment because cross-port localhost requests from the tool fail with `net::ERR_FAILED`, but the Phase 1 admin contract was still challenged through successful frontend build, backend-backed service wiring, and direct runtime checks against the same frontend origin and backend target.

## Phase 2 - Delivery Orchestration
### Status
- `In Progress`

### Objective
Implement communication publication, scheduling, recipient snapshots, delivery job orchestration, and routine reminder policy distribution, with the first live release focused on Windows Agent connectivity before WhatsApp provider integration.

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
- `[x]` Slice 2.9 Realtime compatibility boundary: implement `POST /agent/realtime/negotiate` so the server can return concrete negotiation metadata instead of placeholders.
- `[x]` Slice 2.9 Reminder policy sync: implement `GET /agent/reminder-policies` plus policy invalidation semantics for approved local routine reminders.
- `[x]` Slice 2.9 Reminder policy sync: implement `POST /agent/reminder-policies/{policyId}/events` for local occurrence and sync-state reporting.
- `[ ]` Slice 2.10 WhatsApp connector boundary: implement outbound provider interface, callback ingestion contract, and delivery-state normalization. Deferred until after the first Windows Agent go-live release.
- `[ ]` Slice 2.10 WhatsApp connector boundary: map actual provider delivery and read receipts into MTI Alert delivery lifecycle states without over-claiming `Read`. Deferred until after the first Windows Agent go-live release.
- `[x]` Slice 2.11 Frontend publish integration: replace mock publish and cancel service calls with backend-backed integrations on the admin notification flow.
- `[x]` Slice 2.11 Frontend publish integration: replace mock delivery and device-monitoring service calls with backend-backed visibility aligned to the Phase 2 contract.
- `[x]` Slice 2.11 Frontend publish integration: validate the admin publish and delivery monitoring flow against the new Phase 2 contract.

### Output
- Backend supports end-to-end Windows Agent communication dispatch orchestration for the first live release.
- Windows Agent delivery orchestration, reconciliation, and routine reminder sync are ready to serve the initial client go-live path.
- WhatsApp provider delivery orchestration is explicitly deferred until after the first Windows Agent go-live release.
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
- Compatibility baseline expanded on `2026-07-08`: the backend now also exposes `GET /agent/realtime-hub` as the first working `SSE` hub transport, emits `connected`, `messages.snapshot`, and `messages.available` events, and pushes queued Windows Agent delivery jobs to currently connected devices while preserving reconciliation through `GET /agent/messages`.
- Current limitation for that baseline: the first compatible hub still reuses the persisted agent session token, currently emits the active message set for a device instead of a strictly delta-only stream, and local routine reminder sync remains limited to device-bound Windows Agent recurring recipients.
- `2026-07-08`: delivery scope was reprioritized for the first live release so Windows Agent connectivity is the release-critical path, while `Slice 2.10 WhatsApp connector boundary` is intentionally deferred until after the desktop client go-live milestone.
- `2026-07-08`: the current first-release blocker review is captured in `docs/go-live-checklist.md`, with the concrete realtime hub endpoint and the final operator publish path called out as the remaining release-critical gaps for the Windows Agent go-live path.
- `2026-07-08`: the concrete realtime hub endpoint gap is now closed through a first compatible `SSE` slice, so the remaining first-release blocker is the final operator publish path if the admin UI is included in the release scope.
- `2026-07-08`: the admin notification UI now uses backend-backed `publish` and `cancel` actions on the detail flow, including immediate and scheduled publish confirmation, while delivery monitoring and device-support visibility remain the unfinished frontend portion of `Slice 2.11`.
- Verification evidence on `2026-07-08`: `npm run backend:typecheck` passed, `npm run backend:build` passed, and `npm run backend:migrate:dev` applied `0005_phase2_communication_schedules.up.sql` plus `0006_phase2_delivery_foundation.up.sql` after implementing publish, cancel, recipient snapshot, and delivery foundation persistence.
- `2026-07-08`: Slice 2.7 now persists `POST /agent/session` trust in `device_sessions`, rotates the device token on session refresh, renews expiry on authenticated agent usage, and uses persisted device ownership to validate `POST /agent/heartbeat` before updating device freshness metadata.
- `2026-07-08`: focused runtime verification against a dedicated backend instance on `BACKEND_PORT=4014` confirmed a registered device receives `200` from `POST /agent/session`, exactly one persisted `device_sessions` row remains for that device after session refresh, `POST /agent/heartbeat` returns `204` and updates `devices.last_heartbeat_at` plus `status`, and the replaced token is rejected with `401 UNAUTHORIZED`.
- `2026-07-08`: Slice 2.8 now serves `GET /agent/messages` from persisted `delivery_jobs` plus `communication_recipients`, records idempotent `Displayed` and `Read` delivery events from the Windows Agent, and accepts workflow-validated `POST /agent/messages/{messageId}/response` by transitioning the message into `Responded` while updating recipient response and acknowledgement state.
- `2026-07-08`: focused runtime verification against a dedicated backend instance on `BACKEND_PORT=4015` with `LDAP_ALLOWED_GROUPS=''` confirmed an admin can create and publish a Windows Agent-targeted communication, the target device receives exactly one pending message from `GET /agent/messages`, duplicate `Displayed` and `Read` submissions remain `204` and create only one lifecycle event each, `POST /agent/messages/{messageId}/response` returns `200`, the delivery job transitions to `Responded`, recipient state becomes `Responded` plus `Acknowledged`, and the message no longer appears in reconciliation after response submission.
- `2026-07-08`: Slice 2.9 now materializes `AgentLocalRoutine` recurring reminder policies into `agent_reminder_policies`, records local reminder evidence in `agent_reminder_events`, persists realtime negotiation compatibility rows in `device_realtime_connections`, and rejects `AgentLocalRoutine` publish attempts that do not resolve to at least one device-bound Windows Agent recipient.
- `2026-07-08`: focused runtime verification against a dedicated backend instance on `BACKEND_PORT=4016` with `LDAP_ALLOWED_GROUPS=''` confirmed an admin can publish a recurring `AgentLocalRoutine` reminder, `POST /agent/realtime/negotiate` returns a concrete `connectionUrl` plus reusable session-backed access token and persists a `Connected` realtime row, `GET /agent/reminder-policies` returns the synchronized policy, `POST /agent/reminder-policies/{policyId}/events` records a `Triggered` occurrence, and cancelling the communication removes the target `policyId` from subsequent reminder-policy sync responses while leaving the persisted policy row inactive.
- `2026-07-09`: Slice 2.11 now exposes `GET /communications/{communicationId}/deliveries` as the thin Phase 2 admin visibility baseline, returning paged delivery jobs together with persisted recipient snapshots and recent delivery events derived from `communication_recipients`, `delivery_jobs`, and `delivery_events`.
- `2026-07-09`: the admin notification detail flow now uses backend delivery visibility for the `Recipients`, `Delivery Logs`, and acknowledgement summary tabs instead of placeholder data, while richer device monitoring and reporting remain intentionally deferred.
- `2026-07-09`: focused verification for Slice 2.11 passed with `npm run backend:typecheck`, `npm run backend:build`, and `npm run build`, and a dedicated runtime on `BACKEND_PORT=4018` confirmed a create-preview-publish sequence returns `Queued`, then `GET /communications/{communicationId}/deliveries` returns at least one recipient snapshot, one delivery job, and a persisted `Queued` delivery event detail.
- `2026-07-09`: a Windows Agent prototype smoke validation on `BACKEND_PORT=4019` confirmed the first-release startup and recovery path end to end: `POST /agent/session` succeeded, `POST /agent/realtime/negotiate` returned fresh `connectionId` values across reconnect, `GET /agent/realtime-hub` emitted `connected` plus `messages.snapshot`, `POST /agent/heartbeat` refreshed device health, publish `Now` emitted `messages.available` to the active stream, and after reconnect the same pending communication remained available through both `messages.snapshot` and `GET /agent/messages`.
- `2026-07-09`: `POST /agent/realtime/negotiate` no longer hardcodes `localhost` in `connectionUrl`; the backend now derives the realtime base URL from the inbound request host by default and supports `BACKEND_PUBLIC_BASE_URL` as an explicit deployment override when a reverse proxy or external host name must be advertised to Windows Agent clients.

## Phase 3 - Response Workflow And Monitoring
### Status
- `Completed`

### Objective
Implement recipient response workflows, overdue behavior, monitoring, and audit-ready reporting on top of the persisted delivery foundation from Phase 2.

Phase 3 is the bridge between delivery execution and operator visibility:
- turn persisted delivery evidence into operator-facing response and monitoring views
- ensure required-response communications move through explicit lifecycle states
- make overdue and follow-up behavior operationally visible
- prepare representative audit evidence before broader hardening in Phase 4

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

### Execution Direction
#### Slice 3.1 Workflow Baseline
- Scope:
  - workflow definition source-of-truth is available to communication drafting and response evaluation
  - workflow option constraints are validated consistently during submission
- Current status:
  - draft selection and workflow snapshots are already used by the runtime
  - managed seed loading now reconciles the canonical workflow baseline during backend bootstrap
- Done when:
  - operators can only use valid workflow definitions and valid option sets
  - runtime no longer depends on undocumented workflow assumptions

#### Slice 3.2 Response Ingestion And Semantics
- Scope:
  - Windows Agent response submission persists workflow result, actor context, and optional note
  - `response implies ack` behavior is enforced when configured by the workflow
- Current status:
  - Windows Agent and compatible-channel response submission baselines are in place
  - actor context and `response implies ack` are already persisted across both ingestion paths
- Done when:
  - required-response messages move from `AwaitingResponse` to `Responded`
  - monitoring endpoints can explain who responded, what option was chosen, and when it happened

#### Slice 3.3 Monitoring And Reporting Baseline
- Scope:
  - communication-level, recipient-level, dashboard, and tracked-content rollup views are backend-backed
  - device, employee, and contact-endpoint recipient contexts are distinguishable in monitoring
- Current status:
  - baseline monitoring endpoints and reports are implemented
  - dashboard and reports are already consuming persisted backend data
- Done when:
  - operators can answer `what was sent`, `to whom`, `through which channel`, and `what happened next`
  - monitoring counts reconcile against `communication_recipients`, `delivery_jobs`, and `delivery_events`

#### Slice 3.4 Overdue And Recipient-Only Follow-Up
- Scope:
  - required-response recipients can transition into `Overdue`
  - MVP follow-up remains recipient-only and must not escalate to new recipients automatically
- Current status:
  - persisted overdue state and one-time Windows Agent recipient-only re-alert baseline are implemented
- Done when:
  - overdue recipients are visible in detail monitoring and dashboard rollups
  - follow-up behavior is recorded explicitly enough to challenge and support operational review

#### Slice 3.5 Auditability
- Scope:
  - publish, cancel, override rejection, response, and representative state transitions produce explicit audit evidence
  - audit evidence is queryable enough for operator/support investigation
- Current status:
  - append-only audit log persistence and admin retrieval baseline are implemented
- Done when:
  - representative lifecycle events are not only inferable from delivery tables but intentionally recorded as audit history
  - support teams can reconstruct a communication lifecycle without reading raw infrastructure logs

#### Slice 3.6 Frontend Alignment
- Scope:
  - remove monitoring/reporting mocks that would hide real backend state
  - ensure admin views show persisted response, overdue, and delivery rollups
- Current status:
  - dashboard, reports, delivery visibility, and response summary are already backend-backed
- Done when:
  - operator UI is a faithful read-model of backend monitoring state for the MVP release path

### Checklist
- `[x]` Workflow management: implement workflow definition CRUD or managed seed loading.
- `[x]` Workflow management: implement workflow option validation rules.
- `[x]` Response handling: implement response submission for Windows Agent and compatible channel responses.
- `[x]` Response handling: enforce `response implies ack` semantics in the backend.
- `[x]` Response handling: store actor context as optional audit metadata where available.
- `[x]` Monitoring: implement communication-level monitoring endpoints.
- `[x]` Monitoring: implement recipient-level monitoring endpoints with device and contact distinctions.
- `[x]` Monitoring: implement dashboard summary endpoints and aggregation queries.
- `[x]` Monitoring: implement delivery and response state rollups for tracked content types.
- `[x]` Overdue handling: implement timeout evaluation and recipient-only follow-up triggers.
- `[x]` Auditability: implement audit logging for publish, cancel, override rejection, response, and state transitions.
- `[x]` Frontend integration: replace mock reports, dashboards, and response summary services with backend-backed calls.

### Output
- Backend supports monitored response workflows and operational reporting.
- Reporting and monitoring are backed by persisted delivery, response, and audit records.
- Operators can identify required-response progress, overdue recipients, and recipient-only follow-up behavior from backend-backed views.
- Phase 3 response workflow, monitoring, overdue, auditability, and compatible-channel response baselines are complete for the MVP release path.

### Challenge / Verification
- Response state transitions are validated.
- Overdue cases are challenged.
- Dashboard counts reconcile with source records.
- Audit records are challenged against representative lifecycle events.
- For every closed slice, verification should name the exact endpoint, runtime port, and persisted state that changed.
- Phase 3 evidence should always reconcile three layers together:
  - admin-facing endpoint or UI result
  - persisted source rows or aggregate query result
  - lifecycle event sequence that explains why the state is correct
- `2026-07-09`: Phase 3 is now active because Windows Agent startup, realtime push, reconnect, and thin admin delivery visibility were already validated for the first go-live path.
- `2026-07-09`: the backend now exposes `GET /communications/{communicationId}/responses` as the first admin response-monitoring endpoint, returning paged recipient responses derived from persisted `Responded` delivery events for the communication.
- `2026-07-09`: manual `workflowId` selection on communication drafts now also sets `requiresResponse`, preventing `RESPONSE_NOT_REQUIRED` conflicts when operators create response-required communications without relying on template defaults.
- `2026-07-09`: the admin notification detail page now includes a backend-backed `Responses` tab that lists recipient name, response option, actor, and response time using the new Phase 3 response endpoint together with persisted recipient snapshots.
- `2026-07-09`: focused verification passed with `npm run backend:typecheck`, `npm run build`, and a dedicated runtime smoke on `BACKEND_PORT=4020` that created a Windows Agent communication with workflow `11111111-1111-1111-1111-111111111111`, published it to `device-mti-ops-01`, submitted agent response option `safe`, and confirmed `GET /communications/{communicationId}/responses` returned the persisted response plus actor context with `totalItems = 1`.
- `2026-07-09`: the backend now exposes `GET /dashboard/overview` as the first dashboard summary baseline, and the admin dashboard stat cards use this endpoint for active communications, pending recipients, delivered jobs, responded recipients, failed jobs, and overdue response counts instead of local mock aggregation.
- `2026-07-09`: focused verification passed with `npm run backend:typecheck`, `npm run backend:build`, `npm run build`, and a dedicated runtime smoke on `BACKEND_PORT=4021` that authenticated an admin session and confirmed `GET /dashboard/overview` returned non-error aggregate metrics (`activeCommunications = 10`, `recipientsPending = 5`, `deliveredCount = 10`, `respondedCount = 5`, `failedCount = 3`, `overdueResponses = 0`).
- `2026-07-09`: `GET /communications/{communicationId}/deliveries` now serves as the first recipient-level monitoring baseline, returning `Device`, `Employee`, and `ContactEndpoint` recipient contexts together with `deviceId`, `deviceIdentifier`, `hostname`, and `channelEndpoint` where available, and the admin notification detail `Recipients` tab now surfaces those references directly for operator monitoring.
- `2026-07-09`: focused verification passed with `npm run backend:typecheck`, `npm run build`, and a dedicated runtime smoke on `BACKEND_PORT=4022` that published one device-targeted Windows Agent communication plus one employee-targeted WhatsApp communication, then confirmed `GET /communications/{communicationId}/deliveries` returned a `Device` recipient with `deviceId = 401317fc-fb05-4020-b69f-15c7bd6d90d6`, `deviceIdentifier = device-mti-ops-01`, `hostname = MTI-OPS-01`, and a `ContactEndpoint` recipient with `channelEndpoint = +628000000001`.
- `2026-07-09`: the backend now exposes `GET /dashboard/content-type-rollups` as the first tracked-content reporting baseline, grouping persisted communication, recipient, workflow, and delivery state into per-`communicationType` delivery and response rollups without requiring a derived reporting table.
- `2026-07-09`: the admin `Reports` page now uses backend-backed content-type rollups instead of mock department, site, and channel chart data, and `GET /communications` now includes persisted `category`, `createdAt`, `recipientsCount`, and `ackCount` summary fields so report history and dashboard notification summaries no longer default to placeholder zero counts.
- `2026-07-09`: focused verification passed with `npm run backend:typecheck`, `npm run backend:build`, `npm run build`, and a dedicated runtime smoke on `BACKEND_PORT=4023` that published one `Alert` plus one `News` communication to `device-mti-ops-01`, reported `Displayed`, `Read`, and workflow `Responded` for the `Alert`, then confirmed `GET /dashboard/content-type-rollups` returned six tracked content-type rows including `Alert` rollups with `readCount = 11` and `respondedCount = 7`, while `GET /communications` returned the created `Alert` summary with `recipientsCount = 1` and `ackCount = 1`.
- `2026-07-09`: overdue handling now persists `communication_recipients.response_state = Overdue`, records `delivery_events.event_type = Overdue`, and stores `follow_up_triggered_at` when recipient-only timeout evaluation triggers a one-time Windows Agent re-alert for the same recipient and delivery job.
- `2026-07-09`: focused verification passed with `npm run backend:typecheck`, `npm run backend:build`, `npm run backend:migrate`, `npm run build`, and a dedicated runtime smoke on `BACKEND_PORT=4024` that temporarily set the seeded workflow timeout to `0`, published a response-required `Alert` to `device-mti-ops-01`, triggered `GET /agent/messages`, and then confirmed `GET /communications/{communicationId}/deliveries` returned a `Device` recipient with `responseState = Overdue`, an `Overdue` delivery event, a re-queued `Pending` delivery job for recipient-only follow-up, and updated dashboard overdue counts.
- `2026-07-09`: the backend now exposes `GET /audit-logs` as the first audit trail baseline, backed by append-only `audit_logs` rows for publish acceptance, cancel acceptance, template override rejection, agent response recording, overdue transitions, and recipient-only follow-up queue events; the admin `Audit Logs` page now reads this backend endpoint instead of mock seed data.
- `2026-07-09`: focused verification passed with `npm run backend:typecheck`, `npm run backend:build`, `npm run backend:migrate`, `npm run build`, and a dedicated runtime smoke on `BACKEND_PORT=4025` that forced a template override rejection, published a response-required Windows Agent communication, submitted an agent response, cancelled the communication, and then confirmed `GET /audit-logs` returned `TemplateOverrideRejected`, `PublishCommunication`, `CommunicationStatusChanged`, `RecordResponse`, `RecipientResponseStateChanged`, and `CancelCommunication` entries tied to the exercised lifecycle.
- `2026-07-09`: the backend now exposes `GET /workflows` as the workflow-definition source of truth for admin authoring and runtime workflow resolution, returning rows from `response_workflows` plus ordered `response_workflow_options`; the workflow service also enforces definition validation rules for blank options, duplicate option keys, invalid free-text combinations, and non-positive timeout settings before a definition can be used by the runtime.
- `2026-07-09`: the admin create/edit draft flows now load workflow definitions from `GET /workflows`, require a real `workflowId` when `requireAck` is enabled, and no longer hardcode workflow `11111111-1111-1111-1111-111111111111` inside the compose/update payload path.
- `2026-07-14`: backend bootstrap now runs managed workflow seed loading before the HTTP server is exposed, reconciling the canonical `Critical Acknowledgement` and `Reminder Confirmation` definitions plus their ordered response options so workflow authoring no longer depends on a one-time migration seed remaining untouched.
- `2026-07-14`: focused verification passed with `npm run backend:typecheck`, `npm run backend:build`, `npm run build`, and `node backend/tmp/phase3-workflow-seeds-smoke.mjs`; the smoke deliberately drifted the seeded workflow name and deleted the reminder option, then confirmed a dedicated runtime on `BACKEND_PORT=4026` restored canonical `/workflows` output with `totalItems = 2`, `Critical Acknowledgement` option count `3`, and `Reminder Confirmation` option label `Acknowledged`.
- `2026-07-14`: the backend now exposes `POST /communications/{communicationId}/deliveries/{deliveryJobId}/response` as the thin compatible-channel response ingestion baseline for non-Windows-Agent delivery jobs, reusing persisted workflow snapshots to validate the selected response option, recording `Responded` delivery events, updating recipient response state, and applying `response implies ack` semantics before full provider callback modules exist.
- `2026-07-14`: focused verification passed with `npm run backend:typecheck`, `npm run backend:build`, `npm run build`, and `node backend/tmp/phase3-compatible-channel-response-smoke.mjs`; the smoke started a dedicated runtime on `BACKEND_PORT=4027`, published a `Reminder` to an employee over `WhatsApp`, confirmed `GET /communications/{communicationId}/deliveries` returned a `ContactEndpoint` recipient with `channelEndpoint = +628000000001`, submitted response option `done` through the new delivery-response endpoint, and then confirmed both `GET /communications/{communicationId}/responses` and `GET /audit-logs` reflected the persisted `WhatsApp` response evidence.

## Phase 4 - Hardening And Expansion
### Status
- `In Progress`

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
- `docs/operational-runbook.md`
- `docs/security-and-access-model.md`

### Checklist
- `[ ]` Channel expansion: define and document the email connector contract.
- `[ ]` Channel expansion: implement email delivery orchestration if included in scope.
- `[ ]` Channel expansion: define and document the digital signage connector contract.
- `[ ]` Channel expansion: implement digital signage orchestration if included in scope.
- `[x]` Observability: harden logging, tracing, and operational alerting.
- `[x]` Observability: improve connector-health and realtime-hub diagnostics.
- `[x]` Security: harden session handling, token rotation, and agent trust controls.
- `[x]` Security: review directory integration security settings and environment handling.
- `[ ]` Reporting: expand historical reporting and export capability.
- `[x]` Operations: define deployment, rollback, and incident-response runbook guidance.
- `[x]` Documentation: update source docs and supporting docs for any post-MVP contract changes.

### Output
- Hardened platform with clearer path to post-MVP expansion.
- Operational and security guidance is documented for production-oriented rollout.

### Challenge / Verification
- New channel contracts are documented.
- Operational failure recovery is challenged.
- Security-sensitive actions are re-verified.
- Production-oriented deployment and rollback assumptions are challenged.
- `2026-07-14`: Phase 4 is now active with a desktop-first go-live hardening slice; the current release decision is to keep `WindowsAgent` enabled for the first live path while `WhatsApp`, `Email`, and `Digital Signage` remain deferred unless explicitly enabled for a controlled environment.
- `2026-07-14`: backend and admin authoring now honor release-scope channel guardrails through `ENABLED_DELIVERY_CHANNELS` and `VITE_ENABLED_DELIVERY_CHANNELS`, so out-of-scope channels are hidden in the compose/edit UI and rejected by the backend with `422 CHANNEL_NOT_ENABLED`.
- `2026-07-14`: new operational and security guidance is now documented in `docs/operational-runbook.md` and `docs/security-and-access-model.md`, covering deployment, rollback, incident escalation, device-centric trust assumptions, and production release-scope enforcement for the desktop-first live path.
- `2026-07-14`: focused verification passed with `npm run backend:typecheck`, `npm run backend:build`, `npm run build`, and `node backend/tmp/phase4-release-scope-smoke.mjs`; the smoke started a dedicated runtime on `BACKEND_PORT=4028` with `ENABLED_DELIVERY_CHANNELS=WindowsAgent`, confirmed a desktop-targeted draft could still be created, and confirmed a `WhatsApp` draft request was rejected with `422 CHANNEL_NOT_ENABLED`.
- `2026-07-14`: authenticated operational diagnostics are now available through `GET /health/diagnostics`, returning database reachability, enabled delivery channels, configurable admin and agent session TTL summaries, realtime connection counts, and device connectivity summaries for desktop-first go-live checks.
- `2026-07-14`: baseline device trust revocation is now available through `POST /devices/{deviceId}/revoke-session`, which deletes persisted device sessions, disconnects active realtime streams, marks the device offline, and records a `RevokeDeviceSession` audit entry.
- `2026-07-14`: focused verification passed with `npm run backend:typecheck`, `npm run backend:build`, and `node backend/tmp/phase4-diagnostics-and-revoke-smoke.mjs`; the smoke started a dedicated runtime on `BACKEND_PORT=4029` with `ADMIN_SESSION_TTL_MINUTES=120`, `AGENT_SESSION_TTL_MINUTES=30`, and `ENABLED_DELIVERY_CHANNELS=WindowsAgent`, confirmed `GET /health/diagnostics` returned the expected database/session/realtime summaries, revoked an active device through `POST /devices/{deviceId}/revoke-session`, and then confirmed the old agent token failed on `POST /agent/heartbeat` with `401 UNAUTHORIZED`.
- `2026-07-14`: admin session rotation is now available through `POST /auth/rotate-session`, immediately invalidating the prior bearer token while issuing a fresh session token for the same authenticated operator.
- `2026-07-14`: directory integration security and environment handling are now hardened for the desktop-first live path: production startup rejects `LDAP_URL=ldap://...` unless `LDAP_ALLOW_INSECURE_URL=true` is set explicitly, production also rejects `LDAP_SKIP_TLS_VERIFY=true`, and structured backend logs now redact common secret-bearing keys such as `password`, `token`, and `authorization`.
- `2026-07-14`: focused verification passed with `npm run backend:typecheck`, `npm run backend:build`, and `node backend/tmp/phase4-security-hardening-smoke.mjs`; the smoke started a dedicated runtime on `BACKEND_PORT=4030`, confirmed `POST /auth/rotate-session` returned a new bearer token, confirmed the old token failed on `GET /auth/me` with `401 UNAUTHORIZED`, and then confirmed a separate production-mode startup on `BACKEND_PORT=4031` failed fast for `LDAP_URL=ldap://directory.example.internal` without an explicit insecure override.
- `2026-07-14`: backend request tracing now has a lightweight correlation baseline: every HTTP response echoes `X-Request-Id`, and request lifecycle logs include the same `requestId` plus `actorUsername` where available.
- `2026-07-14`: `GET /health/diagnostics` now returns explicit warning and critical `alerts` for expiring sessions, stale realtime connectivity, device staleness, and database reachability so live operators can prioritize degraded conditions without manually interpreting raw counters.
- `2026-07-14`: focused verification passed with `npm run backend:typecheck`, `npm run backend:build`, and `node backend/tmp/phase4-observability-smoke.mjs`; the smoke started a dedicated runtime on `BACKEND_PORT=4032` with `ADMIN_SESSION_TTL_MINUTES=10` and `AGENT_SESSION_TTL_MINUTES=10`, confirmed `GET /health/diagnostics` echoed `X-Request-Id=phase4-observability-request`, returned `ADMIN_SESSIONS_EXPIRING_SOON` plus `AGENT_SESSIONS_EXPIRING_SOON` alerts, and wrote a matching `http.request.completed` log line with the same request ID for correlation.
- `2026-07-14`: a desktop-first Docker deployment baseline now exists through `Dockerfile.backend`, `Dockerfile.frontend`, `docker-compose.yml`, `.dockerignore`, and `.env.docker.example`, giving the project a reproducible local container path for frontend, backend, and PostgreSQL.
- `2026-07-14`: focused Docker-baseline verification passed with `npm run backend:build`, `NITRO_PRESET=node-server npm run build`, and a direct runtime check of `node .output/server/index.mjs`; the frontend Node SSR output listened successfully on `127.0.0.1:4090`, confirming the Docker-targeted `node-server` preset is viable for the current TanStack Start stack.
