# MTI Alert Security And Access Model

## Document Status
- Version: `0.1`
- Status: `Draft Baseline`
- Last Updated: `2026-07-14`

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
- Device quarantine or approval workflow beyond the current revoke-session control.
- Production review of log retention and audit-log access boundaries.
