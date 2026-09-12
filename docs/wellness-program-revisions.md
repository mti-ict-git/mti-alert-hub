# Published wellness program revisions

Phase 4 hardening scope: editing existing device-bound wellness programs in Scheduled or Active status. Draft editing remains supported. Cancelled/completed/failed programs and already delivered one-time jobs cannot be revised; duplicate them as new drafts.

## Contract

- `POST /communications/{communicationId}/revise-wellness` requires admin authentication, `expectedScheduleVersion`, `confirmedChanges: true`, and `changes` using the draft update fields, including a complete wellness definition and AgentLocalRoutine reminder schedule.
- Editable values include device assignments, cadence, timezone, first occurrence, expiry, distribution/stagger window, and template-approved family/variants/rotation. Template, channel, content and publish validation still apply.
- A row lock serializes revisions. A stale schedule version returns 409 without applying any changes. Repeated submissions of the same version cannot publish twice.
- All writes occur in one transaction: validate configuration and audience, deactivate old schedules/policies, cancel unfinished delivery jobs, create replacement schedule/policies with an incremented version, and record actor plus old/new targets in audit logs. Any failure rolls back the entire revision.
- The program ID and historical schedules, policies, events and recipient snapshots remain intact. Reporting retains historical occurrences across revisions; total policy counts include old versions, while active policy counts describe current assignments.
- Applying a revision restarts the cadence for all selected devices from application time or the selected future First Occurrence. An expired historical anchor is cleared in the editor. This is explicit in the review text, including for assignment-only changes.
- Agent sync transmits inactive old policy rows and active replacements. Removed devices stop generating future occurrences after sync; offline devices may continue their previously cached policy until they reconnect. An already displayed routine is not recalled.
- This slice uses the existing agent contract and does not require an agent package rebuild. Real endpoint timing is bounded by its next successful policy sync.
- Correction `2026-09-08`: revisions no longer create an additional Windows Agent delivery job. Legacy local-routine jobs are excluded from normal message reconciliation; see `wellness-policy-only-delivery-fix.md` for regression evidence and release boundaries.

## Verification — closed 2026-09-05 (development scope)

- [x] Transactional integration: add/remove devices, change cadence/timezone, increment versions, retain historical events, audit evidence.
- [x] Failure paths: stale version, unsupported status, invalid configuration, empty/unresolvable audience, complete rollback.
- [x] Backend typecheck and frontend build; regression reporting tests.
- [x] Browser: open a published program editor, inspect review and confirmation, pending/failure recovery.

Evidence:

- `node --import tsx backend/tests/wellness-revision.integration.ts` passed against configured PostgreSQL. Scheduled and Active fixtures advanced versions 1 → 2 → 3, added then removed a device, changed daily/UTC to two-hourly/UTC+8, retained the old Displayed event, deactivated old policies, and wrote two revision audit entries. Stale version, invalid timezone, empty targets, unknown device and stopped status were rejected. Communication detail/targets/schedule and policy/event snapshots were unchanged after rejected revisions. All fixture writes were rolled back; no agent notifications were sent.
- `tsc -p backend/tsconfig.json --noEmit` passed. ESLint passed for all four changed frontend files. `vite build` passed after the final dialog changes (client and server); the existing tsconfig-path plugin advisory remains non-blocking.
- `node --import tsx --test backend/tests/wellness-reporting.test.ts tests/wellness-reporting-export.test.ts tests/wellness-analytics.test.ts tests/timezone-options.test.ts tests/notification-status.test.ts`: 15/15 passed.
- Chrome on an isolated HTTP fixture (`scripts/verify-wellness-revision-ui.ts`, Vite on port 8080, QA proxy on 8092): opened a Scheduled version-3 editor, added QA-NB-002, changed to every two hours and UTC+8, reviewed hostname chips and the dialog. Captured payload used two Device targets, `FREQ=HOURLY;INTERVAL=2`, `Etc/GMT-8`, expected version 3 and explicit confirmation. Review was disabled during the request. A simulated 409 preserved selections and displayed an inline error, then a simulated successful response returned to the program list. Final dialog was visually checked and includes timezone, expiry, rotation, cadence restart and offline-sync consequences. Fixture APIs never forward writes to the real backend.
- Existing agent source contract reviewed: `ReminderPolicySyncService` upserts active replacements and deactivates inactive IDs; `AgentStateStore` excludes inactive policies from future scheduling. No agent files changed. This is contract/source verification, not a new installed-agent end-to-end rollout test.

The UI keeps the established shared form and dialog components; review/pending/error behavior follows the project's frontend design guidance.

Only this Phase 4 feature checklist item is closed; the overall phase and unrelated wellness rollout gates remain open. Production deployment and an installed-device post-deploy smoke test are separate release steps. Deploy matching frontend and backend artifacts together; no database migration or agent package rebuild is required by this change.
