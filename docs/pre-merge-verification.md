# Pre-merge verification — 13 September 2026

Scope: Phase 4, `feat/warehouse-theme`, including the current uncommitted UI changes. At verification time, no merge, push, or live device approval had been performed.

## Automated checks

- Wellness reporting/export/analytics: 12 tests passed.
- Bulk device approval helper: 3 tests passed (simulated requests; no live enrollment changes).
- Backend typecheck: passed.
- Production build with `NITRO_PRESET=node-server`: passed, including the final build after formatting cleanup.
- Lint across 37 changed/untracked TypeScript files: zero errors; one existing `react-refresh/only-export-components` warning in `src/components/ui/sidebar.tsx`.
- Frontend typecheck is still not clean: 28 diagnostic signatures, also present in a fresh `origin/main` archive using the same installed dependencies. Normalized comparison found no new signatures. This is not a claim that full-project typechecking passes.
- Formatting cleanup was limited to DesktopPreview, WhatsAppPreview, and misc data.

## Authenticated Create Wellness and actual device test

- `/wellness-programs/new` loaded after authentication without the earlier missing-module error. Family/variant selection and preview worked; Create remained disabled without a device target.
- The user explicitly requested testing on **MTI-NB-373**. Created a new Office Stretching draft through the form and confirmation dialog, then reopened Edit to verify the persisted target was that single device.
- Test communication: `dd99a3d7-30b8-4da6-812c-dcbe7020b590`.
- Published through the dedicated Wellness confirmation dialog at approximately 21:13 WITA on 13 September 2026.
- Configuration: GuidedRoutine, Green, B1/OverviewCard, Synchronized, daily cadence, immediate start, Never Expires disabled, valid until **13 September 2026 21:40 WITA**. The short validity prevents a second daily occurrence.
- Server/UI result: Scheduled; one active policy for MTI-NB-373; target hostname correct after publication.
- At verification, MTI-NB-373 was Offline; Last Synced and Last Activity were empty, with zero displayed/completed events. Physical popup appearance and completion are **not verified**. The user was asked to connect the agent.

## Open observations before merge acceptance

- Draft detail/recipient preview displayed `Unknown device` before publication, although reopening Edit correctly showed MTI-NB-373 selected. Publication resolved the displayed hostname. Track this draft-label issue separately; it was not fixed during this test.
- The Policies summary displayed `1/1` with wording “Active / synchronized policies” while Last Synced remained empty. Do not interpret that summary alone as proof of device receipt.
- Complete actual-device acceptance once the agent connects; if the test has expired, a new explicitly bounded test window is needed.
- Full-project frontend typecheck backlog remains. Existing UI smoke evidence is in `services-theme-checklist.md`; this report adds current Create/Publish evidence, not a new claim that every screen and physical workflow has been retested.
- Review and commit the working tree before opening the merge change. Phase 4 remains in progress.

## Merge decision

The user accepted the documented limitations on 13 September 2026 and authorized proceeding with the merge, with physical-device testing to continue afterward. The pending agent test, draft hostname label, policy-summary wording, and existing frontend typecheck backlog remain open; merge acceptance does not mark them passed.
