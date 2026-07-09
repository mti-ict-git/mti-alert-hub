# MTI Alert Deployment And Environment

## Document Status
- Version: `0.2`
- Status: `Draft Baseline`
- Last Updated: `2026-07-09`
- Owner: `Engineering / Operations`

## Purpose
This document defines the baseline deployment assumptions, environment boundaries, configuration responsibilities, and release expectations for `MTI Alert`.

## Deployment Goals
- Keep environment expectations explicit before backend implementation accelerates.
- Prevent hidden assumptions around secrets, migrations, connector dependencies, and release order.
- Provide a stable handoff reference for setup, deployment, and operations work.

## Baseline System Components
The MVP deployment is expected to include:
- `Admin API`
- `Agent API`
- `Realtime Hub` or equivalent realtime delivery service boundary
- `PostgreSQL`
- optional `Redis` for queueing, scheduling assistance, or caching
- outbound connector integration for `WhatsApp`
- future connector boundaries for `Email` and `Digital Signage`

## Environment Model
### Local Development
Purpose:
- daily engineering work
- rapid debugging
- schema iteration
- contract and workflow verification

Expected characteristics:
- local or containerized infrastructure
- relaxed operational scale assumptions
- safe development secrets only
- mock or sandbox connector integrations where practical

### Shared Development Or Integration
Purpose:
- team-level integration
- frontend-backend coordination
- Windows Agent contract validation
- external dependency sandbox testing

Expected characteristics:
- centrally managed environment variables
- shared database and service endpoints
- basic observability enabled
- restricted but stable test integrations

### Staging Or Pre-Production
Purpose:
- release validation
- deployment rehearsal
- migration verification
- smoke testing with production-like settings

Expected characteristics:
- production-like topology where practical
- controlled secrets management
- deployment automation enabled
- rollback and recovery checks performed

### Production
Purpose:
- live communication operations
- audited delivery and monitoring
- controlled change rollout

Expected characteristics:
- hardened secret handling
- monitoring and alerting enabled
- backup and restore plan defined
- operational logging and audit retention active

## Configuration Categories
### Application Configuration
Examples:
- application name
- environment name
- public base URL for admin application
- internal API base URLs

### Database Configuration
Examples:
- PostgreSQL connection string
- connection pool settings
- migration execution settings

Current implementation baseline:
- Phase 1 backend startup verifies live PostgreSQL connectivity during application bootstrap.
- The current target database is `ictMTIAlertHub`.
- Versioned migration commands now exist through `npm run backend:migrate` and `npm run backend:migrate:status`.
- Verification on `2026-07-07` confirmed connectivity succeeds and the initial Phase 1 foundation schema is applied.
- Organization, employee, and device read-model endpoints currently return empty-state payloads because the new tables are still unseeded, not because the schema is missing.

### Realtime Configuration
Examples:
- hub endpoint or transport settings
- heartbeat thresholds
- stale connection thresholds
- reconnect policy values

### Authentication Configuration
Examples:
- LDAP or Active Directory host
- bind settings
- allowed admin groups
- session or token expiry
- signing keys or token secrets

Current implementation baseline:
- Phase 1 currently uses LDAP-backed admin authentication.
- Phase 1 currently issues opaque bearer session tokens from an in-memory session store.
- Group-based access admission may be controlled through `LDAP_ALLOWED_GROUPS`.
- `LDAP_ALLOWED_GROUPS` should be configured as either:
  - a single full LDAP group DN
  - multiple full group DNs separated by `;`
  - a JSON array of full group DNs
- Comma-separated parsing is unsafe for LDAP DNs because a single DN already contains commas.

### Baseline Data Import
Examples:
- one-time org baseline import
- one-time employee baseline import
- one-time device inventory import
- dry-run validation before shared-environment execution

Current implementation baseline:
- Phase 1 now includes a baseline import script for `sites`, `areas`, `departments`, `sections`, `employees`, `devices`, and saved `audienceGroups`.
- Development command: `npm run backend:import:baseline:dev -- "<path-to-json>"`
- Development rollback command: `npm run backend:import:baseline:dev:rollback -- "<path-to-json>"`
- Built command: `npm run backend:import:baseline -- "<path-to-json>"`
- Built rollback command: `npm run backend:import:baseline:rollback -- "<path-to-json>"`
- Example payload: `backend/examples/phase1-baseline.example.json`
- The import path is idempotent and intended for controlled baseline loads, not for continuous realtime synchronization.
- Direct script usage also supports `--rollback` and `--dry-run`, but the dedicated rollback npm scripts are safer in shared environments.

### Channel And Connector Configuration
Examples:
- WhatsApp provider endpoint
- provider credentials
- callback verification secrets
- retry and timeout policy values

### Scheduling And Queueing Configuration
Examples:
- queue backend connection
- worker concurrency
- retry limits
- delayed delivery policy

### Observability Configuration
Examples:
- log level
- audit retention policy
- metrics export settings
- tracing or correlation settings

## Secret Handling Rules
- Never hardcode secrets in source code or documentation examples.
- Keep local development secrets separate from shared and production credentials.
- Rotate provider and token secrets through environment-specific secret management.
- Treat authentication keys, provider credentials, webhook verification secrets, and database credentials as secrets by default.

## Data And Migration Expectations
- Database schema changes must stay synchronized with `docs/database-schema-specification.md`.
- Backend API behavior changes must stay synchronized with `docs/openapi.yaml`.
- Migrations should be versioned, repeatable, and deployable independently from ad hoc manual SQL.
- Staging should validate migrations before production rollout.
- Backup and rollback expectations must be defined before high-risk schema changes reach production.

Current command conventions:
- `npm run backend:migrate:status` checks applied and pending migrations against the built backend runtime.
- `npm run backend:migrate` applies pending migrations against the configured target database.
- `npm run backend:migrate:status:dev` and `npm run backend:migrate:dev` provide the same behavior through `tsx` during local development.

## Release Flow Baseline
1. Confirm related documentation is synchronized.
2. Validate build, typecheck, and targeted verification for changed areas.
3. Validate database migration readiness if schema changes are included.
4. Deploy to a non-production environment first when the change is meaningful.
5. Run smoke verification for auth, communication flow, and critical health endpoints.
6. Promote to production only when verification evidence is acceptable.

## Smoke Verification Checklist
- service starts successfully
- database connection succeeds
- migrations are applied successfully
- admin API health is reachable
- agent-facing connectivity or negotiation boundary is reachable
- a basic authenticated admin request succeeds
- logging and audit output are visible

Latest verification evidence:
- `2026-07-07`: backend startup succeeded with live database ping.
- `2026-07-07`: `backend/migrations/0001_phase1_foundation.up.sql` was applied successfully to `ictMTIAlertHub`.
- `2026-07-07`: migration status verification confirmed `0001_phase1_foundation.up.sql` is recorded as applied.
- `2026-07-07`: table existence verification confirmed `schema_migrations`, `users`, `user_scopes`, `sites`, `areas`, `departments`, `sections`, `employees`, and `devices` now exist.
- `2026-07-07`: authenticated smoke requests to `GET /reference/organization`, `GET /reference/sites`, `GET /reference/areas`, `GET /reference/departments`, `GET /reference/sections`, `GET /employees`, and `GET /devices` returned `200`.
- `2026-07-07`: unauthenticated `GET /devices` returned `401`.
- `2026-07-08`: `backend/migrations/0002_phase1_communications.up.sql`, `0003_phase2_agent_sessions.up.sql`, and `0004_phase1_audience_groups.up.sql` were applied successfully to `ictMTIAlertHub`.
- `2026-07-08`: `backend/migrations/0005_phase2_communication_schedules.up.sql` was applied successfully to `ictMTIAlertHub`.
- `2026-07-08`: `backend/migrations/0006_phase2_delivery_foundation.up.sql` was applied successfully to `ictMTIAlertHub`.
- `2026-07-08`: `backend/examples/phase1-baseline.example.json` baseline import completed successfully with `sites`, `areas`, `departments`, `sections`, `employees`, `devices`, and `audienceGroups`.
- `2026-07-08`: targeted authenticated runtime checks confirmed `POST /communications`, `GET /communications/{communicationId}`, `PATCH /communications/{communicationId}`, `POST /communications/{communicationId}/duplicate`, and `POST /communications/{communicationId}/audience-preview` against the live backend runtime.
- `2026-07-08`: representative `Group` and `Device` audience previews returned expected recipients with zero preview warnings.
- `2026-07-08`: local frontend-origin compatibility was rechecked with `OPTIONS` and `POST /auth/login` requests from `Origin: http://127.0.0.1:4173`, confirming the backend returns the required CORS headers and a `200` login response.
- `2026-07-08`: a dedicated verification runtime on `BACKEND_PORT=4011` with `LDAP_ALLOWED_GROUPS=''` confirmed the new publish guardrails for `POST /communications/{communicationId}/publish`, including `422 PREVIEW_CONFIRMATION_REQUIRED`, `422 TIMEZONE_REQUIRED`, `422 TEMPLATE_POLICY_REFERENCE_REQUIRED`, `409 COMMUNICATION_NOT_DRAFT`, and `409 PUBLISH_ACCEPTANCE_NOT_READY`.
- `2026-07-08`: a dedicated verification runtime on `BACKEND_PORT=4012` with `LDAP_ALLOWED_GROUPS=''` confirmed `POST /communications/{communicationId}/publish` now accepts `Now` into `Queued`, accepts `Scheduled` into `Scheduled`, accepts `Recurring` into recurring schedule foundation persistence, writes the expected `communication_schedules` records, and allows `POST /communications/{communicationId}/cancel` to transition a scheduled communication into `Cancelled`.
- `2026-07-08`: a dedicated verification runtime on `BACKEND_PORT=4013` with `LDAP_ALLOWED_GROUPS=''` confirmed publish now writes `communication_recipients`, `delivery_jobs`, `delivery_attempts`, and `delivery_events`, including mixed `Device`, `Employee`, and `ContactEndpoint` snapshots, per-channel pending jobs, initial queued attempts, and cancellation-driven `Failed` events for scheduled jobs.
- `2026-07-08`: a dedicated verification runtime on `BACKEND_PORT=4014` confirmed `POST /agent/session` persists exactly one active `device_sessions` record for the refreshed device token, `POST /agent/heartbeat` returns `204` and updates `devices.last_heartbeat_at` plus `status`, and the replaced token is rejected with `401 UNAUTHORIZED`.
- `2026-07-08`: a dedicated verification runtime on `BACKEND_PORT=4015` with `LDAP_ALLOWED_GROUPS=''` confirmed the full Windows Agent reconciliation path through `POST /auth/login`, `POST /communications`, `POST /communications/{communicationId}/publish`, `POST /agent/session`, `GET /agent/messages`, `POST /agent/messages/{messageId}/displayed`, `POST /agent/messages/{messageId}/read`, and `POST /agent/messages/{messageId}/response`, including idempotent duplicate lifecycle submissions and the final `Responded` plus `Acknowledged` persistence state.
- `2026-07-08`: `backend/migrations/0007_phase2_agent_runtime_sync.up.sql` was applied successfully to `ictMTIAlertHub`.
- `2026-07-08`: a dedicated verification runtime on `BACKEND_PORT=4016` with `LDAP_ALLOWED_GROUPS=''` confirmed recurring `AgentLocalRoutine` publish, realtime negotiation persistence, reminder policy sync, local reminder event reporting, and target-policy invalidation after communication cancellation.
- `2026-07-08`: a dedicated verification runtime on `BACKEND_PORT=4017` with `LDAP_ALLOWED_GROUPS=''` confirmed `POST /agent/realtime/negotiate` returns `transport = SSE`, `GET /agent/realtime-hub` opens a working event stream, publish `Now` pushes `messages.available` to the active device connection, and `GET /agent/messages` still returns the same communication for reconciliation fallback.
- `2026-07-08`: frontend build verification after wiring backend-backed admin publish and cancel actions succeeded with `npm run build`, confirming the notification detail flow and notification index flow compile against the current Phase 2 contract.
- `2026-07-09`: a dedicated verification runtime on `BACKEND_PORT=4018` confirmed the new Phase 2 delivery visibility baseline end to end: an admin created and previewed a Windows Agent-targeted communication, `publish Now` returned `Queued`, and `GET /communications/{communicationId}/deliveries` then returned a persisted recipient snapshot, one delivery job, and a recent `Queued` delivery event with the expected detail text.
- `2026-07-09`: a dedicated verification runtime on `BACKEND_PORT=4019` confirmed the Windows Agent prototype startup and reconnect flow against the current `SSE` contract: agent session creation succeeded for a known device, heartbeat updated the device health record, reconnect negotiation issued fresh `connectionId` values, publish `Now` emitted `messages.available` on the active stream, and the same pending communication remained recoverable through both reconnect `messages.snapshot` and `GET /agent/messages`.

## Operational Dependencies
### Enterprise Identity
- LDAP or Active Directory integration is required for administrative authentication.
- Exact production configuration remains implementation-phase specific.

### WhatsApp Provider
- A provider or gateway is required for outbound WhatsApp delivery and callback handling.
- Production provider selection is still open and tracked in `docs/open-questions-and-challenges.md`.

### Windows Agent
- A compatible C# Windows Agent is required for end-to-end desktop delivery validation.
- Realtime protocol details must remain compatible with the documented push-first interaction model.

### HR Or Organization Data Source
- External scheduled synchronization is the expected source of baseline organization data.
- Ownership boundaries for overrides must remain explicit and documented.

## Observability Baseline
Minimum operational visibility should include:
- structured application logs
- audit logging for publish, cancel, role changes, and scope changes
- connector error visibility
- delivery failure visibility by channel
- agent heartbeat freshness visibility
- realtime connection health visibility

## Non-Production Test Data Guidance
- Use synthetic or sanitized organization data where possible.
- Avoid production recipient data in local development.
- Separate connector sandbox traffic from live production traffic.

## Open Deployment Questions
- Exact hosting topology for the realtime boundary is not yet fixed.
- Exact production secret management solution is not yet fixed.
- Exact production deployment platform is not yet fixed.
- Provider-specific callback security and retry semantics depend on WhatsApp provider selection.

## Recommended Next Additions
Add environment-specific detail to this document when implementation begins, including:
- actual deployment platform
- CI or CD flow
- migration command conventions
- secret manager choice
- backup and restore procedure
- rollback runbook links
