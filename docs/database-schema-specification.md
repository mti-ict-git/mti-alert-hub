# MTI Alert Database Schema Specification

## Document Status
- Version: `0.5`
- Status: `Draft Baseline`
- Last Updated: `2026-08-26`

## Purpose
This document defines the conceptual database schema for the `MTI Alert` server MVP.

## Design Principles
- `Communication` is the main business entity.
- Audience rules and resolved recipients must both be stored.
- Delivery tracking and response tracking are separate concerns.
- Historical truth must remain queryable even if organization data changes later.
- Recurring schedules remain server-owned even when approved routine reminder policies are synchronized to Windows Agent for bounded local execution.

## Implementation Baseline
- Versioned database migrations are now part of the backend foundation.
- The first applied migration is `backend/migrations/0001_phase1_foundation.up.sql`.
- The second migration is `backend/migrations/0002_phase1_communications.up.sql`.
- The third migration is `backend/migrations/0003_phase2_agent_sessions.up.sql`.
- The latest reminder-authoring migration is `backend/migrations/0010_phase4_reminder_draft_authoring.up.sql`.
- The currently implemented migration baseline covers:
  - admin users and scopes
  - organization references
  - employees
  - devices
  - communication templates and workflows
  - communication drafts and target rules
  - device session persistence
- Delivery tracking, reminder policy, and realtime compatibility persistence are now implemented through the current Phase 2 migrations. Reporting-oriented rollups remain conceptual and should be added through later migrations as their modules are implemented.

## Core Tables
### users
Administrative users of the platform.

Key columns:
- `id`
- `username`
- `full_name`
- `email`
- `status`
- `role_type`
- `created_at`
- `updated_at`

### user_scopes
Defines the organizational scope assigned to an admin user.

Key columns:
- `id`
- `user_id`
- `scope_type` such as `Global`, `Site`, `Area`, `Department`, `Section`
- `scope_value`
- `created_at`

### sites
- `id`
- `code`
- `name`
- `status`
- `source_system`
- `external_reference`

### areas
Operational location areas used for device targeting and authorization scope.

Key columns:
- `id`
- `site_id`
- `code`
- `name`
- `status`
- `source_system`
- `external_reference`

### departments
- `id`
- `site_id`
- `code`
- `name`
- `status`
- `source_system`
- `external_reference`

### sections
- `id`
- `department_id`
- `code`
- `name`
- `status`
- `source_system`
- `external_reference`

### employees
Directory records used for targeting and recipient mapping.

Key columns:
- `id`
- `employee_number`
- `full_name`
- `email`
- `phone_number`
- `site_id`
- `area_id`
- `department_id`
- `section_id`
- `job_role`
- `employment_status`
- `has_windows_agent`
- `has_whatsapp`
- `preferred_primary_channel`
- `preferred_secondary_channel`
- `source_system`
- `external_reference`
- `created_at`
- `updated_at`

### devices
Registered Windows Agent devices.

Key columns:
- `id`
- `device_identifier`
- `hostname`
- `site_id`
- `area_id`
- `location_label`
- `ownership_mode` such as `LocationOwned`
- `primary_employee_id` nullable for non-shared or historically assigned devices
- `agent_version`
- `os_version`
- `last_heartbeat_at`
- `last_connection_at`
- `status`
- `created_at`
- `updated_at`

## Communication Domain Tables
### communications
Primary content record.

Key columns:
- `id`
- `template_id`
- `template_version`
- `communication_type`
- `priority`
- `category`
- `title`
- `body`
- `instruction` nullable operator-authored action guidance rendered separately from the main body when present
- `toast_auto_dismiss_seconds` nullable per-notification Windows Agent toast display duration override, bounded to 1-60 seconds
- `draft_schedule_json` nullable JSON snapshot for reminder recurrence authoring before publish
- `wellness_program_json` nullable structured `Wellness Programs` payload for reminder-specialized authoring and publish snapshots
- `status`
- `requires_response`
- `workflow_id`
- `created_by_user_id`
- `published_at`
- `scheduled_at`
- `cancelled_at`
- `created_at`
- `updated_at`

### communication_templates
Reusable authoring templates for communication creation.

Key columns:
- `id`
- `version`
- `template_key`
- `name`
- `communication_type`
- `default_priority`
- `default_title`
- `default_body`
- `default_channel_strategy`
- `mandatory_channels_json`
- `optional_channels_json`
- `default_windows_agent_presentation`
- `critical_behavior_mode`
- `default_requires_response`
- `workflow_id`
- `allowed_target_types_json`
- `locked_fields_json`
- `editable_fields_json`
- `is_active`
- `created_at`
- `updated_at`

### communication_schedules
Schedule definitions for one-time or recurring communications.

Key columns:
- `id`
- `communication_id`
- `schedule_type` such as `Immediate`, `Scheduled`, `Recurring`
- `scheduled_at`
- `recurrence_rule`
- `timezone`
- `execution_mode` such as `ServerGenerated`, `AgentLocalRoutine`
- `schedule_version`
- `valid_from`
- `valid_until`
- `is_active`
- `publish_request_json`
- `requested_by_user_identifier`
- `requested_by_username`
- `requested_at`
- `cancelled_at`
- `created_at`
- `updated_at`

Current implementation note:
- `Wellness Programs` MVP continues to reuse `communication_schedules` rather than introducing a standalone program-assignment schedule table.
- Recurring wellness execution remains server-owned at the schedule level, while `execution_mode = AgentLocalRoutine` allows bounded local execution on Windows Agent.
- For the first integrated slice, published wellness identity remains communication-rooted:
  - `programId = communication_id`
  - `programVersion = schedule_version`

### agent_reminder_policies
Materialized recurring reminder policies distributed to eligible Windows Agent devices for bounded local execution.

Key columns:
- `id`
- `communication_schedule_id`
- `communication_id`
- `device_id`
- `schedule_version`
- `recurrence_rule`
- `timezone`
- `title_snapshot`
- `body_snapshot`
- `instruction_snapshot`
- `windows_agent_presentation`
- `toast_auto_dismiss_seconds`
- `wellness_program_json` nullable snapshot of the structured wellness payload synchronized to the Windows Agent
- `valid_from`
- `valid_until`
- `is_active`
- `last_synced_at`
- `created_at`
- `updated_at`

### agent_reminder_events
Reconciled evidence from locally executed reminder occurrences on Windows Agent devices.

Key columns:
- `id`
- `agent_reminder_policy_id`
- `device_id`
- `event_type` such as `Triggered`, `Displayed`, `Read`, `Dismissed`, `Snoozed`, `Responded`, `Started`, `StepAdvanced`, `Completed`, `TimedOut`
- `occurred_at`
- `reported_at`
- `active_user_identifier` nullable
- `metadata_json` nullable
- `created_at`

Current implementation note:
- The same append-only reminder evidence table remains the MVP boundary for `Wellness Programs`.
- Wellness progression evidence such as `Started`, `StepAdvanced`, `Completed`, and `TimedOut` should be reported here rather than through a dedicated wellness-event table in the first slice.

### communication_targets
Stores authoring-time targeting rules.

Key columns:
- `id`
- `communication_id`
- `target_type` such as `All`, `Site`, `Area`, `Department`, `Section`, `Role`, `Employee`, `Group`, `Device`
- `target_value`
- `created_at`

### audience_groups
Saved named groups for reuse.

Key columns:
- `id`
- `name`
- `description`
- `created_by_user_id`
- `created_at`

### audience_group_members
- `id`
- `audience_group_id`
- `employee_id`

### communication_recipients
Resolved snapshot of recipients at publish time.

Key columns:
- `id`
- `communication_id`
- `communication_schedule_id`
- `recipient_type` such as `Device`, `Employee`, `ContactEndpoint`
- `device_id` nullable
- `employee_id` nullable
- `channel_endpoint`
- `site_id`
- `area_id`
- `site_name_snapshot`
- `area_name_snapshot`
- `department_name_snapshot`
- `section_name_snapshot`
- `recipient_name_snapshot`
- `response_state`
- `ack_state`
- `follow_up_triggered_at`
- `template_version_snapshot`
- `workflow_reference_id`
- `workflow_snapshot_json`
- `template_policy_snapshot_json`
- `created_at`

## Workflow Tables
### response_workflows
Reusable workflow definitions.

Key columns:
- `id`
- `name`
- `description`
- `workflow_type`
- `allow_free_text`
- `require_free_text`
- `escalation_timeout_minutes`
- `escalation_mode` such as `RecipientOnly`
- `response_implies_ack`
- `created_at`
- `updated_at`

Current implementation note:
- The MVP baseline currently uses managed seed loading during backend bootstrap to reconcile canonical workflow definitions with stable UUIDs, ensuring the expected `Critical Acknowledgement` and `Reminder Confirmation` workflows remain available even if the underlying seed rows drift after the original migration.

### response_workflow_options
- `id`
- `workflow_id`
- `option_key`
- `option_label`
- `sort_order`
- `is_terminal`

### recipient_responses
Dedicated normalized response rows are deferred in the current MVP runtime.

Current implementation note:
- Windows Agent and compatible-channel response evidence are currently persisted in `delivery_events` with `event_type = Responded`.
- Response state is mirrored onto `communication_recipients.response_state`, including persisted `Overdue` transitions when recipient-only timeout evaluation triggers.
- Workflows with `response_implies_ack = true` also update `communication_recipients.ack_state` to `Acknowledged`.
- Recipient-only overdue follow-up is currently tracked by `communication_recipients.follow_up_triggered_at` so the same recipient is re-alerted only once in the MVP baseline.
- `delivery_events.event_payload_json` currently carries:
  - `responseOptionKey`
  - `responseNote` when the workflow allows free text
  - `activeUserIdentifier` when the reporting channel can provide actor context

## Delivery Tables
### delivery_jobs
Channel-specific delivery jobs created after publish.

Key columns:
- `id`
- `communication_id`
- `communication_schedule_id`
- `communication_recipient_id`
- `channel`
- `delivery_strategy`
- `template_policy_snapshot_json`
- `job_status`
- `retry_limit`
- `attempt_count`
- `queued_at`
- `started_at`
- `completed_at`
- `next_retry_at`
- `last_error_message`

### delivery_attempts
Each send or retry attempt for a delivery job.

Key columns:
- `id`
- `delivery_job_id`
- `attempt_number`
- `provider_message_id`
- `attempt_status`
- `attempted_at`
- `response_payload_json`

### delivery_events
Append-only state transition history for delivery jobs.

Key columns:
- `id`
- `delivery_job_id`
- `event_type`
- `event_source`
- `event_payload_json`
- `occurred_at`


Current implementation note:
- `event_type = Overdue` is used when response timeout evaluation marks a recipient overdue and triggers recipient-only follow-up re-alert behavior for the same Windows Agent delivery job.
Recommended event types include:
- `Queued`
- `Sent`
- `Delivered`
- `Displayed`
- `Read`
- `Responded`
- `RetryScheduled`
- `Failed`

## Channel Tables
### whatsapp_connectors
- `id`
- `name`
- `provider_type`
- `base_url`
- `status`
- `created_at`
- `updated_at`

### device_sessions
- `id`
- `device_id`
- `session_token_hash`
- `expires_at`
- `created_at`

### device_realtime_connections
- `id`
- `device_id`
- `connection_identifier`
- `connected_at`
- `last_seen_at`
- `disconnected_at`
- `status`
- `created_at`
- `updated_at`

### agent_release_packages
Approved Windows Agent package metadata used for centrally governed updater rollout.

Key columns:
- `id`
- `version`
- `package_type` such as `MSI`
- `package_url`
- `sha256`
- `signature`
- `release_notes` nullable
- `channel` nullable such as `pilot` or `stable`
- `is_active`
- `created_by_user_id`
- `created_at`
- `updated_at`

### agent_rollout_intents
Approved rollout intent records evaluated for eligible Windows Agent devices.

Key columns:
- `id`
- `agent_release_package_id`
- `rollout_action` such as `Upgrade`, `Repair`, `Uninstall`
- `scope_type` such as `Global`, `Site`, `Area`, `Device`, `RolloutGroup`
- `scope_reference`
- `target_device_id` nullable for direct single-device rollout
- `mandatory`
- `deadline_at` nullable
- `notes` nullable
- `status`
- `approved_by_user_id`
- `approved_at`
- `created_at`
- `updated_at`

### agent_rollout_status_events
Append-only updater lifecycle evidence reported by Windows Agent endpoints for an approved rollout intent.

Key columns:
- `id`
- `agent_rollout_intent_id`
- `device_id`
- `reported_state` such as `Downloading`, `Installing`, `Succeeded`, `Failed`, `Uninstalling`
- `installed_version` nullable
- `target_version` nullable
- `updater_version` nullable
- `startup_registered` nullable
- `error_code` nullable
- `error_message` nullable
- `metadata_json` nullable
- `occurred_at`
- `reported_at`
- `created_at`

### policy_settings
Stores configurable operational thresholds and retry policies.

Key columns:
- `id`
- `policy_key`
- `policy_scope` such as `Global`, `Site`, `Area`, `Template`
- `scope_reference`
- `policy_value_json`
- `created_at`
- `updated_at`

## Audit And Reporting Tables
### audit_logs
- `id`
- `actor_user_id`
- `actor_username`
- `action_type`
- `module_name`
- `entity_type`
- `entity_id`
- `description`
- `ip_address`
- `metadata_json`
- `created_at`

Current implementation note:
- `audit_logs` is now the append-only audit baseline for representative communication lifecycle actions.
- The MVP baseline currently records publish acceptance, cancel acceptance, template override rejection, response recording, overdue transitions, and recipient-only follow-up queue actions.

### communication_metrics_daily
Optional derived reporting table for aggregated reporting workloads.

Key columns:
- `id`
- `metric_date`
- `communication_type`
- `priority`
- `channel`
- `sent_count`
- `delivered_count`
- `read_count`
- `responded_count`
- `failed_count`

## Important Relationships
- `users` 1-to-many `user_scopes`
- `sites` 1-to-many `areas`
- `sites` 1-to-many `departments`
- `departments` 1-to-many `sections`
- `areas` 1-to-many `devices`
- `employees` 1-to-many `devices` through optional assignment metadata
- `communication_templates` 1-to-many `communications`
- `communication_templates` 1-to-many version rows by `template_key`
- `communications` 1-to-many `communication_targets`
- `communications` 1-to-many `communication_schedules`
- `communications` 1-to-many `communication_recipients`
- `communications` 1-to-many `agent_reminder_policies` through recurring schedule materialization for `AgentLocalRoutine`
- `communications` many-to-1 `response_workflows`
- `communication_schedules` 1-to-many `agent_reminder_policies`
- `agent_reminder_policies` 1-to-many `agent_reminder_events`
- `communication_recipients` 1-to-many `delivery_jobs`
- `delivery_jobs` 1-to-many `delivery_attempts`
- `delivery_jobs` 1-to-many `delivery_events`
- `delivery_jobs` 1-to-many response evidence rows through `delivery_events` where `event_type = Responded`
- `devices` 1-to-many `device_realtime_connections`
- `agent_release_packages` 1-to-many `agent_rollout_intents`
- `agent_rollout_intents` 1-to-many `agent_rollout_status_events`
- `devices` 1-to-many `agent_rollout_status_events`

## Notes
- Exact physical schema, indexing, and partitioning may evolve during implementation.
- Any backend change affecting the domain or contract must also update `docs/openapi.yaml`.
- Device records should stay operationally flat in MVP even if areas are backed by a simple reference table.
- `Wellness Programs` MVP intentionally reuses the communication aggregate, recurring schedule model, and agent reminder policy sync boundary before any future decision to introduce a standalone relational wellness catalog.
