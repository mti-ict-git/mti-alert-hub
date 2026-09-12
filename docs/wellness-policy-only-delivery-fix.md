# Wellness policy-only Windows Agent delivery

## Phase 4 correction — 2026-09-08

Publishing or revising an `AgentLocalRoutine` program previously created both reminder policies and normal Windows Agent delivery jobs. Pending-message queries did not exclude the local execution mode and serialized these jobs without the structured wellness payload. The client therefore rendered an additional native toast instead of a wellness template on that message path.

Read-only investigation found the installed agent at version `1.0.14`, with intact wellness payloads in its policy cache, plus a separate `Eye Break Time!` message first seen at `2026-09-08 11:16:34 UTC+8` with Toast presentation and displayed evidence. This matches the reported screenshot timing. The local reminder path itself retained its template.

## Corrected behavior

- Recurring publication passes execution mode to delivery materialization. Local Windows routines keep recipient snapshots but do not create Windows Agent jobs, attempts, or delivery events. Other channels retain their existing behavior.
- Wellness revisions reuse this corrected publication path, preserving versions, historical evidence and policy replacements.
- The shared pending-message query excludes schedules whose execution mode is `AgentLocalRoutine`. This protects HTTP full/incremental reconciliation and realtime snapshots/availability messages from legacy jobs without deleting history.
- Existing reminder-policy sync and agent template rendering are unchanged. No migration or agent rebuild is required.

## Verification evidence

- `node --import tsx backend/tests/wellness-revision.integration.ts` passed against configured PostgreSQL. It verifies no jobs after publish and Scheduled/Active revisions, retained recipient snapshots, versions 1→2→3, assignment changes, historical reminder events, audit, rollback on stale/invalid edits, cancellation, template payload and inactive-policy sync, exclusion of an eligible legacy job from full/incremental reconciliation, continued server-generated and one-time delivery, and invalid-session rejection. All fixture writes were rolled back; no server was started and no notifications were sent. Session and overdue dependencies are test doubles; policy/pending queries and publication run against PostgreSQL.
- Backend typecheck and backend build passed using `tsc -p backend/tsconfig.json` (with `--noEmit` for typecheck).
- All 12 wellness reporting, analytics and CSV regression tests passed.
- Realtime coverage is source-path verification: stream snapshots and availability events call the same filtered pending-message method. No new live SSE or installed-agent test was run.

## Release boundary

The correction is complete in the repository and built backend artifact. Production deployment and an installed-device post-deploy check remain outstanding. Deploy/restart the backend using the normal release process. Existing local-routine jobs are filtered as soon as the corrected runtime serves reconciliation; no manual deletion or program republish is needed. A toast already shown or stored in Windows Notification Center is not recalled by this server fix.

Post-deploy check: revise a wellness program, confirm the device receives the replacement template policy, confirm no ordinary message for that program is returned, then verify the next local occurrence renders the wellness template. Check a normal notification still arrives. Do not close the overall Phase 4 or unrelated rollout gates based on this correction.
