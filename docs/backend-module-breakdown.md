# MTI Alert Backend Module Breakdown

## Document Status
- Version: `0.1`
- Status: `Draft Baseline`
- Last Updated: `2026-07-06`
- Audience: `Backend Engineers`, `AI Builders`

## Purpose
This document translates the MTI Alert source-of-truth documents into an implementation-oriented backend module plan.

It is intended to answer:
- which backend modules should exist
- what each module is responsible for
- which API endpoints map to each module
- what order the modules should be implemented in
- which dependencies each module has

This document is a bridge between:
- product and architecture documentation
- the OpenAPI contract
- actual backend implementation work

## Source Of Truth
This document is derived from:
- `docs/implementation-roadmap.md`
- `docs/functional-specification.md`
- `docs/technical-implementation-plan.md`
- `docs/database-schema-specification.md`
- `docs/openapi.yaml`
- `docs/windows-agent-client-specification.md`

If there is a conflict, follow:
1. `docs/openapi.yaml` for API contract behavior
2. `docs/functional-specification.md` for product behavior
3. `docs/technical-implementation-plan.md` for module and integration direction

## Recommended Backend Shape
For MVP, the recommended backend shape is a `modular monolith`.

That means:
- one deployable backend service
- clear domain boundaries by module
- shared infrastructure where practical
- minimal cross-module leakage
- internals designed so selected modules can later move toward asynchronous or externalized execution if needed

## Recommended Top-Level Layers
The backend should be organized into a small number of top-level layers:

### 1. `app`
Cross-cutting bootstrap and composition:
- HTTP server startup
- module registration
- middleware registration
- dependency injection or module wiring
- environment loading
- health endpoint registration

### 2. `modules`
Domain-oriented business modules:
- auth
- access
- organization
- templates
- communications
- audience
- devices
- agent
- deliveries
- workflows
- reporting
- audit

### 3. `infrastructure`
Shared technical adapters:
- database access
- queue or scheduler support
- cache
- external directory client
- WhatsApp provider client
- realtime hub integration
- logging and observability

### 4. `shared`
Reusable internal building blocks:
- error types
- validation utilities
- pagination utilities
- scoped query helpers
- common DTO helpers
- common enums mirrored from OpenAPI where appropriate

## Recommended Repository Structure
One practical starting structure:

```text
src/
  app/
    bootstrap/
    http/
    config/
  modules/
    auth/
    access/
    organization/
    templates/
    communications/
    audience/
    devices/
    agent/
    deliveries/
    workflows/
    reporting/
    audit/
  infrastructure/
    db/
    directory/
    realtime/
    messaging/
    scheduler/
    observability/
  shared/
    errors/
    auth/
    pagination/
    validation/
    time/
```

This structure is directional, not mandatory. The important rule is preserving clear module responsibilities.

## Module Catalog
### 1. Auth Module
#### Responsibility
- authenticate admin users through LDAP or Active Directory
- issue admin session tokens or equivalent session state
- expose current session information
- own login/logout session lifecycle

#### Primary API Endpoints
- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`

#### Core Internal Responsibilities
- credential verification through directory adapter
- session issuance
- session lookup
- session invalidation
- auth failure normalization

#### Key Dependencies
- directory client
- session store or token signer
- access module for role and scope enrichment
- audit module for login/logout events

#### Out Of Scope
- employee authentication for end users
- Windows Agent device authentication

### 2. Access Module
#### Responsibility
- own local role mapping and scope enforcement
- determine what an admin can see or modify
- provide reusable authorization guards

#### Primary API Coverage
No standalone public endpoint is required in Phase 1, but this module is used by:
- communications
- templates
- reference endpoints
- employee and device read models

#### Core Internal Responsibilities
- map admin identity to role
- map admin identity to `site` and `area` scope
- apply scoped filtering to queries
- deny out-of-scope actions

#### Key Dependencies
- auth module for session identity
- organization module for scope resolution helpers
- audit module for denied access or high-risk access actions if desired

### 3. Organization Module
#### Responsibility
- expose organization reference data used by targeting and filtering
- own sync-safe read models for org structure
- prepare for scheduled HR synchronization

#### Primary API Endpoints
- `GET /reference/organization`
- `GET /reference/sites`
- `GET /reference/areas`
- `GET /reference/departments`
- `GET /reference/sections`
- `GET /employees`

#### Core Internal Responsibilities
- site/area/department/section read models
- employee directory read model
- organization filtering
- sync import boundary for external HR data

#### Key Dependencies
- database access
- access module for scoped read filtering
- future HR sync adapter

#### Important Modeling Rule
This module owns `basic org data`, but authorization still belongs to the access module.

### 4. Templates Module
#### Responsibility
- expose communication templates as full policy objects
- provide template policy lookup for authoring and preview
- enforce template version awareness in read models

#### Primary API Endpoints
- `GET /templates`
- `GET /templates/{templateId}`

#### Core Internal Responsibilities
- template read model
- template version lookup
- locked/editable field policy lookup
- target constraint lookup
- channel policy lookup
- workflow and presentation defaults

#### Key Dependencies
- database access
- access module for visibility restrictions if needed

#### Important Rule
This module does not merely store content presets. It provides policy inputs used by the communications and audience modules.

### 5. Communications Module
#### Responsibility
- own the `Communication` aggregate in authoring state
- manage communication drafts
- enforce draft-only mutation rules
- coordinate with template policy and audience preview

#### Primary API Endpoints
- `GET /communications`
- `POST /communications`
- `GET /communications/{communicationId}`
- `PATCH /communications/{communicationId}`
- `POST /communications/{communicationId}/duplicate`

#### Future API Endpoints
- `POST /communications/{communicationId}/publish`
- `POST /communications/{communicationId}/cancel`

#### Core Internal Responsibilities
- draft creation
- draft retrieval
- draft update
- draft duplication
- status guardrails for mutable vs immutable states
- template lock validation at API boundary

#### Key Dependencies
- access module
- templates module
- organization module for target validation
- audience module for preview integration
- audit module

### 6. Audience Module
#### Responsibility
- resolve targeting rules into previewable recipient outcomes
- convert abstract targets into concrete device and contact recipients
- prepare the system for immutable recipient snapshots later

#### Primary API Endpoints
- `POST /communications/{communicationId}/audience-preview`

#### Core Internal Responsibilities
- target rule validation
- target resolution by site, area, department, section, employee, group, and device
- device-by-location resolution
- available channel detection
- preview warning generation
- channel plan generation

#### Key Dependencies
- communications module
- templates module
- organization module
- devices module

#### Important Rule
Phase 1 returns preview data. Phase 2 evolves this same logic into immutable execution snapshots.

### 7. Devices Module
#### Responsibility
- own admin-side read models for Windows Agent devices
- expose device operational metadata
- support device-centric audience resolution

#### Primary API Endpoints
- `GET /devices`

#### Core Internal Responsibilities
- device list and filtering
- device health projection
- site/area/location metadata projection
- device ownership mode projection

#### Key Dependencies
- database access
- access module for scope filtering
- future agent module for heartbeat-fed updates

### 8. Agent Module
#### Responsibility
- own Windows Agent server-facing session and realtime interactions
- receive heartbeat and lifecycle callbacks from devices
- expose pending-message reconciliation endpoints

#### Primary Future API Endpoints
- `POST /agent/session`
- `POST /agent/realtime/negotiate`
- `POST /agent/heartbeat`
- `GET /agent/messages`
- `POST /agent/messages/{messageId}/displayed`
- `POST /agent/messages/{messageId}/read`
- `POST /agent/messages/{messageId}/response`

#### Core Internal Responsibilities
- device session creation and refresh
- realtime negotiation
- heartbeat ingestion
- pending-message reconciliation
- lifecycle event ingestion
- active user context capture as optional audit metadata

#### Key Dependencies
- devices module
- deliveries module
- workflows module
- audit module
- realtime infrastructure adapter

#### Important Rule
This module is not an admin UI module. It is the server boundary for the Windows Agent client.

### 9. Deliveries Module
#### Responsibility
- own delivery jobs, delivery attempts, and channel status persistence
- normalize channel delivery states into MTI Alert lifecycle states

#### Primary Future API Endpoints
- `GET /communications/{communicationId}/deliveries`

#### Core Internal Responsibilities
- delivery job creation
- delivery attempt persistence
- delivery state transitions
- bounded retry logic
- channel-specific state normalization
- delivery rollups

#### Key Dependencies
- communications module
- audience module
- devices module
- agent module
- future WhatsApp connector
- audit module

### 10. Workflows Module
#### Responsibility
- own response workflows and workflow definitions
- define response options and semantics
- enforce `response implies ack`

#### Primary Future API Coverage
- workflow-backed response handling for agent and compatible channels
- future workflow administration if CRUD is exposed later

#### Core Internal Responsibilities
- workflow definition lookup
- option validation
- response semantics
- overdue timeout evaluation
- recipient-only follow-up logic

#### Key Dependencies
- templates module
- deliveries module
- reporting module

### 11. Reporting Module
#### Responsibility
- provide monitoring and dashboard-facing read models
- expose aggregated delivery and response information

#### Primary Future API Endpoints
- `GET /dashboard/overview`
- `GET /communications/{communicationId}/responses`

#### Core Internal Responsibilities
- dashboard metrics
- communication-level aggregates
- recipient-level drilldowns
- overdue and response summaries

#### Key Dependencies
- communications module
- deliveries module
- workflows module
- audit module

### 12. Audit Module
#### Responsibility
- capture important product and security events
- provide evidence for publish, cancel, login, response, and policy enforcement events

#### Primary API Coverage
No public endpoint is required for Phase 1.

#### Core Internal Responsibilities
- audit event recording
- actor and scope capture
- request context capture
- lifecycle evidence storage

#### Key Dependencies
- all write-heavy modules

## Phase 1 Implementation Modules
The minimum practical Phase 1 implementation set is:
- `auth`
- `access`
- `organization`
- `templates`
- `communications`
- `audience`
- `devices`
- `audit`

These modules are enough to support:
- admin login/session
- scope enforcement
- org references
- employee and device read models
- template retrieval
- communication draft CRUD
- audience preview

## Phase 2 Additional Modules
To enter delivery orchestration, add:
- `agent`
- `deliveries`
- channel connector infrastructure
- scheduling infrastructure support

## Phase 3 Additional Modules
To enter workflow and monitoring depth, add:
- `workflows`
- `reporting`
- deeper audit projections if needed

## Endpoint-To-Module Mapping
### Phase 1
- `POST /auth/login` -> `auth`
- `POST /auth/logout` -> `auth`
- `GET /auth/me` -> `auth`
- `GET /communications` -> `communications`
- `POST /communications` -> `communications`
- `GET /communications/{communicationId}` -> `communications`
- `PATCH /communications/{communicationId}` -> `communications`
- `POST /communications/{communicationId}/duplicate` -> `communications`
- `POST /communications/{communicationId}/audience-preview` -> `audience`
- `GET /templates` -> `templates`
- `GET /templates/{templateId}` -> `templates`
- `GET /reference/organization` -> `organization`
- `GET /reference/sites` -> `organization`
- `GET /reference/areas` -> `organization`
- `GET /reference/departments` -> `organization`
- `GET /reference/sections` -> `organization`
- `GET /employees` -> `organization`
- `GET /devices` -> `devices`

### Phase 2
- `POST /communications/{communicationId}/publish` -> `communications` + `deliveries`
- `POST /communications/{communicationId}/cancel` -> `communications` + `deliveries`
- `POST /agent/session` -> `agent`
- `POST /agent/realtime/negotiate` -> `agent`
- `POST /agent/heartbeat` -> `agent`
- `GET /agent/messages` -> `agent` + `deliveries`
- `POST /agent/messages/{messageId}/displayed` -> `agent` + `deliveries`
- `POST /agent/messages/{messageId}/read` -> `agent` + `deliveries`

### Phase 3
- `POST /agent/messages/{messageId}/response` -> `agent` + `workflows`
- `GET /communications/{communicationId}/deliveries` -> `deliveries`
- `GET /communications/{communicationId}/responses` -> `reporting` + `workflows`
- `GET /dashboard/overview` -> `reporting`

## Recommended Internal Module Shape
Each module should ideally expose a similar internal structure:

```text
modules/<module-name>/
  controller/
  service/
  repository/
  model/
  dto/
  validation/
```

Alternative naming is acceptable, but every module should keep these responsibilities separated:
- request handling
- business logic
- persistence access
- DTO or schema mapping
- validation

## Recommended Dependency Rules
### Safe Dependency Direction
Preferred direction:
- controllers depend on services
- services depend on repositories and other module service interfaces
- repositories depend on infrastructure DB layer

### Avoid
- controllers calling repositories directly
- modules depending on each other's database tables without an abstraction boundary
- UI-driven logic leaking into core domain services

### Preferred Cross-Module Pattern
When one module needs another module:
- depend on a service interface or explicit query service
- avoid direct database access into another module's tables if possible

## Suggested Implementation Order
### Step 1. App And Infrastructure Baseline
Start with:
- server bootstrap
- config loading
- database connection
- request validation pipeline
- authentication middleware skeleton
- error handling middleware
- logging baseline

### Step 2. Auth And Access
Implement first because all admin APIs depend on it:
- login
- logout
- me
- session parsing
- scope enrichment
- authorization guards

### Step 3. Organization And Devices Read Models
Implement next because targeting, filtering, and scoped visibility depend on these:
- sites
- areas
- departments
- sections
- employees
- devices

### Step 4. Templates
Implement after organization because communication authoring depends on policy data:
- list templates
- get template detail
- template policy projection

### Step 5. Communications
Implement draft lifecycle after templates:
- list drafts
- create draft
- get draft
- update draft
- duplicate draft
- validate locked field override rules

### Step 6. Audience Preview
Implement after communications, templates, organization, and devices:
- resolve target rules
- compute preview counts
- compute channel plan
- return preview warnings

### Step 7. Audit Hardening For Phase 1
Before declaring Phase 1 done, make sure key audit events exist for:
- login/logout
- draft create/update/duplicate
- denied out-of-scope attempts
- template override rejection
- audience preview requests if considered important

## Suggested Database Ownership By Module
### Auth
- admin sessions
- login events if stored separately

### Access
- admin roles
- admin scope mappings

### Organization
- sites
- areas
- departments
- sections
- employee directory references
- HR sync metadata

### Templates
- communication templates
- template versions
- template policy snapshots or source definitions

### Communications
- communications
- draft content and authoring state
- communication target rules

### Audience
- preview projections or optional cached audience resolution artifacts

### Devices
- device registry
- device operational metadata

### Deliveries
- recipient snapshots
- delivery jobs
- delivery attempts
- delivery status events

### Workflows
- workflow definitions
- workflow options
- response records
- overdue tracking

### Audit
- audit log records

## Implementation Risks To Watch
### Risk 1. Over-Coupling Communications And Templates
Do not embed template storage logic into the communications module.

### Risk 2. Weak Scope Enforcement
Do not rely on frontend-only filtering. Scope checks must live in backend guards and scoped queries.

### Risk 3. Treating Devices As Employees
Windows desktop delivery is device-centric. Do not collapse devices into the employee table or assume one device equals one person.

### Risk 4. Mixing Phase 1 And Phase 2 Too Early
Do not block Phase 1 completion by trying to fully implement publish orchestration, realtime push, or delivery state callbacks too early.

### Risk 5. Leaky Cross-Module Queries
Do not let every module query every table directly. Keep ownership clearer than that.

## Recommended Definition Of Phase 1 Done
Phase 1 is practically ready when:
- admin auth works against the chosen directory integration
- local scope enforcement works for protected endpoints
- reference endpoints return scoped data
- template endpoints return full policy objects needed by authoring
- communication drafts support create, read, update, duplicate, and listing
- audience preview resolves representative target combinations
- draft mutation rejects locked template field overrides
- OpenAPI and implementation match

## Recommended Handoff Use
This document is intended to be used together with:
- `docs/openapi.yaml`
- `docs/technical-implementation-plan.md`
- `docs/template-policy-schema.md`
- `docs/windows-agent-client-specification.md`

For backend implementation, this document should be the main execution-oriented planning reference before code generation or manual module scaffolding begins.
