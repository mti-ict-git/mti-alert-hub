# Wellness policy application reporting
Phase 4. Supplements wellness-windows-sign-in-schedule.md and wellness-program-revisions.md.

## Contract
For Windows sign-in schedules, the first anchor is the later of first receipt of the policy version and Available from. A subsequent Windows logon replaces that anchor only when later. Same-version sync, lock/unlock, hibernate and process restart never reset receipt time. Repeat intervals follow the last actual trigger; existing snooze and one-minute presentation grace remain.
The agent reports only after reading its persisted policy. POST /agent/reminder-policies/{policyId}/application uses the existing device session and validates policy ownership plus exact schedule version. It reports protocolVersion=1, appliedAt, reportedAt, state, nextRunAt and agentVersion.
States: Scheduled, WaitingForSession, WaitingForAuthorization, Unsupported, NoOccurrence.
Reports refresh at least every five minutes while scheduling runs, and on observed state/next-run changes. Network failure cannot block notification rendering: a bounded background reporter retains only the newest snapshot per policy and retries. Restart regenerates snapshots from SQLite. Reporting is separate from Triggered/Displayed wellness analytics.
The backend stores the latest snapshot in agent_reminder_policy_applications (migration 0021). Stale versions and another device's policy are rejected. Older reportedAt never replaces newer evidence. Server received_at measures freshness; after ten minutes the UI shows Agent report stale and suppresses a purported current next-run.
Inactive/expired policy states override old reports. Without a report, supported/new or unknown agent versions show Awaiting agent confirmation. Known versions below 1.0.18 show Agent update required. A valid protocol report is stronger than a version heuristic.
last_synced_at means a server sync response was prepared; it is not application confirmation. No migration backfills receipt evidence.
Deploy migration/backend first, then frontend, then a newly versioned signed agent package (1.0.18 or later). No live policy mutation or device rollout is part of source implementation.

## Verification
- Agent build passed with zero warnings/errors; all 69 xUnit tests passed (SignInVerification configuration). Covers late receipt, future activation, subsequent logon, lock/resume grace, restart persistence, same-version receipt preservation and schedule-version reset.
- Six backend/frontend regression tests passed: payload validation, ownership, active version, validity boundaries, device schedule evidence, missing confirmation, old agents and stale reports.
- Backend TypeScript check, Vite production build and targeted ESLint passed. Full frontend TypeScript checking retains the existing 72 diagnostics; the new report/schedule changes add none.
- PostgreSQL integration test was attempted but connection to the configured database timed out. No database migration or fixture write was performed. Run `node --import tsx backend/tests/policy-application.integration.ts` on a host with database connectivity; it applies any missing test DDL inside an outer rollback-only transaction.
- Live browser/device end-to-end, physical lock/sleep/hibernate, migration deployment and production acceptance remain pilot checks. No production rollout is claimed.



## Migration 0021 applied (2026-09-17)
Following explicit operator authorization, the project migration runner applied `0021_phase4_policy_application_reports.up.sql` to the configured `ictMTIAlertHub` database at `2026-09-17T10:48:56.249Z`. Preflight verified matching checksums for migrations 0001-0020 and only 0021 pending. Post-apply read-only verification confirmed the migration checksum, nine columns, primary key, cascading policy foreign key and both check constraints. The new table contained zero reports immediately after migration. No backend/frontend redeploy or agent rollout was performed. Earlier connectivity failures describe the previous implementation attempt.
