# MTI Alert Go-Live Checklist

## Document Status
- Version: `0.2`
- Status: `Working Checklist`
- Last Updated: `2026-07-09`
- Audience: `Product Owner`, `Tech Lead`, `Backend Engineers`, `Frontend Engineers`

## Purpose
This document defines the minimum practical checklist for the first live release.

It is intentionally narrower than the full roadmap and is meant to answer:
- what must work before release
- what may remain empty or simplified for the first release
- what is explicitly deferred until after go-live
- what conditions should stop a release

## Source Of Truth
This checklist is derived from:
- `docs/implementation-roadmap.md`
- `docs/windows-agent-client-specification.md`
- `docs/openapi.yaml`
- `docs/testing-strategy.md`
- `docs/open-questions-and-challenges.md`

If there is a conflict, follow:
1. `docs/openapi.yaml` for backend contract behavior
2. `docs/implementation-roadmap.md` for active phase scope
3. this file for go-live prioritization only

## Go-Live Goal
The first live release is considered acceptable if:
- admin users can authenticate successfully
- admin users can create, review, and publish Windows Agent-targeted communications through an agreed operational path
- the backend can persist Windows Agent delivery state and recurring local reminder policy state
- a Windows Agent can create a trusted device session, negotiate a realtime connection, send heartbeat, reconcile pending messages, and report lifecycle evidence
- the server and the Windows Agent can remain operational even when realtime push is temporarily degraded by falling back to reconciliation
- critical backend and operator happy paths are stable enough for initial desktop-focused operational use

The first live release does **not** require:
- real organization ingestion
- fully accurate audience preview from real org data beyond loaded device baselines
- WhatsApp delivery
- dashboards and monitoring reports
- advanced multi-channel delivery rollups
- non-Windows-Agent channels

## Release Scope
### Must Work Before Go-Live
- `POST /auth/login`, `POST /auth/logout`, and `GET /auth/me` work from the UI and directly at API level.
- Protected admin routes reject unauthenticated access with the expected status codes.
- `GET /templates` and `GET /templates/{templateId}` return usable policy data for the admin UI.
- `GET /communications`, `POST /communications`, `GET /communications/{communicationId}`, `PATCH /communications/{communicationId}`, `POST /communications/{communicationId}/duplicate`, `POST /communications/{communicationId}/publish`, and `POST /communications/{communicationId}/cancel` work end to end through the agreed operator path.
- Template-locked field validation is enforced in the backend and produces predictable errors.
- Windows Agent-targeted publish produces `communication_schedules`, `communication_recipients`, `delivery_jobs`, `delivery_attempts`, and `delivery_events`.
- `POST /agent/session`, `POST /agent/realtime/negotiate`, `POST /agent/heartbeat`, `GET /agent/messages`, `POST /agent/messages/{messageId}/displayed`, `POST /agent/messages/{messageId}/read`, and `POST /agent/messages/{messageId}/response` work against the same persisted device and delivery state.
- `GET /agent/reminder-policies` and `POST /agent/reminder-policies/{policyId}/events` work for approved `AgentLocalRoutine` reminders.
- Device-targeted Windows Agent recipient resolution works against the loaded device baseline.
- Backend build and typecheck pass.
- Frontend build passes for any admin flow required by the chosen go-live path.

### Acceptable For First Release
- Organization reference endpoints may return empty-state payloads.
- `GET /employees` and `GET /devices` may return empty-state payloads.
- `POST /communications/{communicationId}/audience-preview` may be present but operationally limited if real org data is not loaded.
- Scope enforcement may still rely on the current global-scope placeholder as long as unauthorized and unauthenticated behavior is still protected.
- Admin detail pages may show placeholder or empty-state sections for dashboards, audit-heavy metrics, or non-Windows-Agent delivery analytics.
- Realtime negotiation may initially reuse the persisted device session token as a compatibility access token while a dedicated hub token issuer is still absent.

### Explicitly Deferred Post-Go-Live
- HR or organization baseline ingestion
- real audience resolution accuracy from imported org and device data
- WhatsApp outbound delivery and callback ingestion
- monitoring dashboards, audit-heavy reporting, and delivery analytics
- provider-specific delivery normalization outside the Windows Agent path

## Current Assessment
### Release-Critical Blockers
- No release-critical blocker is currently confirmed in the admin publish and cancel path.

### Non-Blocking Deferrals
- WhatsApp connector selection and provider callbacks
- reporting dashboards and audit-heavy aggregates
- non-device-bound Windows Agent local routine recipients
- production-grade realtime scaling, selective event fan-out, and dedicated token issuance beyond the first compatible hub slice
- richer admin-side delivery monitoring beyond the current thin recipient and event visibility baseline

## Stop-Ship Conditions
- Admin users cannot log in successfully with valid credentials.
- Authenticated admin users cannot keep a usable session for normal page navigation.
- Draft creation, draft update, publish, or cancel fail on the agreed operator happy path.
- A Windows Agent cannot create a session, negotiate realtime metadata, send heartbeat, and reconcile pending messages against the same device identity.
- The negotiated realtime URL does not correspond to a working server endpoint by the time the Windows Agent go-live cut is declared.
- Windows Agent-targeted publish does not result in a reconcilable pending message or synchronized local reminder policy when the scenario requires one.
- Frontend build or backend build fails.
- Protected endpoints return obviously incorrect auth behavior, such as public access where auth is expected.
- The chosen operator path still depends on a mock-only publish or cancel flow without a documented backend-backed fallback.
- A documented agent endpoint used by the Windows client returns a contract-breaking response shape.

## Minimum Manual Verification
Before release, verify at least these paths:

1. Login with a valid admin account.
2. Create a Windows Agent-targeted draft from a template.
3. Preview the audience and confirm the expected device recipient coverage.
4. Publish the communication and confirm delivery rows are created.
5. Create a Windows Agent session and negotiate realtime metadata.
6. Send heartbeat from the same device session.
7. Reconcile pending messages through `GET /agent/messages`.
8. Report `Displayed`, `Read`, and `Responded` where applicable.
9. Fetch reminder policies and report a reminder event when a local routine scenario is in scope.
10. Confirm unauthenticated or mismatched-device calls are rejected.
11. Run backend migrations, build, and typecheck.
12. Run frontend build if the admin UI is part of the go-live path.

## Recommended Release Evidence
Capture this evidence before declaring release-ready:
- backend `typecheck` passed
- backend `build` passed
- backend `migrate` passed
- frontend `build` passed if the admin UI is in release scope
- login and Windows Agent-targeted publish smoke test passed
- agent session, heartbeat, reconciliation, and lifecycle evidence smoke test passed
- realtime hub connect and publish-push smoke test passed
- reminder policy sync smoke test passed for any local routine reminders included in the release scope
- unauthorized and mismatched-device challenge passed
- known limitations are listed explicitly for stakeholders

## Known First-Release Limitations
- Audience preview is not a release blocker and may be incomplete without real org or device data.
- Organization, employee, and device reference data may be empty in the first release.
- WhatsApp runtime delivery is not part of this first live cutoff.
- Realtime technology and scaling shape are still constrained by the first compatible `SSE` hub implementation.
- Admin monitoring views remain intentionally thin: recipient snapshots and recent delivery logs are backend-backed, but deeper device-support views, dashboards, and audit-heavy analytics are still deferred.

## Recommended Next Focus
After this checklist is accepted, the recommended implementation focus is:
- validate the current thin admin delivery visibility in a real operator session before expanding reporting scope
- validate the current admin publish and cancel flow in a real operator session before expanding deferred scope
- validate the Windows Agent lifecycle evidence path in a real client session, including displayed and read submission after reconnect recovery
- confirm operational handoff readiness for the Windows Agent engineer using the current `SSE` baseline documents
