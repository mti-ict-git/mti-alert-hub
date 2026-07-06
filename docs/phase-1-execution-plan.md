# MTI Alert Phase 1 Execution Plan

## Document Status
- Version: `0.1`
- Status: `Draft Baseline`
- Last Updated: `2026-07-06`
- Audience: `Backend Engineers`, `Tech Leads`, `AI Builders`

## Purpose
This document turns `Phase 1 - Core Backend Foundation` into an execution plan that can be followed step by step.

It defines:
- implementation order
- work packages
- module dependencies
- required API endpoints per milestone
- expected deliverables
- verification checkpoints

This document is intended to reduce ambiguity before backend coding begins.

## Source Of Truth
This execution plan is derived from:
- `docs/implementation-roadmap.md`
- `docs/backend-module-breakdown.md`
- `docs/technical-implementation-plan.md`
- `docs/functional-specification.md`
- `docs/database-schema-specification.md`
- `docs/openapi.yaml`

If there is a conflict, follow:
1. `docs/openapi.yaml` for backend contract behavior
2. `docs/implementation-roadmap.md` for phase scope
3. `docs/backend-module-breakdown.md` for module ownership and sequence

## Phase 1 Goal
Phase 1 is complete when the backend can support:
- admin authentication
- local authorization and scope enforcement
- organization reference data
- employee and device read models
- template retrieval
- communication draft authoring
- audience preview

Phase 1 does **not** require:
- actual publish orchestration
- Windows Agent realtime delivery
- delivery jobs
- response workflow execution
- dashboard monitoring

## Phase 1 Boundary
### In Scope
- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`
- `GET /communications`
- `POST /communications`
- `GET /communications/{communicationId}`
- `PATCH /communications/{communicationId}`
- `POST /communications/{communicationId}/duplicate`
- `POST /communications/{communicationId}/audience-preview`
- `GET /templates`
- `GET /templates/{templateId}`
- `GET /reference/organization`
- `GET /reference/sites`
- `GET /reference/areas`
- `GET /reference/departments`
- `GET /reference/sections`
- `GET /employees`
- `GET /devices`

### Out Of Scope
- `POST /communications/{communicationId}/publish`
- `POST /communications/{communicationId}/cancel`
- all `/agent/*` execution endpoints
- delivery tracking endpoints
- dashboard and response reporting endpoints

## Execution Strategy
The recommended strategy is:
- build the application skeleton first
- implement auth and access next
- implement read-model dependencies before authoring flows
- implement templates before communication authoring
- implement audience preview last within Phase 1 because it depends on most prior modules

This sequence minimizes rework.

## Milestone Plan
## Milestone 0: Application Baseline
### Objective
Create the backend foundation required for every later module.

### Work Packages
- create the backend app entrypoint
- add environment configuration loading
- add database connection bootstrapping
- add HTTP routing baseline
- add request validation pipeline
- add error handling middleware
- add structured logging baseline
- add health or readiness endpoint if desired

### Deliverables
- runnable backend skeleton
- config loading pattern
- request validation pattern
- shared error contract utilities

### Verification
- application starts locally
- config validation fails clearly when required variables are missing
- request validation pipeline rejects malformed payloads
- shared error responses align with `docs/openapi.yaml`

### Recommended Output
- base folder structure
- shared middleware stack
- first integration test harness or API smoke-test harness

## Milestone 1: Auth And Session Foundation
### Objective
Implement admin authentication and current session retrieval.

### Modules
- `auth`
- `audit`

### API Scope
- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`

### Work Packages
- define directory adapter interface
- implement LDAP or AD authentication flow
- define session model
- implement session issuance
- implement session invalidation
- implement current session lookup
- enrich session with role and scope placeholders if final access mapping is not complete yet
- emit audit events for login success and failure where appropriate

### Dependencies
- milestone 0 must be complete

### Verification
- valid credentials return an `AuthSession`
- invalid credentials return `401`
- missing payload fields return `422`
- `GET /auth/me` returns the active session after login
- `POST /auth/logout` invalidates the current session

### Exit Criteria
- auth contract matches OpenAPI
- session handling is stable enough for other admin endpoints

## Milestone 2: Access And Scope Enforcement
### Objective
Implement local authorization and scoped access control.

### Modules
- `access`
- `auth`
- `audit`

### API Scope
No new public endpoints are required, but all protected admin endpoints should now enforce:
- authentication
- role mapping
- scope filtering

### Work Packages
- define admin role model
- define admin scope model for `Global`, `Site`, and `Area`
- implement scope lookup per admin identity
- implement guard or middleware for protected endpoints
- implement scoped query helper pattern
- define out-of-scope error behavior

### Dependencies
- milestone 1 must be complete

### Verification
- unauthenticated requests return `401`
- authenticated but unauthorized requests return `403`
- scoped users cannot read or mutate out-of-scope records
- audit captures representative access denial events if enabled

### Exit Criteria
- all Phase 1 endpoints can safely rely on backend scope enforcement

## Milestone 3: Organization Reference Read Models
### Objective
Provide the reference data used by authoring, filtering, and targeting.

### Modules
- `organization`
- `access`

### API Scope
- `GET /reference/organization`
- `GET /reference/sites`
- `GET /reference/areas`
- `GET /reference/departments`
- `GET /reference/sections`
- `GET /employees`

### Work Packages
- define site read model
- define area read model
- define department read model
- define section read model
- define employee read model
- add pagination and search support where documented
- add scope-aware filtering
- define HR sync ingestion boundary, even if sync execution is deferred

### Dependencies
- milestone 2 must be complete

### Verification
- each endpoint returns valid response shape from OpenAPI
- scoped operators only see allowed site or area data
- employee list supports documented filters
- organization reference payload is consistent across list and aggregate endpoints

### Exit Criteria
- frontend targeting forms could consume reference data without mocks

## Milestone 4: Devices Read Model
### Objective
Expose devices as admin-side operational entities for targeting and visibility.

### Modules
- `devices`
- `organization`
- `access`

### API Scope
- `GET /devices`

### Work Packages
- define device read model
- expose `siteId`, `areaId`, `locationLabel`, `ownershipMode`, and `status`
- add pagination and filtering
- apply scope-aware filtering
- prepare data ownership so future agent heartbeat updates can enrich device state

### Dependencies
- milestone 3 should be complete

### Verification
- device list response matches OpenAPI
- site and area filters behave correctly
- scoped operators only see devices in their allowed visibility range

### Exit Criteria
- audience resolution can use devices as concrete endpoints

## Milestone 5: Templates And Policy Retrieval
### Objective
Expose communication templates as full policy objects for authoring and preview.

### Modules
- `templates`
- `access`

### API Scope
- `GET /templates`
- `GET /templates/{templateId}`

### Work Packages
- define template read model
- expose template version
- expose mandatory and optional channels
- expose locked and editable fields
- expose target constraints
- expose workflow and presentation defaults
- expose dual-path rule where present

### Dependencies
- milestone 2 must be complete
- milestone 3 is strongly recommended

### Verification
- template list returns full policy-ready records
- template detail returns locked and editable fields correctly
- returned policy objects are sufficient for authoring logic

### Exit Criteria
- communications module can validate drafts against template rules

## Milestone 6: Communication Draft Lifecycle
### Objective
Implement communication authoring state and draft lifecycle behavior.

### Modules
- `communications`
- `templates`
- `organization`
- `access`
- `audit`

### API Scope
- `GET /communications`
- `POST /communications`
- `GET /communications/{communicationId}`
- `PATCH /communications/{communicationId}`
- `POST /communications/{communicationId}/duplicate`

### Work Packages
- define communication draft persistence model
- implement communication list with filters
- implement draft create
- implement draft detail
- implement draft update
- implement draft duplicate
- enforce draft-only update rule
- enforce template-locked field rejection
- store target rules and policy-linked metadata needed for audience preview
- emit audit events for create, update, and duplicate

### Dependencies
- milestone 5 must be complete

### Verification
- create, get, update, and duplicate all match OpenAPI
- non-draft mutation attempts are rejected with correct error behavior
- locked template fields are rejected at API layer
- communication list filters behave correctly

### Exit Criteria
- backend can fully replace mock communication draft services

## Milestone 7: Audience Preview
### Objective
Implement target resolution and publish preview behavior for drafts.

### Modules
- `audience`
- `communications`
- `templates`
- `organization`
- `devices`
- `access`

### API Scope
- `POST /communications/{communicationId}/audience-preview`

### Work Packages
- validate target rules
- resolve targets by site, area, department, section, employee, group, and device
- resolve Windows Agent recipients as `device-by-location`
- detect available channels per recipient
- generate `channelPlan`
- generate preview warnings
- compute total recipient counts
- compute device and WhatsApp recipient counts

### Dependencies
- milestones 3, 4, 5, and 6 must be complete

### Verification
- representative target combinations return expected recipients
- out-of-scope targets are rejected or filtered correctly
- preview payload matches OpenAPI
- critical templates produce sensible preview warnings and channel plan outputs

### Exit Criteria
- frontend can perform preview and confirmation flow without mock logic

## Milestone 8: Phase 1 Stabilization
### Objective
Finalize the backend foundation so Phase 1 can be considered implementation-ready.

### Modules
- all Phase 1 modules

### Work Packages
- remove or retire Phase 1 mocks in the frontend service layer
- challenge authorization boundaries
- challenge template lock enforcement
- challenge audience preview correctness
- align final implementation details with `docs/openapi.yaml`
- update docs if implementation revealed any missing contract detail

### Verification
- build and typecheck pass
- representative API smoke tests pass
- frontend authoring flow works against backend for Phase 1 endpoints
- unauthorized and out-of-scope scenarios are challenged
- roadmap status and checklist are updated to match reality

### Exit Criteria
- Phase 1 backend foundation is stable enough to begin Phase 2 planning or implementation

## Recommended Workstream Split
If multiple engineers or AI builders work in parallel, split as follows:

### Workstream A: App, Auth, And Access
- milestone 0
- milestone 1
- milestone 2

### Workstream B: Organization And Devices
- milestone 3
- milestone 4

### Workstream C: Templates And Communications
- milestone 5
- milestone 6

### Workstream D: Audience Preview
- milestone 7

`Workstream D` should start only after earlier dependencies are stable enough.

## Recommended PR Or Delivery Slices
To keep changes reviewable, use small implementation slices:

### Slice 1
- app bootstrap
- config
- database
- error handling
- validation

### Slice 2
- auth endpoints
- session model
- login/logout/me

### Slice 3
- access guards
- scope mapping
- protected route enforcement

### Slice 4
- reference endpoints
- employee list

### Slice 5
- device list

### Slice 6
- template list/detail

### Slice 7
- communication draft CRUD

### Slice 8
- audience preview

### Slice 9
- frontend service replacement for Phase 1 flows

## Verification Matrix
### Auth
- valid login works
- invalid login fails with `401`
- session retrieval works
- logout invalidates session

### Access
- unauthenticated access fails with `401`
- out-of-scope access fails with `403`
- scoped reads return limited data

### Organization
- reference endpoints return expected shapes
- search and pagination behave correctly
- site/area filters are enforced

### Devices
- device list returns location-oriented data
- scope filtering works

### Templates
- template detail contains lock and policy fields
- template list is sufficient for authoring UI

### Communications
- draft create/get/update/duplicate all work
- locked fields are rejected
- only drafts are mutable

### Audience Preview
- preview works for representative targets
- channel plan is returned
- recipient counts are consistent

## Required Documentation Sync Before Phase 1 Completion
Before marking Phase 1 complete:
- `docs/openapi.yaml` must match actual implementation
- `docs/implementation-roadmap.md` must reflect real checklist progress
- `docs/open-questions-and-challenges.md` must record unresolved implementation ambiguity
- supporting docs should be updated if the implementation introduces meaningful new design decisions

## Known Risks During Phase 1
### Risk 1. Starting With Audience Preview Too Early
Do not start target resolution before reference data, devices, templates, and communication drafts are stable enough.

### Risk 2. Under-Specifying Scope Enforcement
Do not postpone scoped access logic. It is a foundation requirement, not a hardening task.

### Risk 3. Treating Templates As Cosmetic
Templates are policy objects. Draft validation must use template lock and target rules.

### Risk 4. Overbuilding Phase 2 Too Soon
Do not implement publish execution, realtime hub logic, or delivery jobs just because the OpenAPI contract already documents them.

## Recommended Definition Of Ready For Coding
Backend implementation should start only when:
- environment strategy is understood
- database access pattern is chosen
- session strategy is chosen
- module boundaries are accepted
- initial endpoint order is accepted

## Recommended Next Action After This Document
Once this plan is accepted, the next practical step is:
- scaffold the backend project structure
- or create a detailed task list from `Milestone 0` through `Milestone 2`

For fastest progress, start with:
- `Milestone 0`
- `Milestone 1`
- `Milestone 2`

Those three unlock the rest of Phase 1.
