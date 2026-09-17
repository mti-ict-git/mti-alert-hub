# MTI Alert Security And Access Model

## Document Status
- Version: `0.1`
- Status: `Draft Baseline`
- Last Updated: `2026-09-01`

## Purpose
This document captures the current security posture for the desktop-first release path and the minimum rules that must remain true in production.

## Admin Access
- Admin authentication uses LDAP or Active Directory-backed credentials.
- MTI Alert remains the source of authorization and scope mapping.
- Protected admin routes require a valid bearer session token.
- Unauthenticated requests to protected admin routes must continue to return `401`.
- Admin session TTL is now configurable through `ADMIN_SESSION_TTL_MINUTES`.
- Admin operators may rotate the current bearer token through `POST /auth/rotate-session`, which invalidates the previous token immediately.

## Windows Agent Trust Model
- Windows Agent delivery remains device-centric for the first live release.
- Device sessions are renewable and tied to known device records.
- Unknown Windows Agent endpoints may create pending enrollment requests for operator review, but they must not receive trusted sessions until approved into the device baseline.
- Active user context from the desktop remains optional audit metadata, not the primary recipient identity.
- Windows Agent response submission must continue to use the dedicated agent session path, not admin-side delivery response endpoints.
- Device session TTL is now configurable through `AGENT_SESSION_TTL_MINUTES`.
- Operators may revoke active device access through `POST /devices/{deviceId}/revoke-session`, which invalidates persisted device tokens and disconnects active realtime streams.

## Release Scope Guardrails
- The first live release must expose only `WindowsAgent` delivery in production.
- Backend enforcement is controlled through `ENABLED_DELIVERY_CHANNELS`.
- Admin UI exposure is controlled through `VITE_ENABLED_DELIVERY_CHANNELS`.
- Requests that attempt to create or publish communications with a disabled channel must be rejected by the backend.

## Secrets And Environment Handling
- LDAP bind credentials, database credentials, and production API base URLs are secrets or sensitive operational configuration.
- Secrets must not be hardcoded in source code or documentation examples.
- Production deployments must use environment-specific secret management rather than shared development values.
- Production LDAP configuration must use `ldaps://` unless `LDAP_ALLOW_INSECURE_URL=true` is explicitly approved for a controlled exception.
- `LDAP_SKIP_TLS_VERIFY=true` is not accepted in production.
- The structured logger now redacts common sensitive keys such as `password`, `token`, `authorization`, and bind-password fields before emitting log output.

## Audit Expectations
- Publish, cancel, response recording, and response-state transitions must remain audit-visible.
- IP address and actor username should be preserved where the current runtime can provide them.

## Remaining Hardening Work
- Admin session persistence beyond the current in-memory baseline.
- Production review of log retention and audit-log access boundaries.

### Organization master edits

GET /organization and POST/PATCH /organization/{kind}[/{id}] require CentralAdmin through the server role guard. Reference endpoints keep existing read contracts. External-owned entries cannot be modified through organization management, even by CentralAdmin. Edit requests require matching updatedAt and audit writes are transactional.

## Proposed Users & Access extension

See [users-access-contract.md](users-access-contract.md) for the Phase 4 draft role/permission matrix, scope, bootstrap and session-revocation contract. It is not implemented. Current AccessProfileService still defaults authenticated directory users to CentralAdmin/Global; removing that default with a reviewed bootstrap is an explicit acceptance requirement.

### Managed-access source implementation and activation hold (2026-09-17)

The permission catalog, persistent sessions, directory identity reconciliation, resource guards, job provenance and Users & Access UI are implemented and tested in isolation. The prior “not implemented” statement applies to the former milestone. The default runtime still uses legacy authentication because automatic approval review rejected final unconditional activation; do not treat source completion as a deployed security boundary. The coordinated activation and maintenance-window requirements are specified in users-access-cutover.md. No environment switch restores automatic privileges after the planned cutover.

## Source activation approved and completed — 2026-09-17

This entry supersedes the earlier activation-hold status. The user explicitly approved managed authentication with migration 0020 and verified Administrator startup prerequisites. The default backend now uses PersistentAuthService/PersistentAccessSessionStore, always registers the access routes, enforces the closed administrative route manifest and enables queued agent job authorization. The legacy auto-admin fallback and internal managedAccess option have been removed from application bootstrap. Startup checks prerequisites before serving HTTP and closes the database on prerequisite failure.

Backend build/typecheck and targeted bootstrap lint passed. The authorization suite passed 57 tests (the two explicit PostgreSQL suites skip without a test URL); the separate isolated PostgreSQL/HTTP run passed all 9 TAP tests. Frontend source is unchanged from the previously verified production build. Production migration 0020, Docker redeploy and live AD acceptance remain pending. Source is ready for the coordinated cutover sequence in docs/users-access-cutover.md; this is not a claim that production has been upgraded. Phase 4 remains In Progress until production acceptance.
