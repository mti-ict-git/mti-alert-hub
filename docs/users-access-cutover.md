# Users & Access cutover runbook

Status: **Migration 0020 applied and readiness passed; coordinated production redeploy pending.**

The user explicitly approved source activation after the earlier automatic review hold. The default backend now uses persistent managed authentication, registers Users & Access routes and applies the closed administrative permission/resource manifest. Queued agent delivery authorization is enabled. There is no runtime option or environment toggle that restores the legacy auto-admin login path.

Startup checks the schema through 0020 and at least one verified Active Global Administrator before creating the HTTP server. Missing prerequisites stop startup with an operator error and close the database connection; no automatic role assignment or legacy fallback occurs.

This completes source activation only. Follow the coordinated sequence below: migration 0020 must be applied before starting the new backend, and backend/frontend must be deployed together. Production containers and data have not been changed by this activation.

## Prepared migration

- 0019 was applied with user authorization on 2026-09-16. The approved `widji.santoso` directory identity was subsequently bootstrapped as Active CentralAdmin Global and audited.
- 0020 is new and has **not** been applied to production. It adds communication ownership/publisher provenance, rollout initiator authorization, and emergency preview receipts. It does not guess legacy owners or promote users.
- Both migration files were exercised in a fresh, disposable PostgreSQL cluster. This is not a production migration execution or Docker acceptance claim.

## Production cutover sequence

Use the server's existing Compose file set, project name and environment. Commands below use the base Compose invocation for readability; preserve any production override flags used by the existing deployment.

1. Take and verify the normal PostgreSQL backup. Preserve the current container image identifiers, Compose configuration and package volume. Inventory active reminders/queued communications and rollout intents for authorized review.
2. Build the new backend/frontend images without replacing the running containers:

   ```bash
   docker compose build backend frontend
   ```

3. Inspect migration status using the new image. Expect only 0020 pending if 0019 was applied previously. Stop if there are unexpected pending migrations or checksum errors:

   ```bash
   docker compose run --rm --no-deps backend node backend/dist/scripts/run-migrations.js status
   ```

4. In the agreed maintenance window, stop administrative traffic and old backend instances so old authorization paths cannot continue dispatching during cutover. Apply the reviewed migration:

   ```bash
   docker compose stop backend frontend
   docker compose run --rm --no-deps backend node backend/dist/scripts/run-migrations.js up
   docker compose run --rm --no-deps backend node backend/dist/scripts/check-access-readiness.js
   ```

   The read-only readiness command checks the schema, verified administrator and counts of legacy active work requiring review. It never modifies users or grants. It is not a substitute for migration checksum verification or a live AD login.

5. Start the backend and frontend together using the existing `scripts/redeploy-docker.sh --no-build` workflow and the established Compose arguments. Preserve the gateway host mapping (8086 -> container port 80); reload its Nginx DNS resolution as the helper already does. Do not republish frontend container port 8080 as a replacement for gateway port 8086.
6. Check backend/gateway health and sign in as `widji.santoso`. Legacy tokens are intentionally rejected. Confirm Settings > Users & Access and the current role/scope. Check an unassigned AD user receives Pending without a session. Run scoped IT, Communication, Emergency and Viewer acceptance with administrator-assigned test accounts before reopening normal operator traffic.
7. Verify package registry access imports no rollout, and that any test device target is the explicitly agreed device only. No real notification or device upgrade was sent during local acceptance.

## Legacy queued work and recovery

Missing or invalid publishing/rollout provenance is denied. Existing scheduled communications and local reminder policies are not silently attributed to an administrator. Their historic deliveries and responses remain intact. For communications, the UI shows **Access review required**; an authorized operator duplicates, reviews the current audience and publishes the new record. Create and review a new rollout intent rather than changing its recorded initiator manually.

Role/scope edits, disabling and explicit session revocation change authorizationVersion. Queued work created under the older version is blocked. The first device sync deactivates invalid local reminder policies and records the transition atomically in the audit log. Already synchronized offline policies cannot be recalled until that device reconnects; already accepted updater commands cannot be recalled by server token revocation.

Do not roll back to the old auto-admin authentication build. If cutover validation fails, keep administrative traffic stopped, preserve data, diagnose the explicit prerequisite failure and use the audited operator bootstrap only for the designated verified identity when needed. Any database restoration must be a separately reviewed operational recovery action.

## Authorized production migration 0020 — 2026-09-17

The user explicitly requested production migration execution. Preflight confirmed migrations 0001–0019 applied with matching SHA-256 checksums, exactly 0020 pending, and no unknown ledger entries. Migration 0020 committed at 2026-09-17 04:41:48.818 UTC in one transaction with a 5-second lock timeout and 60-second statement timeout. The migration ledger was updated in that transaction. User IDs, roles, statuses, authorization versions and revisions were verified unchanged.

Post-commit read-only readiness passed: ready=true, verifiedAdministrators=1, legacyCommunications=60, legacyRollouts=149. The legacy counts identify active work without managed authorization provenance; these require review/new authorized publication or rollout after cutover. No ownership was guessed or backfilled. Migration execution did not redeploy containers, send notifications, or initiate device upgrades.

Migration 0020 is now applied in production; earlier pending-migration statements are historical. The remaining production step is coordinated backend/frontend redeploy followed by live acceptance.
