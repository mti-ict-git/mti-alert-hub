# Users & Access — UX Contract

Status: Approved target contract. English application copy. UI implementation and isolated browser verification are recorded in users-access-implementation.md; production activation remains pending.
Authority: users-access-contract.md, especially the eight confirmed product decisions.
Visual ownership: ../DESIGN.md and ../UX-CONTRACT.md. Reuse the existing Settings shell.

## 1. Navigation and layout

Settings > Users & Access replaces the existing Roles & Permissions placeholder.
Only access.read exposes this entry; direct unauthorized navigation shows the shared forbidden state.
Two tabs: Users and Roles. No AD Group Mapping/custom-role controls initially.
Use a route search parameter for tab, search, status, role, site, page and pageSize.
Refresh/back navigation restores list state. Opening an editor preserves the current list query.

Desktop:
    Users & Access                         [Grant access]
    [Users] [Roles]
    Search name or UPN    Status    Role    Site    Reset filters
    Name / UPN | Role | Scope | Status | Last login | Actions
    Showing 1–25 of N                               Pagination

No separate dashboard/stat-card row is required. Pending is a status filter with a count drawn from
the same authoritative user list; it is not a second independent user-management screen.
Defaults: all statuses, 25 rows, updated descending. Last login missing displays “Never”.
Scope summary: Global, or up to two location names followed by “+N more”; activating the summary reveals the full list.
Rows use a visible View access action; never make a hidden whole-row click the only entry.
At narrow widths, controls stack, table scrolling remains local, and the editor becomes a full-width sheet.
No bulk selection or bulk access changes initially.

## 2. Users list states

| State | Behavior and copy |
|---|---|
| Initial loading | Table skeleton preserving header/toolbar dimensions; no fake zero count |
| No users | “No application users yet.” Primary action: Grant access |
| No Pending users | “No users are waiting for access.” Clear filter |
| No search matches | “No users match these filters.” Reset filters |
| Fetch error | “Unable to load users.” Retry, preserving filters |
| Background refresh | Keep existing rows; subtle fetching indicator, no layout replacement |
| Forbidden | “You do not have permission to manage user access.” Return to dashboard |
| User removed from current result | Refresh list; clamp page to the last valid page |

Changing search/filter/pageSize returns to page 1. Search is debounced by 300ms.
Actions are derived from effective permissions, not display role labels.

## 3. Grant access

Use a right-side sheet on desktop and full-width sheet on narrow screens.
Header: “Grant access”; step labels: User / Access / Review.
Back preserves entered values. Close/Escape with changes prompts “Discard access changes?”
Keep editing is the default action; Discard is explicit.

### User step

Label “AD user”; hint “Search by name or corporate username. Enter at least 3 characters.”
Search rows show name + UPN; do not expose full DN or directory groups.
Typing fewer than three characters shows guidance, not an error. Cancel stale search requests.
Loading, no match, directory unavailable and retry states are distinct.
No match copy: “No directory users found. Check the name or username.”
Directory failure: “Directory lookup is unavailable. Try again.” No manual identity bypass.

Selecting a result shows a read-only identity summary.
Existing Active/Disabled account: “This user already exists.” Offer View access; block duplicate creation.
Existing Pending account: “This user is waiting for access.” Continue using that record and its revision.
Continue is disabled until a verified directory result is selected.

### Access step

Role is a single shared Select with five role labels and concise descriptions.
No preselected role. Show the selected role's key permissions beneath the field.
IT Operator callout: “Package imports are global. Device upgrades remain limited to the selected locations.”
Emergency Officer callout: “Can publish emergency notifications after preview and confirmation.”

Scope is an explicit choice between Global and Selected locations.
Administrator locks Global with the explanation “Administrators manage the entire application.”
Selecting another role clears implicit Global and requires a fresh scope choice.
Selecting Global asks the administrator to review the access breadth; no hidden auto-selection.
Switching from locations to Global clears location grants only after confirmation if selections exist.

Locations use a searchable Site/Area hierarchy with independent checkboxes:
selecting a Site includes all its areas; selecting an Area grants only that area.
A partially selected site uses an indeterminate state. A full Site grant removes redundant child grants.
Provide “All areas in this site” explicitly; merely expanding a site does not grant it.
Selected grants appear as removable chips with full names. At least one grant is required.
Inactive locations remain visible on existing records with a warning but cannot be added.
No Department/Section grant control in this stage.

“Reason for change” is required (5–500 trimmed characters), with counter and inline validation.
Continue validates fields, focuses the first invalid field, and keeps the selection intact.

### Review step

Show identity, role, scope, reason, and key allowed actions using plain English.
Highlight Global scope and emergency/import/rollout privileges where applicable.
For an existing Pending user, status changes Pending -> Active on successful save.
Buttons: Back and Grant access. Do not label a permission mutation “Next”.

While saving: disable duplicate submission; show “Granting access…”.
On success: close sheet, refresh affected list/counts, announce “Access granted to {name}.”
An active Pending filter may no longer show that user; toast links to View access.
On validation error: return to the relevant field without losing input.
On ambiguous network failure: “The result could not be confirmed. Check this user's access before retrying.”
Reuse the same idempotency key for a retry of the identical submission; edits create a new key.

## 4. View and edit access

View sheet shows directory identity, application status, role, complete scope, last login and last access change.
Primary action Edit access. Secondary menu: Revoke sessions; Disable access or Enable access.
Pending records instead expose Grant access. No impersonation, password-reset or delete-user action.
Audit link opens the authorized audit view filtered by target user ID.

Edit uses the same Access/Review components as Grant access. Identity cannot be changed.
Save remains disabled until there is a valid difference and reason.
Review presents old/new role and scope with Added/Removed indicators, not color alone.
Required copy: “Saving will sign this user out of all active sessions. They must sign in again.”
Self-edit adds: “This change will sign you out.” Success clears local state and navigates to login.
Changing role updates capability explanations immediately; it never submits by itself.

409 STALE_REVISION: preserve the proposed edits, display “Access was changed by another administrator.”
Offer Reload latest and Cancel. Reload shows the current saved values; review edits again before saving.
Do not merge grants or overwrite automatically.
409 LAST_ADMIN: “Keep at least one active Administrator with Global access.”
Retain form values; no bypass checkbox.

## 5. Disable, enable and revoke

Disable dialog:
- Title: “Disable access for {name}?”
- Body: “They will be signed out and cannot use MTI Connect. Their AD account will not be changed.”
- Required reason; buttons Cancel / Disable access.
- Success: “Access disabled.” Keep user and audit history visible.
- Last administrator: action disabled with an accessible explanation; backend repeats the check.

Enable opens Access/Review with the retained assignment, requiring validation of current scope.
Do not reactivate stale sessions or approve inactive grants silently.
Success: “Access enabled. The user can sign in again.”

Revoke dialog:
- Title: “Sign out {name} everywhere?”
- Body: “All current sessions will end. Their role and scope will stay the same, and they can sign in again.”
- Required reason; buttons Cancel / Sign out all sessions.
- Success: “Sessions revoked.”
- No requirement to display device/IP session details; avoid implying an unavailable session inventory.

All mutations refresh the user revision. Server-side permission changes during editing produce a forbidden
state rather than saving with stale privileges. Discard in-memory sensitive details after session loss.

## 6. Roles matrix

Read-only table grouped by module. Columns show the five roles.
Permission rows use business labels, with technical IDs available only in help/developer documentation.
Use “Allowed” / “Not allowed” text or accessible icon labels. Role names and row headings remain visible.
Search filters permission names; an empty match offers Clear search.
A scope note remains visible: “Allowed actions are limited by each user's assigned scope unless marked Global.”
Package import is marked Global. Viewer report detail/export is Allowed.
No checkbox, Save button, Add role, or role editing affordance in stage one.
On mobile use a role selector with the same permission list instead of squeezing five unreadable columns.

## 7. Pending and session-expiry experience

After successful AD authentication without access:
    Access pending
    Your account is waiting for an administrator to assign a role and scope.
    Contact your MTI Connect administrator.
    [Back to sign in]

No dashboard/sidebar or privileged bearer token is issued.
Do not imply that an email or approval notification was sent.
Returning later requires a fresh login; no automatic polling using a privileged pending session.

After access change, on the next authorization check:
“Your access has changed. Sign in again to continue.”
Disabled: “Your access has been disabled. Contact your administrator.”
Expired session: existing session-expiry copy; distinguish it from Disabled.
Cross-tab session clearing uses the existing session-change mechanism; the server remains authoritative.

## 8. Canonical component ownership

| Capability | Owner | Contract |
|---|---|---|
| Shell, location, page title | Existing Settings and PageHeader | Existing spacing, typography, theme |
| Tables and server query state | Shared Table + TanStack Query | Authorized server totals, 10/25/50/100 |
| Role selection | Shared Select | Single-select, keyboard accessible |
| Site/Area grants | Shared business component to extract/reuse after component audit | Hierarchical checked/partial states, no independent screen-local copies |
| Editor | Shared Sheet/form primitives | Focus trap, restore focus to trigger |
| Confirmations | Shared AlertDialog | Explicit action labels, reason validation |
| Feedback | Existing Sonner + inline error/live regions | Errors retained where actionable |
| Styling | DESIGN.md semantic tokens | Light/dark and visible focus; no new visual theme |

On open focus the sheet title/first field; after step changes focus the step heading.
Use aria-describedby for guidance/errors and aria-live for asynchronous results.
Submission state must be announced, keyboard navigation must remain usable, and color is not the sole status indicator.
Persist no directory search results or access form data in localStorage.

## 9. UX acceptance scenarios

1. Pending account appears in the filter; assigning access removes it from Pending and makes it Active.
2. Existing account selection cannot create a duplicate; directory failure cannot be bypassed by typing an ID.
3. Role changes require deliberate scope selection; selecting a Site and its child creates no duplicate grants.
4. Review accurately shows before/after and the mandatory sign-out effect.
5. Cancel/back/error preserve expected state; stale-save conflict never overwrites another administrator.
6. Last administrator cannot be disabled/demoted through UI or API.
7. Viewer can open in-scope recipient details and export; out-of-scope totals/details are absent.
8. Keyboard-only grant/edit/revoke flows, narrow layouts and both themes remain usable.
9. Session invalidation interrupts stale browser actions; no successful response is fabricated after a failed save.
10. Matrix, grant review and effective backend permissions agree for all five roles.
