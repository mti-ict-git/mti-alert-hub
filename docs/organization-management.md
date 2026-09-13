# Organization management

## Approved direction — 13 September 2026

User requested implementation of a dedicated Organization menu under Management and explicit documentation of each change in direction. Organization owns shared master data; Employees owns person assignment; Devices owns placement and rollout. This replaces the previous reference-only administration path for locally owned master records.

## Operational behavior

Use Sites & Areas or Departments & Sections. Select View areas / View sections to filter children. Create from Add; Edit includes Active/Inactive. Deactivation preserves assignments/history and hides the entry from existing active-only reference choices. Deactivate active children first. Parent movement is unavailable because it would require a separate assignment migration workflow. Source labels other than empty/Local/Manual are read-only; imported source ownership is shown without claiming a running sync service. Usage numbers distinguish employees and devices; organizational device usage follows primary employee assignment.

## Verification

- Backend typecheck passed; targeted frontend lint passed; changed files have no frontend typecheck diagnostics. Existing project-wide frontend errors remain.
- Six backend unit tests cover schema/kind validation, source ownership, stale writes, duplicate handling, inactive parent, fixed parent, child guard, preservation and audit.
- PostgreSQL integration uses temporary tables only and rolls back all fixtures: create/list/rename/deactivate/active-child rejection/audit passed. No real master record was changed.
- Production build passed.
- Browser reached login after backend watch restart invalidated the old session. Authenticated visual and form acceptance pending re-login; do not treat unit/integration proof as full browser acceptance.

- Strict UI audit remains non-clean because of the existing project-wide backlog. The Organization form validation-owner finding was fixed with application validation and noValidate. The remaining native-select finding is a detector false positive on the shared Radix Select import; this route uses no native select. Audit output preserved at /tmp/mti-org-audit.json; checked-in baseline preserved.

## Direction change: Section and AD department

The user clarified that Section is not used and Department is available from the agent AD login lookup. Organization now shows Departments without Section navigation. Legacy sections remain stored for compatibility; this is not a destructive migration. Device placement displays the latest AD department read-only. No new AD-to-department-master synchronization or automatic employee reassignment is introduced.
