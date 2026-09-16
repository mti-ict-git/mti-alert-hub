# Users & Access â€” Implementation Evidence

Status: **Foundation implemented; feature incomplete and not activated.**
The approved contract remains the product target. Do not deploy this as completed user management.

## Implemented in this slice

- Additive migration 0019 extends users/user_scopes compatibility and adds shared sessions/idempotency storage.
- Five-role permission catalog, explicit scope validation, emergency-permission predicate and AD GUID binary encoder/decoder.
- Pending identity registration without implicit role grants; verified GUID identity survives username changes.
- Transactional assignment/status/revoke service, normalized Site/Area grants, revision checks, idempotency,
  audit rollback and serialized last-active-administrator protection.
- PostgreSQL session store with hashed tokens, current authorizationVersion checks and atomic rotation.
- LDAP directory search/identity resolution and atomic initial access grants are implemented but not connected to live authentication.
- Access route factory for directory search, grant, list/detail/roles/assignment/status/revoke; it is intentionally not registered in bootstrap yet.
- Frontend typed access service, optional idempotency headers in the existing API client, shared Site/Area picker
  and read-only responsive role matrix. These components are not mounted in Settings yet.

## Verification

- Backend typecheck passed.
- Targeted lint passed for access backend services/routes and tests after directory/grant additions.
- Eleven policy/session tests passed, including exact AD binary-filter encoding and injection rejection.
- Frontend typecheck remains at the accepted 72 diagnostics; none belong to the new access files/API client.
- Pure policy/session tests cover Viewer export, emergency restrictions, local/empty scopes, invalid assignments,
  binary GUIDs, hashed sessions, two-store revocation and Pending/Disabled rejection.
- Real PostgreSQL 18.4 portable localhost integration passed five scenarios (six TAP tests including parent):
  Pending identity rename/no promotion; assignment/idempotency/stale edit/shared-session invalidation;
  audit failure rollback; atomic/idempotent initial grants and failed-grant rollback; concurrent self-demotions leave one administrator.
- Test PostgreSQL used only a generated temporary cluster and schema, loopback bind, and an ephemeral test password.
  It was stopped afterward. No application .env database connection was used by the integration suite.
- Runtime provenance: https://github.com/leinelissen/embedded-postgres, npm package
  @embedded-postgres/windows-x64 18.4.0-beta.17; registry SHA512 integrity verified before extraction.
- Re-run integration only with USER_ACCESS_TEST_DATABASE_URL pointing at an isolated test instance:
  node --import tsx --test backend/tests/access-postgres.test.ts
  Without that explicit variable it skips rather than using production.

## Remaining work before cutover

1. Verify LDAP lookup/search against a controlled directory fixture, address search limits, and implement the verified bootstrap/recovery tool.
2. Wire persistent authentication and current permissions; review every administrative API/service query and worker.
3. Complete scope-aware list/detail/export/audience/placement/rollout enforcement and emergency checks.
4. Add job actor/version handling and agent-local deactivation behavior without changing wellness themes.
5. Complete Users/Pending, directory search, grant/edit/review, disable/revoke and session-loss UI.
6. Mount API/UI together only after authorization coverage is verified; complete OpenAPI schemas and contract tests.
7. Browser acceptance, migration dry run against representative legacy records and staging/cutover review.

The existing resolver and application login path are unchanged in this slice. No admin was created,
no production migration executed, and no device notification or upgrade was sent.
