# MTI Alert Implementation Roadmap

## Document Status
- Version: `0.1`
- Status: `Active`
- Last Updated: `2026-07-06`

## Active Phase
- `Phase 0 - Documentation Baseline`

## Phase 0 - Documentation Baseline
### Status
- `In Progress`

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

### Checklist
- `[x]` Define the product vision and MVP scope.
- `[x]` Define product principles and operating constraints.
- `[x]` Define the core functional domains and workflows.
- `[x]` Define the conceptual backend architecture.
- `[x]` Define the baseline database schema.
- `[x]` Define the initial OpenAPI contract for the server.
- `[x]` Record unresolved questions and implementation challenges.
- `[x]` Review and refine the baseline documents with user feedback.

### Output
- A complete baseline documentation package in `docs/`.

### Challenge / Verification
- Verification target: required documentation files exist and form a coherent baseline for implementation.
- Challenge: key architecture decisions were narrowed, but several implementation details remain open and are tracked in `docs/open-questions-and-challenges.md`.
- Evidence: document set created, then refined against explicit user decisions on `2026-07-06`.

## Phase 1 - Core Backend Foundation
### Status
- `Pending`

### Objective
Implement the core backend foundation for authentication, role scope enforcement, organization data, communication management, and audience resolution.

### Source Documents
- `docs/project-plan.md`
- `docs/functional-specification.md`
- `docs/technical-implementation-plan.md`
- `docs/database-schema-specification.md`
- `docs/openapi.yaml`

### Checklist
- `[ ]` Implement auth endpoints and session or token model.
- `[ ]` Implement user role and scope enforcement.
- `[ ]` Implement organization reference data endpoints.
- `[ ]` Implement communication draft CRUD endpoints.
- `[ ]` Implement audience preview and target resolution.
- `[ ]` Update frontend service layer to use backend endpoints.

### Output
- Running backend foundation with documented API coverage.

### Challenge / Verification
- Build and typecheck pass.
- API contract matches implementation.
- Authorization scope is challenged with unauthorized access scenarios.

## Phase 2 - Delivery Orchestration
### Status
- `Pending`

### Objective
Implement communication publication, scheduling, recipient snapshots, and delivery job orchestration for Windows Agent and WhatsApp.

### Source Documents
- `docs/functional-specification.md`
- `docs/technical-implementation-plan.md`
- `docs/database-schema-specification.md`
- `docs/openapi.yaml`
- `docs/open-questions-and-challenges.md`

### Checklist
- `[ ]` Implement publish and cancel workflows.
- `[ ]` Implement one-time and recurring schedules.
- `[ ]` Implement recipient snapshot generation.
- `[ ]` Implement delivery job and attempt tracking.
- `[ ]` Implement WhatsApp connector integration boundary.
- `[ ]` Implement Windows Agent API boundary.

### Output
- Backend supports end-to-end communication dispatch orchestration.

### Challenge / Verification
- Scheduled and immediate communications are both verified.
- Failed delivery paths are challenged.
- Delivery state rollup is validated for multi-channel recipients.

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

### Checklist
- `[ ]` Implement workflow definition management.
- `[ ]` Implement recipient response submission endpoints.
- `[ ]` Implement overdue response tracking.
- `[ ]` Implement communication monitoring endpoints.
- `[ ]` Implement dashboard summary endpoints.
- `[ ]` Implement audit logging for communication lifecycle events.

### Output
- Backend supports monitored response workflows and operational reporting.

### Challenge / Verification
- Response state transitions are validated.
- Overdue cases are challenged.
- Dashboard counts reconcile with source records.

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

### Checklist
- `[ ]` Add email connector design and implementation.
- `[ ]` Add digital signage connector design.
- `[ ]` Improve observability and operational tooling.
- `[ ]` Harden security and session management.
- `[ ]` Expand reporting and export capability.

### Output
- Hardened platform with clearer path to post-MVP expansion.

### Challenge / Verification
- New channel contracts are documented.
- Operational failure recovery is challenged.
- Security-sensitive actions are re-verified.
