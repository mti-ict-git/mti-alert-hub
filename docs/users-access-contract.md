# Users & Access — Phase 4 Contract

Status: **Review-ready product/UX draft; technical design proposals are not implementation approval.**
Date: 2026-09-16.

Active phase: Phase 4 — Hardening and Expansion.
Source reconciliation and limitations: [users-access-verification.md](users-access-verification.md).
Screen and interaction specifications: [users-access-ux-contract.md](users-access-ux-contract.md).
The eight confirmed choices in section 12 are accepted product decisions.
The current runtime contract remains in effect until a separately authorized, tested cutover.
No application changes, migrations, or access grants are included in this documentation task.

## 1. Purpose and boundaries

LDAP/Active Directory remains responsible for authentication. MTI Connect controls application permissions
and resource scope. No local passwords, AD password resets, AD account creation, or AD group changes.
Windows Agent retains device authentication; administrator roles do not replace device trust.
Wellness presentation and themes remain unchanged.

Initial scope: Users, five built-in roles, Global/Site/Area scope, audit, session revocation,
and enforcement across all relevant APIs. Custom roles, multiple roles per user, and AD Group Mapping
are deferred. Do not display controls for unavailable functionality.

## 2. Observed baseline

- AdminRoleType currently includes CentralAdmin, LocalOperator, and ManagementViewer.
- The existing scope model also includes Department and Section.
- AccessProfileService.resolveAccessProfile currently returns CentralAdmin + Global:* without user mapping.
- requireRole checks roles; hasGlobalScope is a helper, not evidence that every endpoint enforces scope.
- The frontend maps roles to Admin/Operator/Viewer; those labels cannot express the proposed permissions.
- The security document describes an in-memory session baseline. Cross-instance consistency requires verification.

These gaps must be resolved before production readiness. Successful AD authentication must not automatically grant global administration.

## 3. Identity and lifecycle

Use AD objectGUID as the immutable directory ID (canonical UUID decoded from the AD binary attribute)
together with a directory/tenant identifier. Username/UPN is a mutable display attribute.
Administrators select verified directory search results; they do not enter arbitrary GUIDs or create passwords.

Application statuses:

- Pending: known identity without an active assignment; no administrative API access.
- Active: exactly one built-in role and valid scope.
- Disabled: access denied even if AD remains active; retain assignments for audit.

No hard deletion of users or audit records. Application Users are distinct from Employees and desktop agent users.

A previously unknown user who authenticates successfully becomes Pending without a privileged application session.
Display: “Access has not been granted. Contact your MTI Connect administrator.”
Only disclose application-access restrictions after successful AD authentication to avoid public account enumeration.
Reactivation requires review of role/scope; previous sessions remain invalid.
LDAP allowed-group rules remain an additional authentication gate.

## 4. Built-in roles and permission matrix

Stable IDs: CentralAdmin, ITOperator, CommunicationOperator, EmergencyOfficer, ManagementViewer.
UI labels: Administrator, IT Operator, Communication Operator, Emergency Officer, Viewer.
Built-in roles cannot be edited or deleted in the first stage.
All scoped actions follow section 5; a check mark does not automatically grant global access.

| Permission | Admin | IT | Communication | Emergency | Viewer |
|---|---|---|---|---|---|
| dashboard.read, reports.read | ✓ | ✓ | ✓ | ✓ | ✓ |
| reports.export | ✓ | ✓ | ✓ | ✓ | ✓ |
| reports.recipients.read | ✓ | ✓ | ✓ | ✓ | ✓ |
| notifications.read | ✓ | ✓ | ✓ | ✓ | ✓ |
| notifications.draft, notifications.publish, notifications.cancel | ✓ | ✓ | ✓ | ✓ | — |
| notifications.emergency | ✓ | — | — | ✓ | — |
| wellness.read, templates.read | ✓ | ✓ | ✓ | ✓ | ✓ |
| wellness.manage, wellness.publish, templates.manage | ✓ | — | ✓ | — | — |
| employees.read | ✓ | ✓ | ✓ | ✓ | — |
| devices.read | ✓ | ✓ | — | ✓ | — |
| devices.enroll, devices.placement, devices.revoke, devices.test | ✓ | ✓ | — | — | — |
| packages.read, packages.import | ✓ | ✓ | — | — | — |
| packages.delete | ✓ | — | — | — | — |
| rollouts.preview, rollouts.apply, rollouts.read | ✓ | ✓ | — | — | — |
| organization.manage, settings.manage, channels.manage | ✓ | — | — | — | — |
| access.read, access.manage, audit.read | ✓ | — | — | — | — |

Permission IDs form a closed catalog. Unmapped endpoints are denied by default.
Notification authors may receive restricted audience lookup without access to complete Employee/Device records.
Viewers may access aggregate reports, individual recipient delivery/response details, and report exports within their assigned scope. This does not grant employee-directory management or unrestricted employee profile access.
Export is a separate permission and must enforce the same data scope.

notifications.emergency is required in addition to draft/publish/cancel permissions for Critical/Emergency
communications, including editing, duplication, templates, scheduling, test-send, and republication.
Fullscreen alone does not determine emergency authorization: effective severity and critical behavior after
template/cache resolution determine the required permission. Changing a type label or renderer cannot bypass it.
Emergency submission requires an audience preview and explicit confirmation; two-person approval is not proposed initially.

Package Registry is global. ITOperator intentionally receives global import access, disclosed in the assignment UI.
Import does not trigger rollout. Applying a rollout checks every device against the actor's scope.
Reject deletion of packages referenced by active rollouts. Import access does not grant settings.manage.

## 5. Scope and resource rules

Administrator requires Global scope. Other roles may have Global or explicit Site/Area grants.
Global is never the default. Active non-admin users cannot have an empty scope list.
Area grants contain valid areaId and siteId values with consistent parent-child relationships.
Multiple grants combine with OR: Site A includes every area within that site; Area B includes only that area.
Department/Section remain audience filters, not new authorization grants in the first stage.
Legacy Department/Section grants require reviewed location mapping; never convert them automatically to Global.

Scopes reference master IDs, not names. Inactive sites/areas cannot receive new grants.
Existing grants to inactive scopes do not authorize new mutations. New operations use current placement;
historical recipient records are not rewritten.
Only Global users may manage or target devices without placement.
Placement changes require access to both the original and destination location; unassigned devices require Global.

Enforce scope server-side for lists, counts, searches, references, details, exports, and bulk operations.
Return 404 for resources outside scope and 403 for missing feature permissions.
Target All means the permitted audience, labeled “All within your scope,” with preview counts.
Explicit out-of-scope IDs reject the entire request; never silently remove selected targets.
Resolve filtered audiences within scope; publication rechecks preview results and current authorization.
Scheduled notifications, reminders, and pending rollouts recheck actor access and scope at execution.
Revoked authorization moves the job to BlockedAuthorization for authorized review/reassignment;
never silently execute under system privileges. Previously delivered messages are not recalled.

Only an Administrator or an actor covering the entire target scope may edit/cancel a multi-site notification.
Operators with partial overlap cannot access its body/details. Reports expose only in-scope delivery aggregates,
without leaking content or global totals. Creation previews must explain this visibility rule.
Drafts have no final recipient snapshot: persist intended scope and owner, and validate target changes.
For historical reports, use recipient site/area snapshots at publication against the viewer's current grants;
never reclassify past delivery using a device's current location. Missing historical location is Global-only.
For partial-overlap reports, expose in-scope recipient rows and delivery state, but redact notification body
and global audience totals. This preserves the approved Viewer detail/export access without cross-site leakage.

## 6. Users & Access UX

Location: Settings > Users & Access. Replace the Roles & Permissions placeholder rather than creating duplicate settings.
Users tab: name/UPN search, status/role/site filters, server pagination, empty results, and recoverable errors.
Columns: name/UPN, role, scope summary, status, last login. Never expose passwords, tokens, or sensitive directory attributes.

Grant access: find AD user -> choose role -> choose scope -> review -> save.
Edit panel: read-only identity, single role, scopes, status, change reason.
Review shows before/after values, sensitive permissions (emergency, global import, rollout, administration),
and session-revocation consequences. Canceling unsaved changes requires confirmation.
Separate “Disable access” and “Revoke sessions” actions; both require a reason.
Roles tab: read-only matrix grouped by module, permission/scope explanations, no nonfunctional editing checkboxes.
Hide AD Group Mapping until that stage is implemented.

The server supplies effective permissions/scopes for the current user. The frontend uses them for navigation/actions;
every API independently authorizes requests. user.role === Admin is not the complete authorization contract.
Provide explicit loading, empty, forbidden, stale-edit, submission-error, and success states.
Preserve form input after errors. Do not automatically retry mutations; reload state before retrying.
Reuse shared Button/Table/Input/Select/Dialog components, semantic theme tokens, focus management, and live feedback.

## 7. Access changes and sessions

Only access.manage may modify users/assignments; this role requires Global scope.
The last Active Administrator cannot be disabled, demoted, or stripped of Global scope.
Check this invariant atomically with locking that handles concurrent administrator changes.
Self-demotion is permitted only when another active administrator remains, with an explicit logout warning.
Reject arbitrary permission payloads that attempt privilege escalation.

Every access change increments authorizationVersion. Every request checks current status/version;
a login-time role snapshot or session TTL alone is insufficient. Fail closed if the user repository is unavailable.
Role or scope changes immediately invalidate all affected active sessions across instances and require a fresh login; do not silently refresh permissions while keeping the session. Disabling and explicit session revocation also invalidate affected sessions. Return the UI to login/no-access with an explanation.
In-flight sensitive mutations recheck authorization before commit and before publication/enqueue.
AD account status is checked during authentication; continuous AD synchronization is not guaranteed initially.
Disable access provides immediate application revocation. Explain this limitation to administrators.

Write audit records atomically with changes: actor, immutable target ID, before/after, reason, request ID, timestamp, source/IP.
Never record passwords, bearer tokens, bind credentials, or full directory membership.
Audit failure aborts the mutation. Access-denial logging must be bounded and must not disclose target data.

## 8. Proposed data model (no migration yet)

Extend the existing public.users and public.user_scopes tables from migration 0001.
Do not introduce a parallel admin_users/admin_scope_grants identity system.

- users: retain id, username, full_name, email, status, role_type, created_at and updated_at.
  Add directory_id, directory_subject_id (objectGUID), authorization_version, revision,
  last_login_at and assignment_source=Manual. Enforce uniqueness on (directory_id, directory_subject_id).
  Pending permits null role_type; Active requires one of the five roles and valid grants.
  Expand the existing three-role CHECK constraint only in the reviewed migration.
- user_scopes: retain user_id and canonical scope_type/scope_value. Global uses '*';
  Site/Area use master UUID values. Derive area parent from the areas table rather than persist conflicting parents.
  Validate referenced active masters transactionally. Preserve legacy Department/Section rows for review;
  they must not silently confer new permissions after cutover.
- admin_sessions: new shared PostgreSQL session table with token digest, user_id FK,
  authorization_version, expires_at and revoked_at. Never store raw bearer tokens.
  Authentication performs a database-backed session/version check on every request.
- access_idempotency: actor FK, operation, key, request hash, result reference and expiry;
  unique actor/operation/key and at least 24-hour retention.
- Built-in role/permission catalog remains versioned in code. No role-assignment table is needed for one role per user.
- Reuse audit_logs, extending event/action values for user, role, scope and session mutations.

Assignment, scope replacement, version/revision increment and audit updates share one transaction.
Use expectedRevision for optimistic concurrency. Serialize last-admin mutations with a transaction-level
advisory lock shared by every path that changes active administrators; then count within the transaction.
Map existing directory DNs/usernames to verified objectGUIDs before switching session user IDs to users.id.
Do not automatically merge ambiguous identities. Retain legacy audit identifiers and mapping provenance.

## 9. Proposed API (not active endpoints)

Every new endpoint requires authentication and the specified permission. Target IDs are not usernames.

| Method/path | Permission | Contract |
|---|---|---|
| GET /access/me | Active session | Effective role, permissions, scopes, authorizationVersion |
| GET /access/users | access.read | Server pagination, search, role/status/scope filters |
| GET /access/users/{id} | access.read | User detail, assignment, revision |
| GET /access/directory-users?search= | access.manage | Bounded, rate-limited search; no sensitive membership data |
| POST /access/users | access.manage | Verified directory identity, role, scopes, reason |
| PATCH /access/users/{id}/assignment | access.manage | roleId, scopes, expectedRevision, reason |
| PATCH /access/users/{id}/status | access.manage | Active/Disabled, expectedRevision, reason |
| POST /access/users/{id}/revoke-sessions | access.manage | expectedRevision, reason |
| GET /access/roles | access.read | Read-only catalog and matrix |

Responses: 200/201 success; 401 invalid session; 403 missing permission/application access;
404 invisible or missing target; 409 stale revision, duplicate identity, or last-admin conflict;
422 invalid assignment/scope; 503 unavailable dependency. Use stable error codes and actionable messages.
Writes require Idempotency-Key scoped to actor/operation. Identical payload returns the previous result;
the same key with a different payload returns 409. Recheck current authentication/authorization before returning results.
Retain keys for at least 24 hours. Mutation and idempotency records are atomic.
The existing /auth/login, /auth/me and /auth/rotate-session schemas also require a coordinated version update:
retain existing fields, expand roleType, and add effective permissions and authorizationVersion. Login for Pending
returns 403 ACCESS_PENDING without a sessionToken; Disabled returns 403 ACCESS_DISABLED. Invalid AD credentials
remain 401. Add directory objectGUID internally; do not expose DN as the permanent application user ID.
The detailed API supplement below is a proposed contract, not active API availability.

## 10. Migration and cutover

1. Inventory all routes/jobs, session mapping, directory identities, and active users.
2. Establish at least one Global Administrator using an operator-verified directory identity.
   Never use “first login becomes admin” or automatically promote all existing users.
3. Proposed mapping: CentralAdmin -> Administrator only after review; ManagementViewer -> Viewer with retained scope.
   LocalOperator requires explicit IT/Communication/Emergency selection; never expand permissions automatically.
4. Run a per-user/endpoint dry run; resolve Department/Section scopes and unassigned accounts.
5. Complete persistence/versioning, guards, UI, and job authorization checks before cutover.
6. Coordinate activation across instances, invalidate legacy sessions, and remove the auto-admin resolver.
7. Smoke-test administrator, scoped operator, viewer, and pending users. Back up mappings and test administrator recovery.

Rollback must not restore automatic administrator access. Recovery uses an authenticated, audited server-operator
procedure to restore a known administrator assignment, rather than disabling authorization.

## 11. Required acceptance evidence

- Successful AD authentication without assignment yields Pending/no access; invalid AD credentials still fail.
- Every matrix action has allow/deny tests, including direct HTTP requests.
- Test Site/Area/Global scope, unassigned devices, explicit ID injection, mixed bulk requests, counts, search, and exports.
- Templates, renderers, schedules, clones, and test-send cannot bypass emergency authorization.
- Package import creates no rollout; cross-scope IT rollout is denied.
- Every role/scope change, disabling, and explicit revocation invalidates existing sessions across two backend instances and requires fresh login.
- Viewers can inspect recipient details and export in-scope reports; direct out-of-scope detail/export requests are denied.
- Concurrent mutual demotion by two administrators cannot leave zero administrators.
- Test stale edits, duplicate submission/idempotency, audit-failure rollback, and dependency outages.
- Pending jobs use current authorization; delivered history remains intact.
- Directory identity renaming creates no duplicate account; inactive scopes do not increase access.
- Browser acceptance covers empty/error/retry states, keyboard/focus, review/save, dirty-form cancellation,
  dark/light themes, and responsive tables.
- Record migration dry-run, bootstrap/recovery, and staging acceptance before production.

## 12. Confirmed product decisions

The user confirmed the following choices through eight sequential clarification questions.
These decisions settle the listed product choices; they do not complete source verification or authorize implementation.

| # | Topic | Confirmed decision |
|---|---|---|
| 1 | Unassigned AD users | Successful AD login creates Pending access; no application access until an administrator assigns a role and scope. |
| 2 | Roles | Exactly one of five built-in roles per user. No custom roles or multiple roles initially. |
| 3 | Scope | Global or multiple explicit Site/Area grants. Administrator is Global; all other roles require an explicit scope choice. |
| 4 | Emergency | Administrator and Emergency Officer may send after audience preview and explicit confirmation, without a second approver. |
| 5 | IT packages and rollout | IT Operator may import into the global package registry and deploy only to devices within their scope. |
| 6 | Viewer | Recipient-level report details and export are allowed, strictly within the assigned scope. |
| 7 | Session changes | Role/scope changes immediately terminate active sessions; the user must log in again. |
| 8 | AD groups | Initial access management is per user. AD Group Mapping is deferred. |

Future AD Group Mapping must define manual/group precedence, multi-group conflicts, nested groups,
membership TTL, outage behavior, and revocation. None is assumed in the first stage.
Detailed UX is specified in users-access-ux-contract.md. Source reconciliation, documented gaps and implementation gates are recorded in users-access-verification.md.

## 13. Request/response supplement and enforcement boundaries

Lists: page >= 1, pageSize in 10/25/50/100 (default 25), search <= 100 characters,
status and role drawn from the catalog. Response: {items, page, pageSize, total};
total reflects authorized rows. Sort by updatedAt descending then id for deterministic pagination.
User detail: {id, username, fullName, email, status, roleId, scopes, revision, lastLoginAt}.
Date/time values use ISO 8601 UTC; the UI displays the existing application timezone conventions.
Scope input uses {scopeType, scopeValue}; reject unknown keys, malformed UUIDs, duplicates,
mixed Global/local grants, empty Active scope and inconsistent role/scope combinations with 422.
A Site grant subsumes Area grants in that site; normalize redundant grants before presenting review.

Directory search: minimum 3 characters, debounce 300ms in UI, maximum 20 results, 10-second timeout,
server rate limit 30 requests/minute per administrator. Escape LDAP filter input.
Return {directoryId, directorySubjectId, username, fullName, email, existingUserId, existingStatus};
lookup privileges are server-side, never direct LDAP access from the browser.
Resolve the submitted directory identity again server-side before grant; never trust supplied display attributes.
Directory timeout returns 503 DIRECTORY_UNAVAILABLE and makes no changes.

Create: {directoryId, directorySubjectId, roleId, scopes, reason}; success returns full user detail (201).
Assignment: {roleId, scopes, expectedRevision, reason}; status: {status, expectedRevision, reason}.
Reason is trimmed, required, 5–500 characters. Unknown fields are rejected.
User creation on login and admin creation share the unique directory identity constraint;
a race returns 409 USER_ALREADY_EXISTS with the existing internal ID for authorized administrators.
Pending activation occurs through assignment save in one transaction. Active status requests without a
valid assignment return 422. Revocation also increments authorizationVersion/revision.
Mutation response contains the updated detail and session effect; never return session token material.
409 STALE_REVISION includes the current revision and a safe reload action; never overwrite automatically.

No bulk grant, role change, disable, or session revocation in stage one.
All administrative reads and mutations must be mapped to a permission and scope policy before cutover.
Agent authentication routes remain on device-session authorization. Explicit public endpoints such as health/login
remain allowlisted; “deny unmapped endpoints” applies to administrative routes, not those intended public/device routes.
Scheduled/recurring jobs need persisted initiating actor ID and authorization checks, including cancel/reassign actions.

AgentLocalRoutine policies already synchronized to offline devices cannot be recalled immediately by server session revocation.
Stop issuing/reissuing unauthorized policies and send deactivation on the next agent sync. Record the device/offline
limitation explicitly; do not promise instant cancellation of offline execution or already accepted updater commands.
Server-side queued jobs must remain blocked pending authorized review.

Shared global templates may be read by scoped users but only Global holders of templates.manage may modify them.
Scoped communication operators manage explicitly scoped templates/programs; shared-object ownership/schema is a required
implementation gate. Existing global-only records must not become editable by any scoped operator implicitly.
