# MTI Alert Functional Specification

## Document Status
- Version: `0.4`
- Status: `Draft Baseline`
- Last Updated: `2026-07-16`

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
1. User opens `Wellness Programs` from the `Notifications` cluster.
2. User creates or edits a wellness program such as `Eye Break` or `Office Stretching`.
3. User selects the wellness family first, then chooses one or more approved visual variants plus the variant delivery strategy (`Fixed`, `Sequential`, or `Shuffle`) when multiple variants are enabled.
4. User configures recurrence through an operator-friendly cadence UI, confirms the local execution mode, chooses either a bounded validity window or `never expires until stopped`, assigns one or more device targets while staying inside the device-centric targeting model, and selects whether device rollout is synchronized or staggered across a bounded offset window.
5. Server publishes a versioned reminder policy for eligible Windows Agent devices, materializing one policy per device and optionally offsetting the policy anchor when staggered delivery is selected.
6. Windows Agent executes the reminder locally using the specialized wellness presentation template.
7. For guided routines, the agent may continue into a multi-step local flow after the initial reminder card is acknowledged.
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
- `FR-4E` The system shall invalidate or replace locally stored reminder policies when the server updates, expires, or cancels the schedule.
- `FR-4F` The admin authoring experience shall expose cadence, timezone, execution mode, first occurrence, and expiry policy explicitly when operators create or edit recurring reminders, and the draft shall persist that reminder definition before publish.
- `FR-4G` The admin authoring experience shall explain the difference between `ServerGenerated` and `AgentLocalRoutine` so operators can predict whether a reminder is server-triggered or executed locally on Windows Agent.
- `FR-4H` The admin monitoring experience shall expose reminder schedule metadata, reminder policy activity, and reconciled reminder evidence so hybrid reminder behavior remains auditable and understandable for operators.
- `FR-4I` The admin experience shall keep wellness authoring and wellness monitoring outside `Notification Center`, even when the backend reuses reminder-oriented contracts and persistence.
- `FR-4J` Wellness CTA semantics shall remain explicit in MVP: `GotIt` and `Done` confirm the routine was performed, while `RemindMeLater` records a defer or snooze decision rather than a completion.
- `FR-4K` Wellness operational reporting shall remain device-centric in MVP, with active-user identity treated only as optional audit metadata captured at event time when available.
- `FR-4M` Wellness authoring shall support batch selection of multiple device targets within the same draft or publish flow without changing the underlying device-centric execution model.
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
- `FR-19F` The device-management quick test flow shall preserve or synthesize a separate `instruction` value so the Windows Agent popup can validate the full body-versus-instruction layout during connectivity checks.
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
