# MTI Alert Operational Runbook

## Document Status
- Version: `0.1`
- Status: `Draft Baseline`
- Last Updated: `2026-07-14`
- Audience: `Operations`, `Backend Engineers`, `On-Call Support`

## Purpose
This runbook defines the minimum deployment, rollback, and incident workflow for the desktop-first live release path.

## Release Scope
- Current first live release scope is `Windows Agent` / desktop delivery only.
- `WhatsApp`, `Email`, and `Digital Signage` remain out of the current live release scope unless explicitly enabled for a controlled environment.

## Required Environment Guardrails
### Backend
- `ENABLED_DELIVERY_CHANNELS=WindowsAgent`
- `BACKEND_PORT`
- `BACKEND_PUBLIC_BASE_URL` when the public realtime URL differs from the inbound request host
- `ADMIN_SESSION_TTL_MINUTES`
- `AGENT_SESSION_TTL_MINUTES`
- `LDAP_URL` using `ldaps://` for production by default
- `LDAP_ALLOW_INSECURE_URL` only for an explicitly approved exception path
- `LDAP_SKIP_TLS_VERIFY` must remain unset or `false` in production
- `POSTGRES_URL` and related PostgreSQL overrides
- LDAP configuration values required for admin authentication

### Frontend
- `VITE_API_URL`
- `VITE_ENABLED_DELIVERY_CHANNELS=DesktopAgent`

## Deployment Procedure
1. Confirm `docs/openapi.yaml`, `docs/implementation-roadmap.md`, and this runbook reflect the intended release behavior.
2. Confirm database backup or snapshot readiness before applying production migrations.
3. Run `npm run backend:typecheck`.
4. Run `npm run backend:build`.
5. Run `npm run build` if the admin UI is part of the release path.
6. Run `npm run backend:migrate`.
7. Start the backend with production configuration and `ENABLED_DELIVERY_CHANNELS=WindowsAgent`.
8. Start the admin frontend with `VITE_ENABLED_DELIVERY_CHANNELS=DesktopAgent`.
9. Execute the desktop go-live smoke checklist before declaring the release healthy.

## Desktop Go-Live Smoke
1. `POST /auth/login` succeeds with a valid admin account.
2. `GET /health/diagnostics` returns `database.status = ok` and the expected enabled delivery channels.
3. Confirm the diagnostics payload shows sensible admin session, agent session, and realtime connection counts.
4. `POST /auth/rotate-session` returns a new bearer token and the previous token is rejected afterward.
5. Create a desktop-targeted draft with `channelSelections = ["WindowsAgent"]`.
6. Confirm `POST /communications/{communicationId}/audience-preview` completes.
7. Confirm `POST /communications/{communicationId}/publish` succeeds.
8. Confirm `POST /agent/session`, `POST /agent/realtime/negotiate`, `POST /agent/heartbeat`, and `GET /agent/messages` succeed for the target device.
9. Confirm `POST /agent/messages/{messageId}/displayed`, `POST /agent/messages/{messageId}/read`, and `POST /agent/messages/{messageId}/response` succeed for response-required messages.
10. Confirm `GET /communications/{communicationId}/deliveries`, `GET /communications/{communicationId}/responses`, and `GET /audit-logs` show the expected persisted evidence.
11. Challenge `POST /devices/{deviceId}/revoke-session` for an active test device and confirm the existing device token is rejected afterward.

## Rollback Procedure
1. Stop accepting new release traffic to the backend instance.
2. Restore the previous backend build artifact.
3. Restore the previous frontend build artifact if the UI changed.
4. Re-point runtime configuration to the previous known-good environment values.
5. If a migration introduced a release-blocking fault, follow the approved database rollback or restore process before reopening traffic.
6. Re-run the desktop go-live smoke before declaring rollback complete.

## Incident Response
### Backend Unavailable
1. Check `/health`.
2. Review backend logs for PostgreSQL connectivity or LDAP startup failure.
3. Restart the backend only after confirming configuration and database reachability.

### Realtime Push Degraded
1. Confirm `POST /agent/realtime/negotiate` still returns a valid SSE URL.
2. Confirm the target device can still recover pending messages through `GET /agent/messages`.
3. Treat push degradation as degraded service, not total outage, as long as reconciliation remains healthy.

### Unexpected Channel Usage
1. Check the backend environment value for `ENABLED_DELIVERY_CHANNELS`.
2. Check the frontend environment value for `VITE_ENABLED_DELIVERY_CHANNELS`.
3. Reject release if the live environment exposes channels outside the approved desktop-first scope.

## Stop-Ship Escalation
- Backend build, frontend build, or migration fails.
- Admin authentication fails for valid accounts.
- Windows Agent session, heartbeat, or reconciliation fails in the live candidate.
- Desktop-targeted publish does not produce reconcilable delivery rows.
- A non-approved channel is enabled in the live environment without an explicit release decision.
