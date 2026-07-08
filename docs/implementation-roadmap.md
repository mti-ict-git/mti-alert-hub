# MTI Alert Implementation Roadmap

## Document Status
- Version: `0.3`
- Status: `Active`
- Last Updated: `2026-07-07`

## Active Phase
- `Phase 1 - Core Backend Foundation`

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
- `In Progress`

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
- `[ ]` Organization data: define the HR sync ingestion contract for basic org data. `On Hold - Post-Go-Live`
- `[x]` Organization data: implement reference endpoints for sites, areas, departments, and sections.
- `[x]` Organization data: implement sync-safe read models for employees and devices.
- `[ ]` Communication drafts: implement draft create, get, update, duplicate, and cancel rules.
- `[ ]` Communication drafts: enforce template-locked field validation in the API layer.
- `[ ]` Audience preview: implement target resolution for site, area, employee, group, and device target types.
- `[ ]` Audience preview: implement publish preview output with recipient counts and channel plan.
- `[ ]` Frontend integration: replace mock auth and draft services with backend-backed service calls.
- `[ ]` Frontend integration: validate that admin flows still work against the new contract.

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
- Publish preview output is challenged with representative target combinations.
- Go-live fast-track decision on `2026-07-07`: HR or organization baseline ingestion is not treated as a go-live blocker and is explicitly deferred until after the first live release unless operational needs force it back into scope.

## Phase 2 - Delivery Orchestration
### Status
- `Pending`

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
- `[ ]` Publication flow: implement publish confirmation rules and schedule validation.
- `[ ]` Publication flow: implement publish now and publish later execution paths.
- `[ ]` Scheduling: implement one-time scheduling and persistence.
- `[ ]` Scheduling: implement recurring schedule definition, execution mode selection, and validation.
- `[ ]` Scheduling: implement server-generated recurring execution for standard scheduled communications.
- `[ ]` Scheduling: implement versioned local reminder policy distribution for approved Windows Agent routine reminders.
- `[ ]` Recipient snapshot: generate immutable snapshots for device-targeted and contact-targeted recipients.
- `[ ]` Recipient snapshot: store template version and effective policy snapshot for execution.
- `[ ]` Delivery orchestration: implement delivery job creation per recipient and per channel.
- `[ ]` Delivery orchestration: implement delivery attempt records and bounded retry behavior.
- `[ ]` Delivery orchestration: implement delivery status events including `Displayed` and `Read`.
- `[ ]` WhatsApp boundary: implement outbound provider interface and callback ingestion contract.
- `[ ]` WhatsApp boundary: implement read receipt mapping and delivery state normalization.
- `[ ]` Windows Agent boundary: implement device session registration and realtime negotiation endpoints.
- `[ ]` Windows Agent boundary: implement heartbeat, displayed, read, and response endpoints.
- `[ ]` Windows Agent boundary: implement pending-message reconciliation for disconnected agents.
- `[ ]` Windows Agent boundary: implement reminder policy sync, invalidation, and local occurrence reporting for approved routine reminders.
- `[ ]` Frontend integration: replace mock publish, delivery, and device monitoring services with backend-backed calls.

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
- Compatibility baseline added on `2026-07-08`: the backend now exposes `POST /agent/session`, `POST /agent/realtime/negotiate`, `POST /agent/heartbeat`, `GET /agent/messages`, `GET /agent/reminder-policies`, `POST /agent/messages/{messageId}/displayed`, `POST /agent/messages/{messageId}/read`, `POST /agent/messages/{messageId}/response`, and `POST /agent/reminder-policies/{policyId}/events`.
- Current limitation for that baseline: device sessions are in-memory, realtime negotiation returns placeholder hub metadata, and reconciliation or lifecycle endpoints are empty-safe compatibility handlers until delivery, reminder, and workflow persistence is implemented.
- Verification evidence on `2026-07-08`: `npm run backend:typecheck` passed and `npm run backend:build` passed after registering the new `agent` server boundary.

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
