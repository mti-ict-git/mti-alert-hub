# MTI Alert Deployment And Environment

## Document Status
- Version: `0.1`
- Status: `Draft Baseline`
- Last Updated: `2026-07-07`
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
