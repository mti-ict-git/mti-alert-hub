# Users & Access â€” Implementation Evidence

Status: **Foundation and Settings UI implemented; integrated production activation remains incomplete.**
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
  and read-only responsive role matrix. These are now mounted in Settings > Users & Access.

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

1. Complete controlled-directory search-limit and eligibility edge-case coverage. Live identity verification and the audited bootstrap/recovery tool are complete; see the VPN recovery evidence below.
2. Wire persistent authentication and current permissions; review every administrative API/service query and worker.
3. Complete scope-aware list/detail/export/audience/placement/rollout enforcement and emergency checks.
4. Add job actor/version handling and agent-local deactivation behavior without changing wellness themes.
5. Finish integrated acceptance for the implemented Users/Pending, directory search, grant/edit/review and disable/revoke UI; verify cross-tab session loss after persistent-auth cutover.
6. Mount API/UI together only after authorization coverage is verified; complete OpenAPI schemas and contract tests.
7. Browser acceptance, migration dry run against representative legacy records and staging/cutover review.

At the foundation stage, the existing resolver and application login path were unchanged and no administrator was created. The later authorized administrator bootstrap is recorded below. No device notification or upgrade was sent.


## Authorized production schema application — 2026-09-16

The user explicitly requested execution of the database migration. The configured production database
reported migrations 0001–0018 applied with matching checksums and only 0019 pending.
Migration 0019 committed at 2026-09-16 11:28:34 UTC using one transaction, a 5-second lock timeout,
and a 60-second statement timeout. The migration ledger and both new tables were verified after commit.
User counts grouped by status and role were identical before and after migration.
This applies the schema foundation only: authentication cutover, new API registration, and UI activation
remain incomplete. No existing user was promoted or disabled by this migration.


## Settings UI implementation — 2026-09-17

- Replaced the Roles & Permissions placeholder with Users & Access, using the existing Settings shell.
- Added URL-backed tab/search/status/role/site/pagination state, list loading/error/empty states, and a read-only role matrix.
- Added directory selection, role and explicit scope selection, review with added/removed grants, reason validation,
  dirty-close confirmation, mutation idempotency, stale-revision reload, and status/session actions.
- Reused shared SearchInput and ListPagination; added IME composition hooks and server-total/busy options without changing existing defaults.
- Added optional isLastAdministrator to access-user responses. The UI disables demotion/disable for that record;
  the transaction-level last-admin guard remains authoritative.
- API errors retain HTTP status and server code for actionable conflict/validation handling.
- Initial directory verification for widji.santoso timed out while the VPN was disconnected. This was resolved by the verified bootstrap recorded below; managed authentication is still not activated.
- The registered production backend still does not expose the access route factory. UI source integration is not a claim
  of production readiness or effective authorization across existing endpoints.
- Isolated preview: node node_modules/vite/bin/vite.js --config tests/access-preview/vite.config.ts
  at http://127.0.0.1:4207/. The harness intercepts API requests with synthetic, in-memory records only.
- Browser evidence: Pending-to-Active grant with Viewer/Area scope, directory result selection, discard confirmation
  (Keep editing receives focus), keyboard-operated role/scope selectors, light/dark appearance,
  and 390px responsive role matrix were exercised.
- Backend typecheck, targeted lint, and frontend production build passed before the final validation-copy adjustment.
  Eleven policy/session tests passed. Full frontend typecheck retains existing unrelated diagnostics.
- Whole-project strict UI audit reports 37 findings in tests/access-preview/premium-audit.json.
  Its new UsersAccessSettings finding is a false-positive native-select match on the imported Radix Select;
  other findings are existing surfaces. This is not a clean whole-project audit.


Final verification in this slice:
- Six PostgreSQL TAP tests passed, including last-administrator response metadata; temporary server stopped afterward.
- Browser synthetic disable produced Disabled status; stale enable returned the conflict message with the reason retained.
- Error, recovery, empty, and forbidden states were exercised. No production writes were made in these browser checks.

## VPN recovery, bootstrap and persistent authentication — 2026-09-17

- After VPN connection, AD returned exactly one eligible widji.santoso identity with a valid immutable GUID.
- The user-designated account was bootstrapped as Active / CentralAdmin / Global in the configured production
  database. The operation and prior mapping/scopes were audited atomically. No other account was promoted.
- Operator CLI: node --import tsx backend/src/scripts/bootstrap-access-admin.ts <exact-username> --check
  performs a read-only directory check. --apply "<reason>" applies an explicitly authorized administrator
  assignment; it is never called by a login route. Verified identity collisions fail closed.
- Added PersistentAuthService, asynchronous HTTP session resolution, awaitable logout/rotation,
  effective permissions/version serialization and GET /access/me in the managed access route factory.
- Authentication and subsequent eligibility lookup must return the same GUID. No name or DN-only fallback
  is permitted in the managed login path. LDAP search reads at most the first 20-entry page and unbinds.
- Frontend sessions now preserve roleId, scopes, permissions and authorizationVersion. Login distinguishes
  Access pending and Disabled from credential failures and clears the password on Pending.
- Verification: five persistent-auth unit tests passed; eight PostgreSQL/HTTP TAP tests passed, including
  revoked-token 401, Viewer access-management 403, bootstrap identity conflict and audit rollback.
- The default application bootstrap still uses legacy authentication: the new orchestrator and access route
  factory are tested but intentionally not activated before complete route/job scope enforcement.
  Bootstrap is complete; managed-login cutover is not complete.

Final VPN-recovery verification: all 16 policy/session/authentication unit tests passed; backend typecheck and targeted lint passed; frontend production build passed. The eight PostgreSQL/HTTP TAP tests above used an isolated temporary database. These checks do not constitute production authorization cutover or complete end-to-end acceptance.

## Resource enforcement and acceptance implementation — 2026-09-17

The following supersedes the earlier implementation inventory, but **does not close the production cutover gate**.

- Added an exact administrative route/permission manifest and exact non-administrative allowlist. Unknown routes fail construction. Managed requests require persisted versioned sessions and resource enforcement.
- Added per-request scope context and a contextual database unit of work. Lists, counts, pagination and reference lookups apply scope before returning rows. Device reads/placement enforce original and destination location. IT package registry access remains global; enrollment of unassigned devices requires Global scope.
- Added scoped author-only `/reference/devices`; Communication Operators can choose targets without gaining access to device management. Explicit mixed Site/Area/Device/Employee selections reject as a whole before drafting or publication.
- Added migration 0020 for explicit communication ownership, publisher/version, rollout provenance and actor-bound emergency preview receipts. Emergency creation, duplication, downgrade, cancellation and publication check effective priority/template policy. Emergency publication requires a matching preview within 15 minutes; changed content/audience requires another preview.
- Reports use publication location snapshots, redact communication content on partial overlap, and restrict content search to records whose full content is visible. Added paginated recipient report and current-page CSV export using existing UI primitives.
- Queued agent delivery checks current user role, status, authorization version and active scope. Invalid local policies and rollout intents are blocked; transitions and audit commit together. Realtime notification dispatch runs only after successful transaction commit.
- Added role-aware navigation, direct-route restriction, disabled mutation actions, session revalidation, emergency-specific action restrictions, and IT-only package settings. Wellness renderers and themes are unchanged.
- Added a read-only `check-access-readiness.ts` operator command. It is not automatically executed against production in this work.
- OpenAPI now includes the nine access/targeting paths, nine access schemas and authorization state. Removed an existing duplicate RecipientPreview.deviceId key so strict YAML parsing succeeds.

### Activation hold

Automatic approval review rejected the source change replacing the default legacy login path with unconditional managed authentication plus startup prerequisites. That rejected command made no file changes. The internal managed-access acceptance option remains; the default application authentication has not changed. No migration 0020, container redeploy, commit, push, notification or device rollout was performed in this continuation.

See [users-access-cutover.md](users-access-cutover.md) for the concrete activation decision, maintenance-window sequence and legacy-job recovery. Do not deploy the frontend independently against legacy sessions.

### Final local evidence for the activation review

- Backend typecheck passed. Combined backend and frontend-capability suite: 57 passed, 2 PostgreSQL tests intentionally skipped without an explicit isolated database URL.
- Separate real PostgreSQL run: 9 TAP tests passed using all migrations through 0020. Expanded assertions include actual scoped HTTP list/placement denial and success, revocation, mixed audience rejection, actual draft create/list, emergency clone/downgrade denial, missing/stale/current emergency previews, report content-search redaction, blocked-job audit idempotency and read-only administrator readiness.
- Contextual database tests verify independent concurrent requests, nested atomic work, rollback discarding notifications, and dispatch only after commit.
- Frontend production build passed. Frontend typecheck retains 72 existing diagnostics; it is not reported as a clean typecheck. Targeted lint has zero errors, with existing hook/fixture warnings; the filename control-character sanitizer was expressed without a prohibited regex while retaining its behavior.
- Synthetic browser checks cover Viewer-disabled mutation actions and allowed recipient report/export affordance, IT package import without emergency, Emergency Officer without package import, light/dark report rendering, error and empty report states, disabled export on error, and Escape restoring focus to the opener. Prior Users & Access grant/review/disable/stale/keyboard/responsive evidence remains recorded above. No production identities were modified by the fixture.
- Strict project UI audit reports 38 findings (22 unresolved, 16 violations), largely existing surfaces and documentation inventory, including an authored Radix Select reported as native in UsersAccessSettings. This is not a clean whole-project accessibility/compliance claim. See tests/access-preview/premium-audit.json; no wellness theme redesign was made to address unrelated findings.
- Production Docker build/redeploy, live five-role AD acceptance, and migration 0020 remain unperformed. The local source activation approval hold is still open.

## Source activation approved and completed — 2026-09-17

This entry supersedes the earlier activation-hold status. The user explicitly approved managed authentication with migration 0020 and verified Administrator startup prerequisites. The default backend now uses PersistentAuthService/PersistentAccessSessionStore, always registers the access routes, enforces the closed administrative route manifest and enables queued agent job authorization. The legacy auto-admin fallback and internal managedAccess option have been removed from application bootstrap. Startup checks prerequisites before serving HTTP and closes the database on prerequisite failure.

Backend build/typecheck and targeted bootstrap lint passed. The authorization suite passed 57 tests (the two explicit PostgreSQL suites skip without a test URL); the separate isolated PostgreSQL/HTTP run passed all 9 TAP tests. Frontend source is unchanged from the previously verified production build. Production migration 0020, Docker redeploy and live AD acceptance remain pending. Source is ready for the coordinated cutover sequence in docs/users-access-cutover.md; this is not a claim that production has been upgraded. Phase 4 remains In Progress until production acceptance.

## Authorized production migration 0020 — 2026-09-17

The user explicitly requested production migration execution. Preflight confirmed migrations 0001–0019 applied with matching SHA-256 checksums, exactly 0020 pending, and no unknown ledger entries. Migration 0020 committed at 2026-09-17 04:41:48.818 UTC in one transaction with a 5-second lock timeout and 60-second statement timeout. The migration ledger was updated in that transaction. User IDs, roles, statuses, authorization versions and revisions were verified unchanged.

Post-commit read-only readiness passed: ready=true, verifiedAdministrators=1, legacyCommunications=60, legacyRollouts=149. The legacy counts identify active work without managed authorization provenance; these require review/new authorized publication or rollout after cutover. No ownership was guessed or backfilled. Migration execution did not redeploy containers, send notifications, or initiate device upgrades.

Migration 0020 is now applied in production; earlier pending-migration statements are historical. The remaining production step is coordinated backend/frontend redeploy followed by live acceptance.
