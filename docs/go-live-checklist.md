# MTI Alert Go-Live Checklist

## Document Status
- Version: `0.1`
- Status: `Working Checklist`
- Last Updated: `2026-07-07`
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
- `docs/phase-1-execution-plan.md`
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
- admin users can browse templates
- admin users can create and edit communication drafts
- admin users can review draft details without mock-only behavior
- the admin app can talk to the backend using the documented auth flow
- critical backend and frontend happy paths are stable enough for operational use

The first live release does **not** require:
- real organization ingestion
- fully accurate audience preview from real org data
- publish orchestration
- scheduling
- Windows Agent delivery
- WhatsApp delivery
- response workflow execution
- dashboards and monitoring reports

## Release Scope
### Must Work Before Go-Live
- `POST /auth/login`, `POST /auth/logout`, and `GET /auth/me` work from the UI and directly at API level.
- Protected admin routes reject unauthenticated access with the expected status codes.
- `GET /templates` and `GET /templates/{templateId}` return usable policy data for the admin UI.
- `GET /communications`, `POST /communications`, `GET /communications/{communicationId}`, `PATCH /communications/{communicationId}`, and `POST /communications/{communicationId}/duplicate` work end to end.
- Template-locked field validation is enforced in the backend and produces predictable errors.
- Frontend draft flows use backend data rather than legacy mock-only services for the main happy path.
- Backend build and typecheck pass.
- Frontend build passes.

### Acceptable For First Release
- Organization reference endpoints may return empty-state payloads.
- `GET /employees` and `GET /devices` may return empty-state payloads.
- `POST /communications/{communicationId}/audience-preview` may be present but operationally limited if real org data is not loaded.
- Scope enforcement may still rely on the current global-scope placeholder as long as unauthorized and unauthenticated behavior is still protected.
- Admin detail pages may show placeholder or empty-state sections for delivery tracking, recipient logs, or response metrics that belong to later phases.

### Explicitly Deferred Post-Go-Live
- HR or organization baseline ingestion
- real audience resolution accuracy from imported org and device data
- `POST /communications/{communicationId}/cancel`
- `POST /communications/{communicationId}/publish`
- scheduling and recurring execution
- Windows Agent session, realtime, heartbeat, displayed, read, and response endpoints
- WhatsApp outbound delivery and callback ingestion
- monitoring dashboards, audit-heavy reporting, and delivery analytics

## Stop-Ship Conditions
- Admin users cannot log in successfully with valid credentials.
- Authenticated admin users cannot keep a usable session for normal page navigation.
- Draft creation, draft update, or draft detail retrieval fail on the main happy path.
- Frontend build or backend build fails.
- Protected endpoints return obviously incorrect auth behavior, such as public access where auth is expected.
- The UI still depends on a mock path for the primary draft authoring flow without a working backend fallback.
- A documented Phase 1 endpoint used by the UI returns a contract-breaking response shape.

## Minimum Manual Verification
Before release, verify at least these paths:

1. Login with a valid admin account.
2. Load the templates page successfully.
3. Open the new communication flow.
4. Create a draft from a template.
5. Re-open the draft detail page.
6. Edit and save the draft.
7. Duplicate the draft.
8. Confirm unauthenticated access to protected pages or APIs is rejected.
9. Run backend build and typecheck.
10. Run frontend build.

## Recommended Release Evidence
Capture this evidence before declaring release-ready:
- backend `typecheck` passed
- backend `build` passed
- frontend `build` passed
- login smoke test passed
- draft create, edit, detail, and duplicate smoke test passed
- unauthorized access challenge passed
- known limitations are listed explicitly for stakeholders

## Known First-Release Limitations
- Audience preview is not a release blocker and may be incomplete without real org or device data.
- Organization, employee, and device reference data may be empty in the first release.
- Delivery execution, tracking, and monitoring remain later-phase work.
- Windows Agent and WhatsApp runtime delivery are not part of this first live cutoff.

## Recommended Next Focus
After this checklist is accepted, the recommended implementation focus is:
- stabilize login and session behavior in the real environment
- finish any remaining draft-happy-path gaps in the UI
- verify contract alignment for the endpoints already used by the admin app
- fix release-blocking build, validation, or auth issues before touching deferred scope
