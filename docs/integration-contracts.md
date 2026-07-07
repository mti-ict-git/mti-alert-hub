# MTI Alert Integration Contracts

## Document Status
- Version: `0.1`
- Status: `Draft Baseline`
- Last Updated: `2026-07-07`
- Audience: `Backend Engineers`, `Integration Engineers`, `Operations`

## Purpose
This document defines integration-facing contracts that sit at the boundary between MTI Alert and external or operator-provided data sources.

For Phase 1, the main contract in scope is:
- organization and device baseline ingestion

This document exists to make the ingestion boundary explicit even though continuous synchronization is still deferred.

## Source Of Truth
This contract is derived from:
- `docs/functional-specification.md`
- `docs/database-schema-specification.md`
- `docs/phase-1-execution-plan.md`
- `docs/deployment-and-environment.md`

If there is a conflict, follow:
1. `docs/database-schema-specification.md` for persisted field intent
2. `docs/functional-specification.md` for source-of-truth ownership
3. `docs/phase-1-execution-plan.md` for Phase 1 execution boundary

## Phase 1 Baseline Ingestion Contract
### Goal
Provide a controlled import path for the minimum org and device data required by:
- `GET /reference/organization`
- `GET /reference/sites`
- `GET /reference/areas`
- `GET /reference/departments`
- `GET /reference/sections`
- `GET /employees`
- `GET /devices`
- `POST /communications/{communicationId}/audience-preview`

### Scope
The current baseline ingestion contract supports:
- `sites`
- `areas`
- `departments`
- `sections`
- `employees`
- `devices`

The current baseline ingestion contract does not yet support:
- recursive or incremental HR delta sync
- group master data
- scope assignment import for admin users
- agent-session-managed device registration events
- conflict-resolution workflows beyond deterministic upsert behavior

### Source Ownership
Current safe ownership model:
- organization hierarchy and employee baseline come from an external HR batch or operator-provided export
- device baseline comes from inventory export or controlled operator-provided baseline
- LDAP remains an authentication source for admin login, not the source of truth for org or device master data

### File Format
The Phase 1 ingestion payload is JSON.

Supporting artifacts:
- Example payload: `backend/examples/phase1-baseline.example.json`
- JSON schema: `backend/examples/phase1-baseline.schema.json`
- Import script: `backend/src/scripts/import-phase1-baseline.ts`

### Import Command
Development import:
- `npm run backend:import:baseline:dev -- "<path-to-json>"`

Development rollback validation:
- `npm run backend:import:baseline:dev:rollback -- "<path-to-json>"`

Built import:
- `npm run backend:import:baseline -- "<path-to-json>"`

Built rollback validation:
- `npm run backend:import:baseline:rollback -- "<path-to-json>"`

### Contract Shape
Top-level object keys:
- `sites`
- `areas`
- `departments`
- `sections`
- `employees`
- `devices`

Each top-level key is optional in practice because the parser defaults missing arrays to empty arrays.

### Entity Fields
#### sites
Required:
- `code`
- `name`

Optional:
- `status`
- `sourceSystem`
- `externalReference`

Upsert key:
- `code`

#### areas
Required:
- `siteCode`
- `name`

Optional:
- `code`
- `status`
- `sourceSystem`
- `externalReference`

Upsert key:
- `siteCode + name`

#### departments
Required:
- `siteCode`
- `name`

Optional:
- `code`
- `status`
- `sourceSystem`
- `externalReference`

Upsert key:
- `siteCode + name`

#### sections
Required:
- `siteCode`
- `departmentName`
- `name`

Optional:
- `code`
- `status`
- `sourceSystem`
- `externalReference`

Upsert key:
- `siteCode + departmentName + name`

#### employees
Required:
- `employeeNumber`
- `fullName`

Optional:
- `email`
- `phoneNumber`
- `siteCode`
- `areaName`
- `departmentName`
- `sectionName`
- `jobRole`
- `employmentStatus`
- `hasWindowsAgent`
- `hasWhatsApp`
- `preferredPrimaryChannel`
- `preferredSecondaryChannel`
- `sourceSystem`
- `externalReference`

Upsert key:
- `employeeNumber`

#### devices
Required:
- `hostname`
- `siteCode`

Optional:
- `deviceIdentifier`
- `primaryEmployeeNumber`
- `areaName`
- `locationLabel`
- `ownershipMode`
- `agentVersion`
- `osVersion`
- `status`

Upsert key:
- `hostname`

### Referential Rules
Import order is significant and currently expected as:
1. `sites`
2. `areas`
3. `departments`
4. `sections`
5. `employees`
6. `devices`

Reference resolution rules:
- `areas.siteCode` must match an imported or existing site
- `departments.siteCode` must match an imported or existing site
- `sections.siteCode + departmentName` must match an imported or existing department
- `employees.siteCode`, `areaName`, `departmentName`, and `sectionName` must resolve if provided
- `devices.siteCode` and optional `areaName` must resolve
- `devices.primaryEmployeeNumber` must resolve if provided

If a reference cannot be resolved, the current import implementation fails fast and rolls back the transaction.

### Idempotency
The current implementation is idempotent at entity level through deterministic upsert behavior.

Expected behavior:
- re-importing the same payload should update the same rows instead of creating duplicates
- `sourceSystem` and `externalReference` should be preserved when omitted in later payloads
- optional nullable fields may be replaced if explicitly provided in later payloads

### Validation Rules
Baseline payload validation currently enforces:
- required string fields are non-empty after trim
- enumerated values are constrained for:
  - preferred channels
  - device ownership mode
  - device status
- unknown top-level sections are not part of the contract and should be treated as unsupported by tooling using the JSON schema

### Operational Guidance
Use rollback validation first when:
- testing a new export mapping
- checking referential integrity
- verifying that counts and keys are correct
- validating a shared or production-like environment

Recommended operator workflow:
1. validate against `backend/examples/phase1-baseline.schema.json`
2. run rollback import
3. review output counts and any failures
4. run the real import only after the rollback pass is clean

### Audience Preview Relevance
This contract directly affects audience preview quality.

Audience preview depends on:
- employee site or area linkage
- employee channel availability flags
- device site or area linkage
- device-to-employee relationship where present

If these fields are absent or stale, preview results may:
- undercount recipients
- show incomplete channel coverage
- produce warnings that reflect data quality rather than targeting logic defects

### Known Phase 1 Limitations
- `Group` targeting still has no backing group-master import contract
- admin scope assignments are still placeholder-based and not imported from org data
- employee and device source freshness rules are not yet versioned or scheduled
- there is no separate audit table yet for baseline import executions

### Next Contract Candidates
Future integration contracts may include:
- HR delta sync contract
- device inventory delta sync contract
- admin scope import contract
- WhatsApp provider callback ingestion contract
