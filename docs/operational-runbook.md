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
- `BACKEND_PUBLIC_BASE_URL` when the public realtime URL differs from the inbound request host, and never as `localhost` for remote Windows Agent clients
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
- `DOCKER_VITE_API_URL=/api` for the Docker publish path so browser traffic stays same-origin through the admin gateway

### Docker Baseline
- Use `.env.docker` derived from `.env.docker.example` for container-focused startup instead of overwriting the local `.env` used by non-Docker development.
- Build the frontend container with `NITRO_PRESET=node-server`.
- The Docker publish path now exposes the admin UI through an `nginx` gateway; keep browser API traffic same-origin by using `DOCKER_VITE_API_URL=/api` for container builds.
- The Docker `nginx` gateway also fronts MSI upload traffic for `Settings > Desktop Agent`; keep `docker/nginx.admin-gateway.conf` at `client_max_body_size 512m` or higher so package uploads do not fail with `413 Request Entity Too Large`.
- The same gateway must proxy public package download links under `/agent/packages/*` to the backend service; otherwise uploaded rollout packages will appear in admin metadata but public download links will return the frontend `404` page.
- The base `docker-compose.yml` assumes PostgreSQL is already managed outside Docker.
- Use `docker-compose.with-postgres.yml` only when a local PostgreSQL container is actually needed.

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

### Docker Deployment Path
1. Copy `.env.docker.example` to `.env.docker` and populate environment-specific secrets.
2. If PostgreSQL is already available outside Docker, run `docker-compose --env-file .env.docker up --build`.
3. If PostgreSQL should run in Docker too, run `docker-compose --env-file .env.docker -f docker-compose.yml -f docker-compose.with-postgres.yml up --build`.
4. Wait for the active service healthchecks to pass.
5. Confirm the backend applied migrations during container startup before handing traffic to operators.
6. Route public admin traffic to the gateway port, not directly to the frontend container port.
7. Execute the desktop go-live smoke against the admin origin and the backend health path.

If the host uses the newer Compose plugin, `docker compose --env-file .env.docker up --build` is equivalent.

## Desktop Go-Live Smoke
1. `POST /auth/login` succeeds with a valid admin account.
2. `GET /health/diagnostics` returns `database.status = ok` and the expected enabled delivery channels.
3. Confirm the diagnostics payload shows sensible admin session, agent session, and realtime connection counts.
4. Confirm the response echoes `X-Request-Id` and that the same request ID appears in backend request-completion logs.
5. `POST /auth/rotate-session` returns a new bearer token and the previous token is rejected afterward.
6. Create a desktop-targeted draft with `channelSelections = ["WindowsAgent"]`.
7. Confirm `POST /communications/{communicationId}/audience-preview` completes.
8. Confirm `POST /communications/{communicationId}/publish` succeeds.
9. Confirm `POST /agent/session`, `POST /agent/realtime/negotiate`, `POST /agent/heartbeat`, and `GET /agent/messages` succeed for the target device.
10. Confirm `POST /agent/messages/{messageId}/displayed`, `POST /agent/messages/{messageId}/read`, and `POST /agent/messages/{messageId}/response` succeed for response-required messages.
11. Confirm `GET /communications/{communicationId}/deliveries`, `GET /communications/{communicationId}/responses`, and `GET /audit-logs` show the expected persisted evidence.
12. Challenge `POST /devices/{deviceId}/revoke-session` for an active test device and confirm the existing device token is rejected afterward.

For Docker HTTPS deployments, challenge login from the public admin origin and confirm the browser issues `POST /api/auth/login` to the same origin instead of calling a raw backend IP or triggering mixed-content / CORS failures.

## Windows Agent Package Release Path
1. Build the final `MSI` with the environment-specific agent configuration already baked in. Do not plan on editing `appsettings.json` inside the `MSI` after signing.
2. The release path should be thought of as three explicit stages:
   - `prepare package`: sign or inspect the `MSI`, compute `sha256`, confirm signer thumbprint, and derive the target version
   - `publish package`: place the exact signed `MSI` on the final immutable package URL
   - `create rollout`: register the approved metadata in the backend for the target device or rollout scope
3. For corporate `AD CS` or other Windows certificate-store flows, the easiest wrapper is:

```powershell
powershell -ExecutionPolicy Bypass -File ".\mti.alert.agent\Installer\invoke-agent-rollout.ps1" -CertThumbprint "<CODE_SIGNING_CERT_THUMBPRINT>" -CertStoreLocation CurrentUser -PackageUrl "https://downloads.example.com/MTI.Alert.Agent.Setup.msi"
```

4. Confirm the JSON output reports the expected `Version`, `Sha256`, `Thumbprint`, and `SignatureStatus`.
5. Publish the exact signed `MSI` to an immutable package URL. Do not modify or repackage the file after signing, because checksum and signature evidence will change.
6. Run the emitted `RolloutCommand` to register the approved package metadata and rollout intent through the backend helper, or repeat the same wrapper with `-ApplyRollout` once the package URL is already live.
7. Monitor rollout progress through agent status, updater state, and backend rollout status events.

Frontend-assisted rollout is now also available from the `Devices` admin page:
- the backend exposes `GET /devices/rollout-packages/local` so the UI can discover `backend/local-packages` candidates
- the backend exposes `POST /devices/rollout-packages/upload` so the UI can upload a locally built `MSI` from the operator browser into the backend package store
- the backend exposes `POST /devices/{deviceId}/rollouts` so the UI can dry-run or apply a device-scoped rollout intent
- the frontend operator flow is now split by responsibility:
  1. open `Settings > Desktop Agent`
  2. upload a signed local `MSI` from the operator machine into the global package registry
  3. review the discovered package metadata in the same Desktop Agent settings tab
  4. open `Devices`
  5. click `Rollout` on the target device
  6. select one of the globally registered packages
  7. review or adjust the package metadata if signature thumbprint must be entered manually
  8. run `Preview Rollout`
  9. run `Apply Rollout`

Operational note:
- package signing and immutable publishing still happen before the admin UI step; the frontend flow creates rollout intent, it does not sign or repackage `MSI` artifacts
- UI upload is a browser-to-backend transfer, so a Dockerized backend must keep `backend/local-packages` on a persistent volume or shared storage path if uploaded artifacts must survive container replacement
- package upload is treated as a global package-management concern under `Settings > Desktop Agent`, while `Devices > Rollout` remains a device-scoped execution surface
- local rollout helper scripts may now resolve signing configuration from the repo `.env` file via `AGENT_CODE_SIGNING_CERT_THUMBPRINT` and `AGENT_CODE_SIGNING_CERT_STORE_LOCATION`, so operators do not need to remember or retype the code-signing thumbprint on every prepare/apply command
- if backend runtime inspection cannot recover signer thumbprint automatically for a package, the operator must paste the signer thumbprint manually in the rollout dialog before preview/apply
- local package discovery always recomputes `sha256`, so hash evidence remains available even when signature metadata falls back to manual entry

For local backend validation, omitting `-PackageUrl` now uses the backend-local publish path automatically:
- the wrapper copies the signed `MSI` to `backend/local-packages/`
- the backend serves it from `GET /agent/packages/local/{fileName}`
- restart the backend runtime after adding or changing this route so the current process recognizes the package endpoint

For local-only lab validation where a self-signed test certificate is acceptable, the compatibility helper remains:

```powershell
powershell -ExecutionPolicy Bypass -File ".\mti.alert.agent\Installer\sign-local-rollout-test.ps1"
```

This wrapper now delegates to the same general preparation helper while still creating and trusting a local test certificate automatically.

Example one-command path once the package URL is already live:

```powershell
powershell -ExecutionPolicy Bypass -File ".\mti.alert.agent\Installer\invoke-agent-rollout.ps1" -CertThumbprint "<CODE_SIGNING_CERT_THUMBPRINT>" -CertStoreLocation CurrentUser -PackageUrl "https://downloads.example.com/MTI.Alert.Agent.Setup.msi" -ApplyRollout
```

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
4. If running with the PostgreSQL overlay, also confirm the `postgres` container healthcheck is green; otherwise confirm `POSTGRES_URL` still targets the intended external host.

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
