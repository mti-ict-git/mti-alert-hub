# Toast authoring and agent contract

Phase 4, 2026-09-15.

Create Notification and Edit Draft expose Toast style when Desktop Agent uses Toast:
- MTI Connect (Custom): instruction supported, 1–60 whole seconds, blank defaults to 5.
- Windows native (Native): duration managed by Windows.
- Auto (legacy): blank duration uses native; explicit duration uses custom.

New forms default to Auto to preserve existing behavior. Draft text is retained while switching styles before saving; unsupported instruction is normalized on save. Info toast instructions persist only for Custom. Warning remains Modal with instruction required. Desktop-only Toast cannot require acknowledgement; use Modal. Custom Mark as read is optional.

Preview Light/Dark controls simulate appearance only. Actual agent appearance remains its local Light/Dark/System preference. No per-message theme override was introduced. Wellness themes are unchanged.

## Contract and persistence

toastRenderer is optional on authoring requests and defaults to Auto. Detail, sync messages and reminder policies carry it. Draft creation, duplication, partial updates and published reminder snapshots preserve it. Non-Toast authoring normalizes it to Auto.

Migration 0018 adds constrained toast_renderer columns to communications and agent_reminder_policies. The migration was applied to the project's configured PostgreSQL database, not a separate local database. Existing rows default to Auto.

Agent contracts and NotificationRequest carry renderer selection. Auto retains old selection logic. Native failures still fall back to the custom window. SQLite reminder cache adds the column with an Auto default and persists explicit selections.

## Verification

- Frontend production build passed.
- Backend typecheck passed; four normalization tests passed.
- Agent suite: 48 passed, including renderer eligibility and reminder cache persistence.
- Rollback-only PostgreSQL integration exercised real service create/read/duplicate/update/partial-update paths. Custom retained instruction and default 5 seconds; Native cleared custom duration; unrelated update preserved Native. Transaction rolled back; no notification published.
- Global frontend typecheck still reports data/routing/recipient type errors; it is not a clean project-wide typecheck.
- Browser acceptance could not run because localhost:8080 was unavailable. Real toast delivery on an installed agent remains pending.

## Release order and acceptance

Install the updated agent on a test device before enabling explicit renderer use operationally. Existing agents ignore the new field; canonical Custom=5 and Native=null duration preserves their legacy route, but does not install the new visual design. Migration, backend/frontend build deployment and installed-agent rollout are distinct steps.

No installed-agent binary replacement or fleet rollout was performed. Check native and custom delivery, OS notification restrictions/fallback, optional read action, duration, system appearance changes and offline reminder replay on the test device before broad rollout.
