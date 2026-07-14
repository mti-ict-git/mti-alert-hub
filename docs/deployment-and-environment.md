# MTI Alert Deployment And Environment

## Document Status
- Version: `0.2`
- Status: `Draft Baseline`
- Last Updated: `2026-07-14`
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
- enabled delivery channels for the current release scope

Current implementation baseline:
- `ENABLED_DELIVERY_CHANNELS` now controls which backend delivery channels may be used by create, update, and publish flows. The desktop-first live default is `WindowsAgent`.
- `VITE_ENABLED_DELIVERY_CHANNELS` now controls which delivery channels are shown in the admin compose and edit flows. The desktop-first live default is `DesktopAgent`.

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

Current implementation baseline:
- `POST /agent/realtime/negotiate` now builds `connectionUrl` from the inbound request host by default, so shared-environment and remote Windows Agent clients do not receive a loopback-only `localhost` stream URL.
- Reverse-proxied or split-host deployments may override that derived value with `BACKEND_PUBLIC_BASE_URL` when the externally reachable realtime base URL differs from the immediate request host.

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
- `POST /auth/rotate-session` now provides an authenticated admin token-rotation baseline and invalidates the previous bearer token immediately.
- `ADMIN_SESSION_TTL_MINUTES` and `AGENT_SESSION_TTL_MINUTES` now control the default session expiry windows for admin and Windows Agent sessions.
- Group-based access admission may be controlled through `LDAP_ALLOWED_GROUPS`.
- `LDAP_ALLOWED_GROUPS` should be configured as either:
  - a single full LDAP group DN
  - multiple full group DNs separated by `;`
  - a JSON array of full group DNs
- Comma-separated parsing is unsafe for LDAP DNs because a single DN already contains commas.
- `LDAP_URL` must use `ldaps://` in production unless `LDAP_ALLOW_INSECURE_URL=true` is set explicitly for a controlled exception path.
- `LDAP_SKIP_TLS_VERIFY=true` is rejected in production; local and shared-development runtimes may still use relaxed TLS verification for internal directory infrastructure.

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

Current implementation baseline:
- Every HTTP response now echoes `X-Request-Id`, using the inbound header when supplied or a generated value otherwise.
- Backend request lifecycle logs now include `requestId` and `actorUsername` where available for request-level correlation.
- `GET /health/diagnostics` now returns explicit warning and critical `alerts` in addition to raw counters so operators can prioritize expiring sessions, stale realtime connections, and other degraded states more quickly during desktop-first live operations.
- A desktop-first container baseline now exists through `Dockerfile.backend`, `Dockerfile.frontend`, `docker-compose.yml`, `docker-compose.with-postgres.yml`, and `.env.docker.example`.
- The frontend Docker build must use `NITRO_PRESET=node-server`; the default local Lovable build preset remains Cloudflare-oriented and is not the correct runtime target for the current Docker path.

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

## Docker Baseline
### Scope
The current Docker baseline is intended for:
- local parity across frontend, backend, and PostgreSQL
- shared integration bring-up for the desktop-first stack
- early staging or pre-production rehearsal once environment secrets are provided

The current Docker baseline is not yet a full production platform package. In particular:
- LDAP certificate and network requirements remain environment-specific
- reverse proxy or TLS termination is still expected to be handled outside this compose file
- external managed PostgreSQL can still replace the bundled container by changing `POSTGRES_URL`

### Artifacts
- `Dockerfile.backend`
- `Dockerfile.frontend`
- `docker-compose.yml`
- `docker-compose.with-postgres.yml`
- `.env.docker.example`
- `.dockerignore`

### Usage
1. Copy `.env.docker.example` to `.env.docker`.
2. Replace placeholder PostgreSQL and LDAP values.
3. If PostgreSQL is already managed outside Docker, run `docker-compose --env-file .env.docker up --build`.
4. If PostgreSQL should also run inside Docker, run `docker-compose --env-file .env.docker -f docker-compose.yml -f docker-compose.with-postgres.yml up --build`.
5. Access the admin UI on `http://localhost:8080` and backend API on `http://localhost:4019`.

If the host uses the newer Compose plugin, `docker compose --env-file .env.docker up --build` is equivalent.

### Runtime Notes
- The backend container runs `node backend/dist/scripts/run-migrations.js up` before starting the API server.
- The frontend container builds TanStack Start SSR with `NITRO_PRESET=node-server` and serves `.output/server/index.mjs` on port `8080`.
- `VITE_API_URL` should remain a browser-reachable URL such as `http://localhost:4019`; do not point it at the internal Compose hostname because the browser cannot resolve container-only names.
- Keep `ENABLED_DELIVERY_CHANNELS=WindowsAgent` and `VITE_ENABLED_DELIVERY_CHANNELS=DesktopAgent` for the approved desktop-first live scope.
- The base `docker-compose.yml` assumes PostgreSQL already exists and only starts `frontend` plus `backend`.
- `docker-compose.with-postgres.yml` is an optional overlay that adds a local PostgreSQL container and rewires `POSTGRES_URL` to `postgres:5432`.

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
- `2026-07-09`: the local backend CORS allowlist was expanded for frontend development origins on `3000`, `3001`, and `8080` in addition to the existing `8081`, `4173`, and `5173` origins, covering both `localhost` and `127.0.0.1` loopback forms used during admin UI testing.
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
- `2026-07-09`: a dedicated verification runtime on `BACKEND_PORT=4020` confirmed the Phase 3 response-monitoring baseline end to end: admin login succeeded, a Windows Agent communication with workflow `11111111-1111-1111-1111-111111111111` was created and published to `device-mti-ops-01`, the agent submitted response option `safe`, and `GET /communications/{communicationId}/responses` returned the persisted response plus `actorUserIdentifier` with `totalItems = 1`.
- `2026-07-09`: a dedicated verification runtime on `BACKEND_PORT=4021` confirmed the Phase 3 dashboard summary baseline: admin login succeeded, `GET /dashboard/overview` returned persisted aggregate metrics for active communications, pending recipients, delivered jobs, responding recipients, failed jobs, and overdue responses, and the endpoint no longer failed after aligning the query with `delivery_jobs.job_status`.
- `2026-07-09`: a dedicated verification runtime on `BACKEND_PORT=4022` confirmed the Phase 3 recipient-level monitoring baseline: admin login succeeded, one device-targeted Windows Agent communication and one employee-targeted WhatsApp communication were published, and `GET /communications/{communicationId}/deliveries` returned a `Device` recipient with populated `deviceId`, `deviceIdentifier`, and `hostname`, plus a `ContactEndpoint` recipient with populated `channelEndpoint`.
- `2026-07-09`: `npm run backend:build` was required before runtime verification of the new reporting route because `backend:start` serves `backend/dist`; after rebuilding, a dedicated verification runtime on `BACKEND_PORT=4023` confirmed `GET /dashboard/content-type-rollups` and the enriched `GET /communications` summary fields end to end through published `Alert` and `News` communications plus agent `Displayed`, `Read`, and `Responded` lifecycle evidence.
- `2026-07-09`: `npm run backend:migrate` applied migration `0008_phase3_overdue_followup.up.sql`, which added persisted overdue support through `communication_recipients.follow_up_triggered_at`, expanded `communication_recipients.response_state` to include `Overdue`, and expanded `delivery_events.event_type` to include `Overdue`.
- `2026-07-09`: a dedicated verification runtime on `BACKEND_PORT=4024` confirmed the Phase 3 overdue baseline end to end: the seeded response workflow timeout was temporarily set to `0` for the smoke, a response-required Windows Agent `Alert` was published to `device-mti-ops-01`, `GET /agent/messages` triggered server-side timeout evaluation, and `GET /communications/{communicationId}/deliveries` then returned `responseState = Overdue`, an `Overdue` delivery event, and a re-queued `Pending` job for recipient-only follow-up; the workflow timeout was restored after verification.
- `2026-07-09`: `npm run backend:migrate` also applied migration `0009_phase3_audit_logs.up.sql`, which created the append-only `audit_logs` baseline table with `actor_username`, `metadata_json`, and indexed `created_at` / entity lookup support for audit queries.
- `2026-07-09`: a dedicated verification runtime on `BACKEND_PORT=4025` confirmed the Phase 3 auditability baseline end to end: a template override rejection was forced against template `aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa`, a response-required Windows Agent `Alert` was published to `device-mti-ops-01`, an agent response was submitted, the communication was cancelled, and `GET /audit-logs` then returned matching `TemplateOverrideRejected`, `PublishCommunication`, `CommunicationStatusChanged`, `RecordResponse`, `RecipientResponseStateChanged`, and `CancelCommunication` rows with actor usernames and request IP addresses.
- `2026-07-14`: a dedicated verification runtime on `BACKEND_PORT=4026` confirmed the Phase 3 workflow baseline end to end: after intentionally drifting the canonical workflow seed in PostgreSQL, backend bootstrap restored the managed workflow baseline before serving traffic, and admin login plus `GET /workflows` then returned `totalItems = 2` with the canonical `Critical Acknowledgement` and `Reminder Confirmation` definitions plus their expected ordered options.
- `2026-07-14`: a dedicated verification runtime on `BACKEND_PORT=4027` confirmed the Phase 3 compatible-channel response baseline end to end: an admin published a `Reminder` to an employee over `WhatsApp`, `GET /communications/{communicationId}/deliveries` returned a `ContactEndpoint` delivery job with `channelEndpoint = +628000000001`, `POST /communications/{communicationId}/deliveries/{deliveryJobId}/response` then recorded response option `done`, and the same runtime confirmed `GET /communications/{communicationId}/responses` plus `GET /audit-logs` both reflected the new `WhatsApp` response evidence.
- `2026-07-14`: a dedicated verification runtime on `BACKEND_PORT=4028` confirmed the Phase 4 desktop-first release-scope guardrail baseline: with `ENABLED_DELIVERY_CHANNELS=WindowsAgent`, admin login still succeeded, a `WindowsAgent` draft could still be created, and a `WhatsApp` draft request was rejected with `422 CHANNEL_NOT_ENABLED`.
- `2026-07-14`: Phase 4 security and observability hardening now includes configurable `ADMIN_SESSION_TTL_MINUTES` and `AGENT_SESSION_TTL_MINUTES`, an authenticated `GET /health/diagnostics` endpoint for operational visibility, and `POST /devices/{deviceId}/revoke-session` for device trust revocation during desktop-first live operations.
- `2026-07-14`: a dedicated verification runtime on `BACKEND_PORT=4029` confirmed the new diagnostics and device-revocation baseline end to end: admin login succeeded, a Windows Agent session and SSE negotiation established one persisted and in-memory realtime connection, `GET /health/diagnostics` returned database/session/realtime summaries with TTL values, `POST /devices/{deviceId}/revoke-session` revoked the active device token and disconnected the realtime connection, and a subsequent `POST /agent/heartbeat` with the revoked token failed with `401 UNAUTHORIZED`.
- `2026-07-14`: a dedicated verification runtime on `BACKEND_PORT=4030` confirmed the new admin session rotation and directory-security baseline: `POST /auth/rotate-session` returned a new bearer token for the current admin account, the previous token immediately failed against `GET /auth/me` with `401`, and a separate production-mode startup on `BACKEND_PORT=4031` failed fast when `LDAP_URL=ldap://...` was supplied without an explicit insecure override.
- `2026-07-14`: a dedicated verification runtime on `BACKEND_PORT=4032` confirmed the observability hardening baseline: the backend echoed `X-Request-Id=phase4-observability-request` from an authenticated `GET /health/diagnostics`, diagnostics returned warning alerts for expiring admin and agent sessions when TTL values were intentionally reduced to `10` minutes, and backend stdout included a matching `http.request.completed` log entry with the same request ID for correlation.
- `2026-07-14`: the desktop-first Docker baseline was added through `Dockerfile.backend`, `Dockerfile.frontend`, `docker-compose.yml`, `docker-compose.with-postgres.yml`, `.dockerignore`, and `.env.docker.example`; focused verification confirmed `npm run backend:build` still passed, `NITRO_PRESET=node-server npm run build` generated a Node-runnable `.output/server/index.mjs`, and the resulting frontend runtime listened successfully on `http://127.0.0.1:4090`.

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
