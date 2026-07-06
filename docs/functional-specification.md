# MTI Alert Functional Specification

## Document Status
- Version: `0.1`
- Status: `Draft Baseline`
- Last Updated: `2026-07-06`

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

### 9. Device Endpoint Policy
- Windows Agent endpoints are device-centric in MVP, especially for shared PCs and laptops.
- Device records remain operationally flat, but each device stores site, area, and location metadata directly.
- Device ownership is location-oriented rather than person-oriented for desktop targeting.
- Device health uses the states `Online`, `Offline`, and `Stale`.

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
2. User selects content type, priority, audience, channels, and response workflow or uses a template.
3. System enforces template locks and override rules.
4. System resolves and previews audience, channel plan, and policy impact.
5. User confirms publish now or schedules.
6. System creates delivery jobs.
7. Delivery jobs are executed per channel.
8. Status becomes visible in monitoring screens.

### Workflow 2: Recurring Reminder
1. User creates a reminder communication.
2. User defines recurrence rule.
3. System generates scheduled executions.
4. Each execution creates its own delivery jobs and delivery tracking records.

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

## Functional Requirements
### Communication Authoring
- `FR-1` The system shall allow authorized users to create, edit, duplicate, cancel, and archive communications.
- `FR-2` The system shall support a unified communication form with type-specific fields controlled by metadata and workflow rules.
- `FR-3` The system shall support immediate and scheduled publication.
- `FR-4` The system shall support recurring schedules for reminder-type communications.
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
