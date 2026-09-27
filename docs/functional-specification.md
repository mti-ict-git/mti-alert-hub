# MTI Alert Functional Specification

## Document Status

- Version: `0.5`
- Status: `Draft Baseline`
- Last Updated: `2026-09-12`

## Product Definition

`MTI Alert` is a centralized communication server platform that enables organizations to create, schedule, deliver, monitor, and govern real-time communications across multiple channels. The MVP channels are `Windows Agent` and `WhatsApp`.

The system uses a unified communication model for:

- Alerts
- Reminders
- Operational notices
- Internal news
- Articles
- Knowledge updates

## Core Functional Domains

### 1. Identity And Access

- Authenticate administrative users through enterprise directory integration.
- Support hybrid roles:
  - `Central Admin`
  - `Local Operator`
  - `Management Viewer`
- Use directory authentication for identity verification only.
- Use MTI Alert local role and scope mapping for authorization.
- Enforce scope restrictions primarily by site and area for device-targeted desktop delivery.

### 2. Communication Management

- Create communication drafts.
- Author communications from templates or compose them from scratch.
- Require a strong preview and confirmation step before publication because MVP has no approval workflow.
- Classify communications by:
  - content type
  - priority
  - category
  - target audience
  - delivery channels
- Save drafts, publish immediately, or schedule for future execution.
- Support recurring schedules for routine reminders.
- Treat the server as the source of truth for recurring reminder lifecycle, including create, update, cancel, and versioning.
- Allow bounded local execution on Windows Agent for approved routine reminders so recurring prompts remain reliable during temporary connectivity loss.
- Allow specialized recurring ergonomic experiences through `Wellness Programs`, which remain part of the broader notification domain but use a dedicated authoring, lifecycle, and monitoring surface rather than the generic `Create Notification` form.

### 3. Audience Targeting

- Select recipients by:
  - all employees
  - site
  - area
  - department
  - section
  - role
  - individual employees
  - saved audience groups
- Preview the resolved audience before sending.
- Prevent operators from targeting outside their scope.
- Resolve Windows Agent targeting primarily as `device-by-location`.

### 4. Channel Orchestration

- Send one communication through one or more enabled channels.
- MVP channels:
  - Windows Agent
  - WhatsApp
- Future channels:
  - Email
  - Digital Signage
- Track per-channel and per-recipient delivery lifecycle.
- Respect employee channel preferences as the default delivery strategy when more than one eligible channel is available.
- Use device-targeted delivery for Windows Agent and employee/contact-targeted delivery for WhatsApp.
- For critical templates, support desktop-first delivery with a short WhatsApp delay when dual-path policy is enabled.
- Keep critical and ad hoc communications server-triggered; autonomous local execution is reserved for approved routine reminder policies only.

### 5. Recipient Response Workflow

- Communications may require no response, simple acknowledgment, or a custom response flow.
- Response behavior is selected per communication template or explicit communication policy.
- A response flow may define:
  - response options
  - whether a free-text note is allowed or required
  - escalation timeout
  - follow-up action rules
- Example response options:
  - `Acknowledged`
  - `Safe`
  - `Need Assistance`
  - `Not In Area`
- For workflow-enabled communications, a submitted response implicitly counts as acknowledgment in MVP.

### 6. Monitoring And Reporting

- Provide communication-level status overview.
- Show counts for queued, sent, delivered, read, responded, failed, and overdue responses.
- Show recipient drill-down with status and response detail.
- Provide dashboard summaries and historical reports.
- For `Wellness Programs`, keep operational monitoring device-centric in MVP, while allowing the currently logged-in Windows user to be captured as optional audit metadata when the device can report it safely.
- The `Wellness Programs` detail `Recipients` tab shall present one row per device, emphasize device identity, latest active user (when reported), site/area, last activity, next run, and schedule state, and omit non-operational `Section` detail from the primary monitoring table.

### 7. Administration

- Manage organizational structure references.
- Support external HR synchronization for basic organization data with limited MTI-managed adjustment capability.
- Manage channel configuration and health visibility.
- Manage templates, template policies, and reusable workflow definitions.
- Capture audit logs for key actions.

### 8. Recipient Experience Policy

- Windows Agent presentation must support mixed behavior by policy and priority.
- Critical communications in MVP shall start as an immediate modal, not as a toast.
- Non-critical communications may use lighter presentation modes.
- Presentation behavior should remain configurable through templates or policy rules.
- Critical communications may escalate presentation strength on the same device if no interaction occurs within policy limits.
- Wellness-oriented recurring reminders may use brighter and friendlier visual themes than the operational notification baseline, especially blue and green ergonomic themes for eye-break and stretching experiences.

### 9. Device Endpoint Policy

- Windows Agent endpoints are device-centric in MVP, especially for shared PCs and laptops.
- Device records remain operationally flat, but each device stores site, area, and location metadata directly.
- Device ownership is location-oriented rather than person-oriented for desktop targeting.
- Device health uses the states `Online`, `Offline`, and `Stale`.
- Unknown Windows Agent endpoints may surface in a pending admin approval queue, but they must not become trusted delivery devices until an operator approves them into the baseline.
- Routine reminder policies may be synchronized to Windows Agent for bounded local execution, but the server remains authoritative for policy lifecycle and invalidation.
- `Wellness Programs` assignment remains device-targeted in MVP. Active user identity on the endpoint may be collected as supporting audit context for activity evidence, but it does not replace the device as the authoritative execution target.

### 10. Template Policy

- Templates are full policy objects, not just content presets.
- Templates define content defaults, workflow policy, channel policy, presentation policy, and targeting constraints.
- Templates are versioned for auditability.
- Locked template fields must be blocked at both UI and API layers if an operator attempts to override them.
- Editable operator fields in MVP are limited to title, body, target, and schedule.

## Primary Entity: Communication

The primary business entity is `Communication`.

Each communication includes:

- identity
- template reference
- template version snapshot
- content type
- priority
- title
- body
- optional structured payload
- target rules
- selected channels
- response workflow
- schedule
- publication state

The system treats reminders, warnings, announcements, news, and articles as different `communication types` using the same engine.
All MVP communication types remain delivery-tracked and read-tracked.

## Communication Types

- `Alert`
- `Reminder`
- `OperationalNotice`
- `News`
- `Article`
- `KnowledgeUpdate`

## Priorities

- `Info`
- `Warning`
- `Critical`

## Lifecycle States

### Communication Lifecycle

- `Draft`
- `Scheduled`
- `Queued`
- `Sending`
- `Active`
- `Completed`
- `Cancelled`
- `Failed`

### Recipient Delivery Lifecycle

- `Pending`
- `Sent`
- `Displayed`
- `Delivered`
- `Read`
- `Failed`

### Recipient Response Lifecycle

- `NotRequired`
- `AwaitingResponse`
- `Responded`
- `Overdue`

## Key Workflows

### Workflow 1: Create And Send Communication

1. User creates a draft.
2. User selects content type, priority, audience, channels, message body, Windows Agent presentation, and response workflow or uses a template. The instruction field remains policy-driven when the desktop channel is enabled.
3. System enforces template locks and override rules.
4. System resolves and previews audience, channel plan, and policy impact.
5. User confirms publish now or schedules.
6. System creates delivery jobs.
7. Delivery jobs are executed per channel.
8. Status becomes visible in Notification Center and detail monitoring screens.
9. Operators can reopen drafts directly from Notification Center, duplicate any prior communication as a new draft, and apply lifecycle-safe bulk actions such as cancelling multiple scheduled or active communications together.

### Workflow 2: Recurring Reminder

1. User creates a reminder communication.
2. User defines the cadence through an operator-friendly schedule builder, selects the timezone, and chooses whether the reminder expires at a specific time or stays active until manually stopped.
3. User explicitly chooses the execution mode as either `ServerGenerated` or `AgentLocalRoutine`.
4. System shows a publish summary describing whether each occurrence will be server-triggered or executed locally by Windows Agent from a synchronized reminder policy.
5. System stores the recurring schedule and its execution mode as the authoritative server record.
6. For server-generated schedules, the system generates scheduled executions.
7. For approved routine Windows Agent reminders, the system distributes a versioned reminder policy with a bounded validity window to eligible agents.
8. Each server-generated execution or local reminder occurrence produces delivery tracking evidence when the device reports back.
9. Operators can later review reminder schedule metadata, policy activity, and reconciled reminder evidence from the admin experience.

### Workflow 2A: Wellness Program

Published Scheduled/Active wellness programs support `Edit Program` and explicit `Apply Changes` confirmation. Revisions replace assignments and future schedules under the same program ID, increment schedule version, retain history, and reject stale edits. Agent devices apply replacements and removals at their next successful sync. See `wellness-program-revisions.md` for cadence-reset, offline, and failure semantics.

1. User opens `Wellness Programs` from the `Notifications` cluster.
2. User creates or edits a wellness program such as `Eye Break` or `Office Stretching`.
3. User selects the wellness family first, then chooses one or more approved visual variants plus the variant delivery strategy (`Fixed`, `Sequential`, or `Shuffle`) when multiple variants are enabled.
4. User configures recurrence through an operator-friendly cadence UI, selects a fixed whole-hour UTC offset instead of entering a free-text timezone, confirms the local execution mode, chooses either a bounded validity window or `never expires until stopped`, assigns one or more device targets by operator-recognizable hostname while the system retains the internal device ID, and selects whether device rollout is synchronized or staggered across a bounded offset window.
5. Server publishes a versioned reminder policy for eligible Windows Agent devices, materializing one policy per device and optionally offsetting the policy anchor when staggered delivery is selected.
6. Windows Agent executes the reminder locally using the specialized wellness presentation template, including authored explanatory copy for eye-break rules and authored movement guidance for stretching steps.
7. For guided routines, the agent may continue into a multi-step local flow after the initial reminder card is acknowledged. When the approved routine flow is configured for automatic progression, later stretching steps may advance locally without requiring an extra `Next` click after `Start`, while still preserving explicit completion and defer controls.
8. Agent reconciles activity such as `Triggered`, `Displayed`, `RemindMeLater`-driven defer or snooze, `Started`, `Completed`, or `GotIt`-confirmed completion back to the server, together with active user context when the endpoint can report it safely.
9. Operators review program activity and compliance from the dedicated wellness monitoring surface, primarily by device and optionally by the captured active-user audit context.

### Workflow 3: Critical Emergency Communication

1. User creates a critical alert.
2. User selects urgent channels and required response workflow.
3. System prioritizes dispatch and starts response monitoring.
4. Windows Agent renders the communication as an immediate modal according to critical policy.
5. If dual-path template policy applies, WhatsApp follows the desktop send after a short delay.
6. Management views response progress in real time.
7. In MVP, non-response escalation remains recipient-only, such as re-alerting or re-attempting the same recipient.

### Workflow 4: Recipient Response

1. Recipient receives the communication.
2. Device reports `Displayed` when the message is actually rendered.
3. Device reports `Read` only after real interaction.
4. Recipient submits a workflow-defined response when required.
5. System stores the response and updates monitoring status.

### Workflow 5: Device Connectivity Test

1. Operator opens the `Devices` admin view.
2. Operator sends a device-scoped test notification to an online Windows Agent device.
3. System creates and immediately publishes a one-time Windows Agent communication targeted only to that device.
4. The test communication includes a separate instruction block so operators can validate the full Windows Agent popup layout without opening the full draft-authoring flow.
5. The test communication becomes visible in Notification Center and the device can reconcile it through the standard Windows Agent message contract.
6. For device-activation or manual-setup scenarios, operators should be able to determine whether the popup actually appeared from device evidence and, when needed, from explicit user confirmation.

### Workflow 6: Pending Device Approval

1. A newly installed Windows Agent calls the session endpoint before it exists in the trusted device baseline.
2. System records or refreshes a pending device enrollment request instead of creating a trusted session automatically.
3. Operator opens the `Devices` admin view and reviews the pending queue.
4. Operator approves the request with at least a site assignment, or rejects it.
5. After approval, the next agent retry creates a normal trusted session without reinstalling the agent package.
6. The system records audit evidence so operations can trace who initiated the device test.

## Functional Requirements

### Communication Authoring

- `FR-1` The system shall allow authorized users to create, edit, duplicate, cancel, and archive communications.
- `FR-1A` Notification Center shall provide lifecycle-aware quick actions, including direct draft editing and contextual bulk actions that only expose operations valid for the selected communication states.
- `FR-2` The system shall support a unified communication form with type-specific fields controlled by metadata and workflow rules.
- `FR-2F` The admin experience shall keep `Create Notification` focused on standard communications, while `Wellness Programs` uses a separate authoring entry point under the same `Notifications` menu cluster.
- `FR-2A` The system shall preserve an optional `instruction` field separately from the main message body so channel-specific previews and Windows Agent rendering can present action guidance distinctly.
- `FR-2B` The admin authoring experience shall expose explicit `Windows Agent presentation` selection for communications that include the desktop channel so operators can intentionally choose `Toast`, `Modal`, or `Fullscreen` instead of relying on implicit priority defaults.
- `FR-2C` The admin and backend authoring rules shall enforce Windows Agent presentation semantics consistently: `Info + Toast` clears and hides the separate `instruction`, `Info + Modal/Fullscreen` may include `instruction`, and `Warning` shall always use `Modal` with required `instruction`.
- `FR-2D` The server shall allow an optional per-notification Windows Agent toast auto-dismiss override in seconds, bounded to a documented safe range, and the Windows Agent shall use that value only for `Toast` presentation while falling back to the client default when omitted.
- `FR-2E` Communication message bodies shall remain short-form operational content rather than article-length text. The server and admin authoring flows shall enforce a bounded maximum body length so Windows Agent modal actions remain visible and readable on a fixed notification surface.
- `FR-3` The system shall support immediate and scheduled publication.
- `FR-4` The system shall support recurring schedules for reminder-type communications.
- `FR-4C` The system shall keep the recurring schedule definition, policy version, and cancellation state on the server as the authoritative source of truth.
- `FR-4D` The system shall allow approved routine Windows Agent reminders to execute locally from a synchronized reminder policy with bounded validity.
- `FR-4D-1` Publishing or revising an `AgentLocalRoutine` schedule shall not additionally deliver a standard Windows Agent message. Wellness presentation shall use the structured template from reminder-policy sync; legacy delivery jobs for local-routine schedules shall be excluded from pending-message and realtime message delivery.
- `FR-4E` The system shall invalidate or replace locally stored reminder policies when the server updates, expires, or cancels the schedule.
- `FR-4F` The admin authoring experience shall expose cadence, timezone, execution mode, first occurrence, and expiry policy explicitly when operators create or edit recurring reminders, and the draft shall persist that reminder definition before publish.
- `FR-4G` The admin authoring experience shall explain the difference between `ServerGenerated` and `AgentLocalRoutine` so operators can predict whether a reminder is server-triggered or executed locally on Windows Agent.
- `FR-4H` The admin monitoring experience shall expose reminder schedule metadata, reminder policy activity, and reconciled reminder evidence so hybrid reminder behavior remains auditable and understandable for operators.
- `FR-4I` The admin experience shall keep wellness authoring and wellness monitoring outside `Notification Center`, even when the backend reuses reminder-oriented contracts and persistence.
- `FR-4J` Wellness CTA semantics shall remain explicit in MVP: `GotIt` and `Done` confirm the routine was performed, while `RemindMeLater` records a defer or snooze decision rather than a completion.
- `FR-4K` Wellness operational reporting shall remain device-centric in MVP, with active-user identity treated only as optional audit metadata captured at event time when available.
- `FR-4M` Wellness authoring shall support batch selection of multiple device targets within the same draft or publish flow without changing the underlying device-centric execution model.
- `FR-4R` Wellness authoring shall display device hostnames as the primary operator-facing identity while retaining device IDs only as internal targeting keys, and shall constrain timezone authoring to a fixed whole-hour `UTC-12` through `UTC+14` selection backed by valid IANA timezone identifiers.
- `FR-4N` Wellness monitoring shall expose a per-device `Next Run` view together with schedule state so operators can understand effective execution timing for synchronized, staggered, or snoozed local routines without database access.
- `FR-4O` Wellness reporting shall expose normalized outcome metrics and detail views that distinguish `Completed`, `Deferred`, `Dismissed`, `TimedOut`, `InProgress`, `NoInteraction`, and temporary `AmbiguousCloseCompletion` compatibility cases without requiring direct database access.
- `FR-4Q` Wellness effectiveness reporting shall support device-centric comparison by program family, cadence, distribution mode, site, and area; device-local hourly plus daily or weekly trends; and guided-routine start, step-advance, completion, and start-abandonment evidence. Step advancement shall not be labeled partial completion unless a future contract can prove completed steps against the routine total.
- `FR-4P` Wellness terminal outcomes shall reserve `Completed` for explicit `GotIt` or `Done` actions, map `RemindMeLater` to defer or snooze, and map both the window close button and a `Close` CTA to `Dismissed`; legacy `Completed + Close` evidence shall remain visibly ambiguous rather than being rewritten.
- `FR-4S` Eye-break wellness surfaces shall explain the practical meaning of the `20-20-20 Rule` in the popup copy so users understand the expected action instead of only seeing the rule name.
- `FR-4T` Office Stretching guided routines shall support authored per-step movement guidance, including clearer neck and shoulder instructions, rather than relying only on imagery or short titles.
- `FR-4U` Office Stretching guided routines shall support an approved automatic progression mode after `Start`, allowing subsequent step visuals and instructions to advance locally without requiring a manual `Next` click for every step unless the routine is paused or explicitly interrupted.
- `FR-4V` Wellness local execution shall support an activity-aware eligibility mode so reminder timing can be based on actual laptop or computer usage semantics when that policy is approved, instead of relying only on fixed wall-clock intervals.
- `FR-4L` A dedicated post-routine feedback prompt for rating wellness-program usefulness or need is deferred beyond the current MVP until the survey contract, trigger timing, and reporting expectations are separately approved.
- `FR-4A` The system shall support both template-first authoring and free composition.
- `FR-4B` The system shall enforce a strong preview and confirmation step before publication.

### Targeting

- `FR-5` The system shall allow targeting by organization hierarchy and individual recipients.
- `FR-6` The system shall show an audience preview before publication.
- `FR-7` The system shall enforce authorization scope during audience selection and publication.
- `FR-7A` The system shall support device-by-location desktop targeting using site and area as primary scope dimensions.

### Delivery

- `FR-8` The system shall create delivery jobs for each selected channel.
- `FR-9` The system shall store delivery attempts and outcomes per recipient and per channel.
- `FR-10` The system shall support at least Windows Agent and WhatsApp in MVP.
- `FR-10A` The system shall support a push-first Windows Agent delivery model.
- `FR-10B` The system shall use employee channel preference as a default delivery policy where multiple channels are available.
- `FR-10C` The system shall support desktop-first with short-delay WhatsApp dual-path delivery when required by template policy.
- `FR-10D` The system shall use bounded retry for agent delivery attempts.
- `FR-10E` The system shall limit autonomous local scheduling to approved routine reminder policies and shall not rely on it for critical or emergency communications.

### Response

- `FR-11` The system shall allow communications to require no response, simple acknowledgment, or custom workflow response.
- `FR-12` The system shall store response option, response time, actor, and optional note.
- `FR-13` The system shall track overdue expected responses.
- `FR-13A` The system shall allow response workflow requirements to be driven by template policy.
- `FR-13B` The system shall limit automatic MVP escalation to recipient-only follow-up behavior.
- `FR-13C` The system shall treat a workflow response as acknowledgment in MVP.

### Monitoring

- `FR-14` The system shall provide live or near-real-time summary metrics for communications in progress.
- `FR-15` The system shall provide recipient-level detail including delivery and response state.
- `FR-16` The system shall expose channel health and connector status for operations teams.
- `FR-16A` The system shall track all MVP content types, including news, articles, and knowledge updates, in the same monitoring model.
- `FR-16B` The system shall record `Displayed` when the device actually renders a message.
- `FR-16C` The system shall record `Read` only after real user interaction on Windows Agent.
- `FR-16D` The system shall only mark WhatsApp as `Read` when a provider or gateway supplies an actual read receipt.

### Administration

- `FR-17` The system shall support template management.
- `FR-18` The system shall support workflow definition management for reusable response models.
- `FR-19` The system shall record audit logs for administrative and communication lifecycle actions.
- `FR-19E` The device-management experience shall support sending an immediate Windows Agent test notification to an online device without requiring operators to author a manual draft first.
- `FR-19F` The device-management and activation experience shall support popup-visibility confirmation for manually configured endpoints, using device-reported evidence first and a clear operator-visible fallback when explicit end-user confirmation is still required.
- `FR-19H` The device-management quick test flow shall preserve or synthesize a separate `instruction` value so the Windows Agent popup can validate the full body-versus-instruction layout during connectivity checks.
- `FR-19G` The device-management experience shall expose a pending-device approval queue so unknown Windows Agent endpoints can be reviewed and approved without manual database-side pre-registration.
- `FR-19A` The system shall support imported or synchronized organization data with limited MTI-managed adjustment capability.
- `FR-19B` The system shall use external HR synchronization as the primary source for MVP basic organization data.
- `FR-19C` The system shall support versioned templates with template policy snapshots on communications.
- `FR-19D` The system shall block and explain attempts to override template-locked fields.

## Non-Functional Expectations

- Near-real-time status visibility for active communications.
- Traceable and auditable state changes.
- Extensible architecture for additional channels.
- Clear contracts for parallel backend, frontend, and Windows Agent development.
- Policy-driven configuration for retry limits and stale thresholds.

## MVP Assumptions

- Windows Agent is the primary desktop receiver application and is implemented separately in C#.
- Windows Agent uses a push-first real-time model aligned with a SignalR-style interaction pattern.
- WhatsApp delivery is handled through an external provider or gateway integration.
- LDAP or Active Directory is used for authentication, while MTI Alert remains the source of authorization and scope mapping.
- No approval workflow is required before publication in MVP.
- External HR synchronization supplies basic organization data on a scheduled batch basis.
- Email and Digital Signage remain future channels but must fit the same core model.


### Services theme adoption — local list navigation (2026-09-13)

The admin theme uses the shared shell, cards, tabs and form controls recorded in `DESIGN.md`. Employees, Notification Center, Wellness Programs and the approved/pending Device tables page the existing loaded result sets with 10/25/50/100 rows (default 25). The displayed range explicitly describes loaded results and does not assert a server-wide total. Filters/page-size changes reset page 1 and shrinking results clamp the current page. Notification Center select-all and bulk operations apply only to the visible page; the toolbar names that scope. This UI change preserves server fetch limits, lifecycle rules, permissions and action endpoints. Search remains local and clearable. See `services-theme-checklist.md` for implementation and verification limits.

### Phase 4 UI polish — 2026-09-13

Operational list screens (Notification Center, Employees, Devices, Wellness Programs and Reports) expose Comfortable/Compact density and a Columns menu. Density persists per browser; column choices last for the mounted table and can be restored with Show all columns. Identity, selection, status, priority and actions cannot be hidden. Sticky headers remain in each bounded scroll region; identifying columns also stay pinned on desktop. Mobile retains internal horizontal table scrolling.

Active filters appear as removable chips with Reset filters and matching loaded-result counts. Approved and pending Devices have independent local search. These controls filter the already loaded records; existing server fetch limits, route contracts, permissions and business actions are unchanged. Empty searches, including pending enrollment requests, show a recoverable empty message. Notification selection still scopes to the current page.

The dashboard prioritizes active communications, pending recipients, overdue responses and failed delivery totals. When the overview has overdue responses or failed deliveries, an attention strip links to Notification Center. Illustrative acknowledgement, delivery and activity panels are explicitly labeled; they do not become live backend metrics. Shared status labels add an icon without changing the meaning of any status.

### Wellness operator overview refinement — 2026-09-13

The Wellness list displays five columns: Program, Schedule, Status, Completion and Actions. Completion keeps the existing percentage and explicitly labels completed/triggered counts; it does not represent unique employees. Existing detail pages remain the owner of technical configuration, policy/device signal and event breakdowns. The summary shows Scheduled/Live, Drafts and Completion. Theme/type/status filters are collapsed behind Filters; active filter chips remain removable. View is the primary action; permitted Edit/Publish, Duplicate and Deactivate are in the row menu. Deactivate now asks for confirmation before invoking the unchanged mutation. Existing eligibility, route destinations, loaded-result pagination and refresh interval remain unchanged.

### Wellness detail presentation — 2026-09-13

The default Overview provides message/instruction, configured action labels, guided-step count, readable recurrence, timezone, first occurrence, expiry, next-run summary and target summary. All previous configuration fields remain available under Configuration. Audience preview warnings also appear on Overview. Audience, active/synchronized policy counts and outcome retain their existing data definitions. Program editing, publishing, CSV export, activity, recipient and delivery-log workflows are preserved. Deactivate is accessed from More program actions and still requires the existing confirmation dialog.

### Devices bulk approval — 2026-09-13

Approved Devices displays Hostname before Device ID; hostname remains the readable pinned identity. Pending Approval allows selecting multiple Pending requests on the current page, including select-all and indeterminate state. Changing the visible page/search/page size resets selection. The Approve selected button displays the exact selected count.

A shared confirmation dialog lists hostnames and identifiers, requires Site, and applies the same optional Area/Location Label and Ownership to all selected requests. Single-request approval remains supported by the same dialog. Submission uses a frozen request/settings snapshot and sequential existing `POST /devices/pending/{requestId}/approve` calls. Backend authorization, pending-state checks, site/area validation, device-conflict checks and audit behavior remain authoritative. No new bulk endpoint or database schema is introduced.

Each request commits independently. The dialog shows approved/not-approved results and error messages, refreshes device lists, and offers retry only for requests not confirmed approved. A network interruption can leave an outcome uncertain; the operator is told to refresh/check current device state before retry. Already-approved/rejected requests remain protected by backend pending-state validation. Closing and repeated submission are blocked during the active batch. No automatic rollback of successful approvals is attempted.

### Approved Device filters — 2026-09-13

Approved Devices supports combined local search, Online/Offline status, Site, Area, Ownership and Agent version filters. Site/area/version options derive from the loaded devices; missing area/version has an explicit No area/Unknown version option. Changing Site clears Area and limits its options to that site. Active filters have removable chips and a shared reset. Any filter change resets pagination. Empty matches provide recovery guidance. Summary totals describe loaded devices, while the filter toolbar reports matching loaded results. Backend fetch limits and approval behavior are unchanged.

### Bulk rollout from Devices

Operators can select approved devices on the displayed page and choose Rollout selected. Search, filters, pagination, or changing visible device IDs clears selection. The existing single-device rollout action uses the same dialog. Preview validates each frozen target through the existing device-scoped rollout endpoint with apply=false. Any setting change invalidates preview; all targets must pass before apply=true requests run sequentially. Results remain visible per hostname and distinguish created requests from actual agent installation. Closing is blocked during a batch. Unconfirmed requests are not automatically retried: operators must inspect rollout history before starting another request because a lost response may already have committed. Successful requests cannot be reapplied within the same dialog session. No API/schema changes.

Approved Devices advanced filters are collapsed by default behind Filters. Active counts/chips stay visible when collapsed. Bulk rollout and selection feedback share the table toolbar with Comfortable/Columns; selection scope and rollout validation remain unchanged.

### Organization management — direction approved 13 September 2026

Add Organization under Management before Employees and Devices. Master sites/areas and departments/sections belong here; people assignment stays in Employees and device placement stays in Devices. Two tab groups expose parent lists and filtered children, with search/status filters and usage counts.

CentralAdmin can create local entries, edit name/code, deactivate and reactivate. Parent reassignment is intentionally unavailable to avoid inconsistent existing employee/device placement. Existing assignments/history remain when inactive; reference choices already omit inactive rows. A parent with active children cannot be deactivated. Departments may be global and sections may be unassigned, reflecting the existing nullable schema.

Rows whose source is null/empty, Local or Manual are editable; other source labels are read-only and must be changed upstream. This is an ownership marker, not a claim of an active sync connection. All changes require optimistic version checking and transactional audit. No delete action or endpoint. Usage for department/section devices counts primary employee assignments, not current logged-in user.

### Device placement and AD departments — direction updated 13 September 2026

Section is not used operationally: hide Section navigation in Organization and do not expose it in device placement. Retain legacy schema and historical relationships. Department in Devices placement is read-only from last_directory_department, gathered by the existing agent AD lookup; this is the last reported login snapshot, not a new department-master synchronization service.

Devices offers Edit placement per row and Change placement for selected visible-page devices. A right-side review panel shows current hostname, Site, Area, location label, ownership and AD department. Bulk fields default to Do not change. Changing Site explicitly clears Area until a compatible area is selected. Review shows per-device before/after. Saving runs device-scoped transactions sequentially, displays partial results, and never retries automatically. Close/edit are blocked while saving; unsaved cancellation requires discard confirmation.

CentralAdmin only: changes may update Site, Area, Location Label and Ownership; assigned employee/AD profile are preserved. Placement-specific expected values prevent stale writes without heartbeat updates causing false conflicts. Validate active site/area membership; audit before/after atomically. Existing recipients, delivery history and active reminder policies are not rewritten. Audience resolution at future publication uses current placement (including drafts not yet published); previously published recipient snapshots remain unchanged.

### Direction update — Sites & Areas in Settings

The user requested removal of the remaining Departments menu and relocation of master locations to Settings. The canonical UI is now Settings → Sites & Areas, with Sites and Areas subtabs only. Organization no longer appears in Management. The old /organization URL redirects to /settings?tab=locations. Department/Section storage and backend contracts are retained for compatibility; they have no management tab here. Sites/Areas use their own Save changes action in the entry editor, not the general Settings save button. This supersedes the earlier standalone Organization menu direction.


## Create Notification device audience (2026-09-14)

Device targeting supports multiple explicit device identifiers using the existing targets API. The picker follows Wellness: search hostname/user/site/department, select or clear visible results, clear all and selected-hostname chips. At least one device is required; changing target type clears device selection. Confirmation shows count and hostnames. The current shared device list loads up to 200 devices and Select Visible applies only to loaded search results; this is disclosed beside the picker.


## Explicit toast renderer — Phase 4

Toast authoring now distinguishes Auto, Windows native and MTI Connect custom across frontend, API and agent. Rules, compatibility and verification: [Toast authoring contract](toast-authoring-contract.md).

## Proposed Users & Access (draft)

[users-access-contract.md](users-access-contract.md) proposes five built-in roles, permission-based guards, location scope and user administration. This draft extends the three-role baseline only after reviewed migration/cutover; it does not change current runtime behavior. AD remains the identity provider. Custom roles and group mapping are deferred.

### Office Stretching language

Built-in B1/B2 Office Stretching templates, agent previews, routine controls and completion copy use English. Existing saved content requires explicit revision; no automatic translation is applied to user-authored programs. See office-stretching-english.md for verification and release requirements.


## Wellness scheduling after Windows sign-in (2026-09-16)

See [Wellness sign-in schedule](wellness-windows-sign-in-schedule.md) for the session anchor, offline cache, one-minute unlock/resume grace, and single catch-up contract. The wellness editor reuses WellnessScheduleFields and the existing Select/Input primitives. Schedule basis is preserved during draft editing and published revisions. Existing fixed schedules and wellness presentation themes remain unchanged.


## Phase 4 - Policy receipt and device schedule reporting (2026-09-17)
The first Windows-sign-in interval starts at the later of first persistence of the policy version and Available from. A later Windows logon resets the interval; same-version sync, process restart, unlock and hibernate do not reset it. New schedule versions receive a new receipt anchor.
The agent asynchronously reports persisted policy application and its actual next occurrence, independently of wellness interaction events. The web monitoring view uses current-version device reports and explicitly distinguishes missing confirmation, unsupported agents and stale reports. Server sync timestamps are not proof of application.
Contract: `wellness-policy-application-reporting.md` in the parent application docs. Requires backend migration 0021 and a newly signed Windows Agent 1.0.18 or later. Production migration, package publication and pilot remain pending. Verification evidence is recorded in the parent contract document; this does not close Phase 4.
