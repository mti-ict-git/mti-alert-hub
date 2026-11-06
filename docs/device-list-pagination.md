# Device list completeness (Phase 4)

The Devices page already uses shared client-side table pagination and filtering.
Previously the service fetched only API page 1 (maximum 200 rows), so the loaded
count, online count, filters, search and targeting were limited to that subset.

The approved list, pending enrollment list and notification target reference list
now follow API page metadata in bounded requests of 200. The complete result is
published to the query cache only after all requests succeed; later-page errors
reject the query instead of returning an apparently complete partial result.
Duplicate IDs during live changes are deduplicated. Backend sort ties are resolved
by device/enrollment ID. Authorization and API response contracts are unchanged.

Existing visible-page selection behavior, UI pagination, filters and refresh interval
remain unchanged. Counts describe all loaded devices within the caller's scope.
Fetching pages is not a database snapshot: concurrent additions/removals may become
visible at the next refresh. Request volume grows with fleet size; for very large
fleets, server-driven UI filters/pagination and aggregate counters are future work.
This repair deliberately preserves current filter options and target picker behavior.

Verification (2026-09-27): 10 tests passed, covering empty/200/201/451 rows,
later-page failure, duplicate IDs, missing pagination metadata and the actual
approved/pending/target service mappings with 451 fixtures. Backend typecheck,
targeted frontend ESLint and production frontend build passed. API client fallback
now tolerates missing Vite env in isolated service tests. No live database data,
enrollment decisions, notifications or rollouts were changed. Deployment and
production fleet-count verification remain pending.


## Target reference labels and search — 2026-11-06

The reference endpoint previously stripped directory fields and site labels, so every wellness target showed Unknown even when directory data existed. The scoped device query now joins site/area names and searches those names plus the last raw Windows user identifier, consistently in both rows and count SQL. The reference response explicitly allowlists only identifiers, hostname, site/area, ownership/status, last user identifier, directory username/display name and department. It does not expose directory email/mobile/employee number/title or require authors to gain devices.read/employees.read. Existing notifications.draft and location scope remain enforced.

The target service maps these fields across every page without extra per-device/employee calls. Shared DeviceAudiencePicker displays them and searches last raw username as well as directory/name/department/site/area fields. Missing data is Not reported or Site unavailable; no fabricated user or raw site UUID is shown. Existing selection IDs and visible bulk controls remain unchanged. No database migration, wellness publication, notification or agent update is needed.


Release profile: existing standalone /root/mti-alert-hub main on pinned SSH host mtimrwcnt01, baseline checkout eaed1f0 and deployed image source b69b4e2. Build backend/frontend from an isolated exact-commit Git archive with revision labels; preserve existing environment, network aliases, healthchecks, package volume and ports. Snapshot previous images/configuration under a private /root/mti-alert-releases/device-picker-20261106-* audit. Activate backend/frontend only; retain gateway/relay/legacy frontend IDs, reload nginx upstream resolution. No migration or production business-record mutation; image rollback retains the prior containers and tags. Root capacity preflight: approximately 48 GB free.

Pre-release checks: 12 tests passed (reference allowlist, scoped parameterized row/count SQL, five-role route policy and real service mappings including 451-device pagination), backend typecheck/build, frontend production build, and targeted ESLint passed. Strict static UI audit reports 38 pre-existing project findings, none on the changed picker/service files; no project-wide compliance claim is made. Browser workflow and actual candidate SQL execution are release gates recorded below when complete.
