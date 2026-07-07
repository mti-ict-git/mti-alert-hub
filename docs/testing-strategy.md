# MTI Alert Testing Strategy

## Document Status
- Version: `0.1`
- Status: `Draft Baseline`
- Last Updated: `2026-07-07`
- Owner: `Engineering / QA`

## Purpose
This document defines how `MTI Alert` work should be verified so roadmap progress, implementation quality, and documentation status remain aligned.

## Testing Goals
- Verify that implementation matches the documented workflow and API contract.
- Catch regressions in communication lifecycle, audience resolution, delivery tracking, and response handling.
- Provide explicit verification evidence before any phase is marked complete.
- Keep testing effort focused on behavior that materially reduces project risk.

## Core Verification Rule
No meaningful backend or workflow change is complete until verification evidence is recorded for the changed area.

Minimum evidence should include one or more of:
- build or typecheck passed
- endpoint contract verified
- workflow path tested
- authorization edge case challenged
- failure path challenged

## Testing Principles
### 1. Contract First
- `docs/openapi.yaml` is the source of truth for backend behavior exposed to clients.
- Backend changes that affect requests, responses, validation, or status codes must update and re-verify the OpenAPI contract.

### 2. Workflow Matters More Than Isolated CRUD
- Prioritize tests that validate publish, delivery, response, and monitoring behavior across realistic paths.
- Prefer end-to-end business paths over excessive low-value duplication of simple data mapping tests.

### 3. Authorization Must Be Challenged
- Scope filtering and privileged actions must include negative-path verification, not only happy-path checks.
- Backend enforcement is mandatory even if the UI already hides actions.

### 4. Channel Semantics Must Stay Explicit
- Do not treat `Sent`, `Displayed`, `Delivered`, `Read`, and `Responded` as interchangeable.
- Tests should verify the correct status transitions and rollup behavior, especially across Windows Agent and WhatsApp differences.

### 5. Focus On Regression Value
- Add or expand automated tests when they materially reduce repeat risk.
- Avoid noisy tests that only restate implementation details without protecting important behavior.

## Test Levels
### Document Verification
Use when the work is still in documentation or planning phases.

Examples:
- required docs exist
- roadmap source documents are coherent
- terminology and lifecycle states are synchronized
- open questions are explicitly recorded

### Unit Tests
Use for deterministic domain logic with limited dependencies.

Examples:
- lifecycle transition guards
- template lock validation
- audience rule normalization
- response workflow policy rules
- delivery status rollup helpers

### Integration Tests
Use for module interaction with infrastructure boundaries.

Examples:
- auth and authorization with repository access
- communication publish flow writing snapshot and delivery jobs
- response submission updating monitoring state
- audit logging for publish and cancel actions

### Contract Tests
Use to verify API compatibility with `docs/openapi.yaml`.

Examples:
- request validation
- response shape
- status code behavior
- error payload consistency

### End-To-End Or Scenario Tests
Use for business workflows that cross modules or channel boundaries.

Examples:
- create draft -> preview -> publish -> monitor
- recurring reminder generation and local policy sync
- critical alert desktop-first with delayed WhatsApp follow-up
- response-required communication becoming `Responded`

### Operational Or Manual Verification
Use when automation is not yet practical or an external dependency is unresolved.

Examples:
- realtime connection behavior with a Windows Agent prototype
- WhatsApp provider callback mapping in a sandbox
- deployment smoke test in a target environment

## Phase Verification Matrix
### Phase 0 - Documentation Baseline
Required evidence:
- Mandatory documentation exists.
- Supporting documents remain synchronized with the baseline.
- Core terms, statuses, and workflow rules do not conflict across documents.

Recommended checks:
- Manual document review against roadmap source documents.
- Cross-document terminology pass for lifecycle states and channel rules.

### Phase 1 - Core Backend Foundation
Required evidence:
- Build and typecheck pass.
- Auth endpoints and access rules are verified.
- Audience preview behavior is checked against authorization scope.
- OpenAPI contract matches implemented backend behavior.

Recommended automated coverage:
- Unit tests for permissions, template locks, and audience resolution.
- Integration tests for communication draft CRUD and publish preview.
- Contract tests for admin API endpoints.

### Phase 2 - Delivery Orchestration
Required evidence:
- Immediate and scheduled publication paths are verified.
- Delivery job creation and recipient snapshot generation are verified.
- Failed delivery paths are challenged.
- Channel-specific state mapping is verified.

Recommended automated coverage:
- Integration tests for job creation and retry policy behavior.
- Scenario tests for Windows Agent and WhatsApp dispatch orchestration.
- Contract tests for agent and callback endpoints.

### Phase 3 - Response Workflow And Monitoring
Required evidence:
- Response state transitions are validated.
- Overdue cases are challenged.
- Dashboard and drill-down metrics reconcile with source records.

Recommended automated coverage:
- Unit tests for workflow and overdue rules.
- Integration tests for response submission and monitoring updates.
- Scenario tests for required-response communications.

### Phase 4 - Hardening And Expansion
Required evidence:
- New channel contracts are documented and verified.
- Security-sensitive actions are re-verified.
- Operational recovery or degraded-path behavior is challenged.

Recommended automated coverage:
- Regression suite for existing channel and response behavior.
- Environment smoke tests and release validation checks.

## High-Risk Areas That Must Be Tested Deliberately
- Scope enforcement for `Local Operator` versus `Central Admin`
- Publish preview correctness before final confirmation
- Device-centric desktop targeting by site and area
- Delivery state normalization across Windows Agent and WhatsApp
- Response-implies-ack behavior in MVP
- Template-locked field rejection at API level
- Realtime disconnect and stale agent reconciliation behavior

## Evidence Recording Guidance
When closing work, capture:
- what changed
- what was verified
- how it was verified
- what was not fully verified yet
- any dependency or external limitation that prevented stronger verification

## Initial Tooling Direction
- Use automated tests for deterministic domain and API behavior as implementation begins.
- Use mockable boundaries for LDAP, WhatsApp provider, and realtime infrastructure where direct dependency control is limited.
- Add lightweight smoke checks for migrations, environment boot, and critical route availability.

## Current Limitations
- Concrete Windows Agent runtime behavior cannot be fully verified until a compatible client implementation exists.
- Concrete WhatsApp delivery and read semantics depend on the selected production provider.
- Realtime technology choice remains open, so strategy should validate behavior contracts rather than overfit one library too early.
