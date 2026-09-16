# Users & Access â€” Source Review and Verification

Status: Documentation review completed for this draft; runtime authorization coverage remains an implementation gate.
Date: 2026-09-16. No application behavior or production access was changed.

## Evidence and reconciliation

| Source inspected | Finding | Contract response |
|---|---|---|
| AGENTS.md; implementation-roadmap.md, Phase 4 source list/checklist | Phase 4 is active; document evidence is valid for contract work, not runtime acceptance | Keep implementation/migration checklist unchecked |
| project-plan.md; technical-implementation-plan.md Auth And Access | LDAP identity and local authorization; global placeholder was a Phase 1 allowance | Replace placeholder only at coordinated Phase 4 cutover |
| functional-specification.md Identity And Access | Three-role baseline and location-based authorization | Five roles are a confirmed extension, not current runtime |
| database-schema-specification.md users/user_scopes; migration 0001 | Existing users.role_type CHECK has three values; user_scopes supports Department/Section | Extend existing tables; no duplicate admin identity tables; review legacy grants |
| openapi.yaml AuthSession/AdminUser/AdminScope and /auth routes | Three roles, scopeType/scopeValue, existing session envelope | Keep scope shape; coordinate role expansion and effective-permission/version additions |
| access-profile-service.ts and access-guard.ts | Automatic CentralAdmin/Global; role helper exists | Bootstrap explicit admins and replace permissive resolver |
| auth-service.ts; admin-session-store.ts | Map-backed sessions, snapshot access, user ID derived from DN | PostgreSQL sessions/current version checks; internal user UUID + verified AD objectGUID |
| authenticated-directory-user.ts; ldap-authenticator.ts | No objectGUID in current user model/login attributes | Add binary GUID lookup/decoding and verified identity migration |
| security-and-access-model.md | Session/audit/secret boundaries, organization CentralAdmin guard | Preserve device trust; extend permission enforcement and transactional audit |
| testing-strategy.md | Negative authorization tests and document verification required | Explicit acceptance matrix; no claim that runtime tests passed |
| architecture-decisions.md | Modular Node/TypeScript backend and PostgreSQL | Reuse existing stack and tables |
| integration-contracts.md | Admin scope import remains placeholder/deferred | Do not infer application grants from HR/employee records |
| windows-agent-rollout-stage-1-contract.md | Agent retrieval uses device-session identity | Do not replace device auth with user-role guards |
| DESIGN.md and UX-CONTRACT.md | Existing English UI, shared primitives, theme ownership | Reuse shell/components; new UX is specified separately |

## Document challenges performed

- Reconciled all eight answers with matrix, session rules and screen behavior.
- Corrected the earlier Viewer export/detail prohibition.
- Removed the proposed duplicate admin_users/admin_scope_grants storage model.
- Resolved Pending against the existing non-null role column: migration must allow null only for Pending.
- Distinguished current DN-based identities from proposed immutable objectGUID identities.
- Clarified that historical report scope uses recipient location snapshots, not current device placement.
- Clarified partial-overlap reports: in-scope recipient details/export, redacted cross-scope notification content.
- Avoided promising immediate recall of offline agent routines or already accepted updater commands.
- Separated the document-review milestone from backend/UI implementation and staging acceptance.
- Checked local relative links, section presence, decision count and whitespace errors.

## Outstanding implementation gates

These are engineering validation tasks, not new unresolved choices among the eight product questions.

1. Verify objectGUID availability/decoding against the actual directory; map existing users/DNs without guessing.
2. Review every route/service query and asynchronous worker for permission and scope enforcement.
   The inventory below is static discovery only; absence of a route guard does not prove absence of service-level authorization.
3. Map shared templates, wellness programs, exports and global settings to explicit ownership/scope before coding those guards.
4. Validate PostgreSQL transaction/locking and shared-session load behavior; implement atomic last-admin protection.
5. Expand proposed endpoints into OpenAPI schemas and migration scripts, with compatibility tests, before shipping APIs.
6. Review background actor attribution and deactivation on reconnect for agent-local policies.
7. Name the initial production administrator through operator-verified identity during deployment; never embed credentials in docs.
8. Existing OpenAPI contains a previously observed duplicate mapping key; resolve/validate the full schema before API release.

No application build, database migration, security test, browser acceptance, or production deployment is claimed by this document.

## Static route inventory

Generated from explicit method/path declarations under backend/src/modules/*/controller/*routes.ts.
Dynamic route factories and background execution require additional implementation review.
Role declaration is descriptive baseline evidence, not the proposed authorization policy.

| Module | Method | Path | Current route role declaration |
|---|---|---|---|
| agent | GET | /agent/packages/local/{fileName} | No route-level role declaration |
| agent | POST | /agent/session | No route-level role declaration |
| agent | POST | /agent/realtime/negotiate | No route-level role declaration |
| agent | GET | /agent/realtime-hub | No route-level role declaration |
| agent | POST | /agent/heartbeat | No route-level role declaration |
| agent | GET | /agent/rollout-intent | No route-level role declaration |
| agent | POST | /agent/rollout-status | No route-level role declaration |
| agent | GET | /agent/messages | No route-level role declaration |
| agent | GET | /agent/reminder-policies | No route-level role declaration |
| agent | POST | /agent/messages/{messageId}/displayed | No route-level role declaration |
| agent | POST | /agent/messages/{messageId}/read | No route-level role declaration |
| agent | POST | /agent/messages/{messageId}/response | No route-level role declaration |
| agent | POST | /agent/reminder-policies/{policyId}/events | No route-level role declaration |
| audit | GET | /audit-logs | No route-level role declaration |
| auth | POST | /auth/login | No route-level role declaration |
| auth | GET | /auth/me | No route-level role declaration |
| auth | POST | /auth/logout | No route-level role declaration |
| auth | POST | /auth/rotate-session | No route-level role declaration |
| communications | GET | /templates | No route-level role declaration |
| communications | GET | /templates/{templateId} | No route-level role declaration |
| communications | GET | /communications | No route-level role declaration |
| communications | POST | /communications | No route-level role declaration |
| communications | GET | /communications/{communicationId} | No route-level role declaration |
| communications | GET | /communications/{communicationId}/reminder-activity | No route-level role declaration |
| communications | GET | /communications/{communicationId}/wellness-reporting | No route-level role declaration |
| communications | PATCH | /communications/{communicationId} | No route-level role declaration |
| communications | POST | /communications/{communicationId}/revise-wellness | No route-level role declaration |
| communications | POST | /communications/{communicationId}/audience-preview | No route-level role declaration |
| communications | POST | /communications/{communicationId}/publish | No route-level role declaration |
| communications | POST | /communications/{communicationId}/cancel | No route-level role declaration |
| communications | GET | /communications/{communicationId}/deliveries | No route-level role declaration |
| communications | GET | /communications/{communicationId}/responses | No route-level role declaration |
| communications | POST | /communications/{communicationId}/deliveries/{deliveryJobId}/response | No route-level role declaration |
| communications | POST | /communications/{communicationId}/duplicate | No route-level role declaration |
| dashboard | GET | /dashboard/overview | No route-level role declaration |
| dashboard | GET | /dashboard/content-type-rollups | No route-level role declaration |
| dashboard | GET | /dashboard/wellness-program-rollups | No route-level role declaration |
| devices | GET | /devices/{deviceId}/placement | CentralAdmin |
| devices | PATCH | /devices/{deviceId}/placement | CentralAdmin |
| devices | GET | /devices | No route-level role declaration |
| devices | GET | /devices/pending | No route-level role declaration |
| devices | GET | /devices/rollout-packages/local | No route-level role declaration |
| devices | GET | /devices/rollout-packages/github-sync | CentralAdmin |
| devices | POST | /devices/rollout-packages/github-sync | CentralAdmin |
| devices | POST | /devices/rollout-packages/upload | No route-level role declaration |
| devices | DELETE | /devices/rollout-packages/local/{fileName} | No route-level role declaration |
| devices | POST | /devices/pending/{requestId}/approve | No route-level role declaration |
| devices | POST | /devices/pending/{requestId}/reject | No route-level role declaration |
| devices | POST | /devices/{deviceId}/test-notification | No route-level role declaration |
| devices | POST | /devices/{deviceId}/rollouts | No route-level role declaration |
| devices | POST | /devices/{deviceId}/revoke-session | No route-level role declaration |
| health | GET | /health | No route-level role declaration |
| health | GET | /health/diagnostics | No route-level role declaration |
| organization | GET | /organization | CentralAdmin |
| organization | GET | /reference/organization | No route-level role declaration |
| organization | GET | /reference/sites | No route-level role declaration |
| organization | GET | /reference/areas | No route-level role declaration |
| organization | GET | /reference/departments | No route-level role declaration |
| organization | GET | /reference/sections | No route-level role declaration |
| organization | GET | /employees | No route-level role declaration |
| workflows | GET | /workflows | No route-level role declaration |
