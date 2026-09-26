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
