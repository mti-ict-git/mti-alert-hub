# MTI Alert Database Schema Specification

## Document Status
- Version: `0.3`
- Status: `Draft Baseline`
- Last Updated: `2026-07-07`

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
- `content_payload_json`
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
- `windows_agent_presentation`
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
- `event_type` such as `Triggered`, `Displayed`, `Read`, `Dismissed`, `Snoozed`, `Responded`
- `occurred_at`
- `reported_at`
- `active_user_identifier` nullable
- `metadata_json` nullable
- `created_at`

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

### response_workflow_options
- `id`
- `workflow_id`
- `option_key`
- `option_label`
- `sort_order`
- `is_terminal`

### recipient_responses
Stores actual recipient responses.

Key columns:
- `id`
- `communication_recipient_id`
- `device_id`
- `actor_user_identifier` nullable
- `channel`
- `response_option_key`
- `response_note`
- `responded_at`
- `created_at`

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
- `action_type`
- `module_name`
- `entity_type`
- `entity_id`
- `description`
- `ip_address`
- `created_at`

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
- `communications` 1-to-many `communication_recipients`
- `communications` many-to-1 `response_workflows`
- `communication_recipients` 1-to-many `delivery_jobs`
- `delivery_jobs` 1-to-many `delivery_attempts`
- `delivery_jobs` 1-to-many `delivery_events`
- `communication_recipients` 1-to-many `recipient_responses`
- `devices` 1-to-many `device_realtime_connections`

## Notes
- Exact physical schema, indexing, and partitioning may evolve during implementation.
- Any backend change affecting the domain or contract must also update `docs/openapi.yaml`.
- Device records should stay operationally flat in MVP even if areas are backed by a simple reference table.
