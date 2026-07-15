create table if not exists public.response_workflows (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  workflow_type text not null default 'TemplateSelected',
  allow_free_text boolean not null default false,
  require_free_text boolean not null default false,
  escalation_timeout_minutes integer,
  escalation_mode text,
  response_implies_ack boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint response_workflows_escalation_mode_check check (
    escalation_mode is null or escalation_mode in ('RecipientOnly')
  )
);

create table if not exists public.response_workflow_options (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.response_workflows(id) on delete cascade,
  option_key text not null,
  option_label text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint response_workflow_options_unique_key unique (workflow_id, option_key)
);

create table if not exists public.communication_templates (
  id uuid primary key default gen_random_uuid(),
  version integer not null default 1,
  template_key text not null unique,
  name text not null,
  communication_type text not null,
  default_priority text not null,
  default_title text,
  default_body text,
  default_channel_strategy text,
  mandatory_channels_json jsonb not null default '[]'::jsonb,
  optional_channels_json jsonb not null default '[]'::jsonb,
  default_windows_agent_presentation text,
  critical_behavior_mode text,
  default_requires_response boolean not null default false,
  workflow_id uuid references public.response_workflows(id) on delete set null,
  allowed_target_types_json jsonb not null default '[]'::jsonb,
  locked_fields_json jsonb not null default '[]'::jsonb,
  editable_fields_json jsonb not null default '[]'::jsonb,
  dual_path_rule_json jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint communication_templates_type_check check (
    communication_type in ('Alert', 'Reminder', 'OperationalNotice', 'News', 'Article', 'KnowledgeUpdate')
  ),
  constraint communication_templates_priority_check check (
    default_priority in ('Info', 'Warning', 'Critical')
  ),
  constraint communication_templates_strategy_check check (
    default_channel_strategy is null
    or default_channel_strategy in ('UserPreference', 'MultiSend', 'PrimaryFallback', 'TemplatePolicy')
  ),
  constraint communication_templates_windows_presentation_check check (
    default_windows_agent_presentation is null
    or default_windows_agent_presentation in ('Toast', 'Modal', 'Fullscreen')
  ),
  constraint communication_templates_critical_behavior_check check (
    critical_behavior_mode is null
    or critical_behavior_mode in ('ModalThenStronger', 'FixedModal', 'FullscreenImmediate')
  )
);

create table if not exists public.communications (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references public.communication_templates(id) on delete set null,
  template_version integer,
  communication_type text not null,
  priority text not null,
  category text,
  title text not null,
  body text not null,
  channel_selections_json jsonb not null default '[]'::jsonb,
  status text not null default 'Draft',
  requires_response boolean not null default false,
  workflow_id uuid references public.response_workflows(id) on delete set null,
  windows_agent_presentation text,
  toast_auto_dismiss_seconds integer,
  delivery_strategy text,
  created_by_user_id uuid references public.users(id) on delete set null,
  published_at timestamptz,
  scheduled_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint communications_type_check check (
    communication_type in ('Alert', 'Reminder', 'OperationalNotice', 'News', 'Article', 'KnowledgeUpdate')
  ),
  constraint communications_priority_check check (
    priority in ('Info', 'Warning', 'Critical')
  ),
  constraint communications_status_check check (
    status in ('Draft', 'Scheduled', 'Queued', 'Sending', 'Active', 'Completed', 'Cancelled', 'Failed')
  ),
  constraint communications_windows_presentation_check check (
    windows_agent_presentation is null
    or windows_agent_presentation in ('Toast', 'Modal', 'Fullscreen')
  ),
  constraint communications_strategy_check check (
    delivery_strategy is null
    or delivery_strategy in ('UserPreference', 'MultiSend', 'PrimaryFallback', 'TemplatePolicy')
  ),
  constraint communications_toast_auto_dismiss_seconds_check check (
    toast_auto_dismiss_seconds is null
    or toast_auto_dismiss_seconds between 1 and 60
  )
);

create table if not exists public.communication_targets (
  id uuid primary key default gen_random_uuid(),
  communication_id uuid not null references public.communications(id) on delete cascade,
  target_type text not null,
  target_value text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint communication_targets_type_check check (
    target_type in ('All', 'Site', 'Area', 'Department', 'Section', 'Role', 'Employee', 'Group', 'Device')
  )
);

create index if not exists response_workflow_options_workflow_id_idx
  on public.response_workflow_options(workflow_id, sort_order, option_key);
create index if not exists communication_templates_active_idx
  on public.communication_templates(is_active, communication_type);
create index if not exists communications_status_idx
  on public.communications(status);
create index if not exists communications_created_by_user_id_idx
  on public.communications(created_by_user_id);
create index if not exists communications_template_id_idx
  on public.communications(template_id);
create index if not exists communications_workflow_id_idx
  on public.communications(workflow_id);
create index if not exists communication_targets_communication_id_idx
  on public.communication_targets(communication_id, sort_order);

drop trigger if exists response_workflows_set_updated_at on public.response_workflows;
create trigger response_workflows_set_updated_at
before update on public.response_workflows
for each row
execute function public.set_updated_at();

drop trigger if exists communication_templates_set_updated_at on public.communication_templates;
create trigger communication_templates_set_updated_at
before update on public.communication_templates
for each row
execute function public.set_updated_at();

drop trigger if exists communications_set_updated_at on public.communications;
create trigger communications_set_updated_at
before update on public.communications
for each row
execute function public.set_updated_at();

insert into public.response_workflows (
  id,
  name,
  description,
  workflow_type,
  allow_free_text,
  require_free_text,
  escalation_timeout_minutes,
  escalation_mode,
  response_implies_ack
)
values
  (
    '11111111-1111-1111-1111-111111111111',
    'Critical Acknowledgement',
    'Baseline critical workflow for alert acknowledgement and assistance requests.',
    'TemplateSelected',
    false,
    false,
    15,
    'RecipientOnly',
    true
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'Reminder Confirmation',
    'Simple reminder confirmation workflow.',
    'TemplateSelected',
    false,
    false,
    null,
    'RecipientOnly',
    true
  )
on conflict (id) do nothing;

insert into public.response_workflow_options (
  id,
  workflow_id,
  option_key,
  option_label,
  sort_order
)
values
  ('11111111-aaaa-1111-aaaa-111111111111', '11111111-1111-1111-1111-111111111111', 'safe', 'Safe', 1),
  ('11111111-bbbb-1111-bbbb-111111111111', '11111111-1111-1111-1111-111111111111', 'assist', 'Need Assistance', 2),
  ('11111111-cccc-1111-cccc-111111111111', '11111111-1111-1111-1111-111111111111', 'away', 'Not In Area', 3),
  ('22222222-aaaa-2222-aaaa-222222222222', '22222222-2222-2222-2222-222222222222', 'done', 'Acknowledged', 1)
on conflict (id) do nothing;

insert into public.communication_templates (
  id,
  version,
  template_key,
  name,
  communication_type,
  default_priority,
  default_title,
  default_body,
  default_channel_strategy,
  mandatory_channels_json,
  optional_channels_json,
  default_windows_agent_presentation,
  critical_behavior_mode,
  default_requires_response,
  workflow_id,
  allowed_target_types_json,
  locked_fields_json,
  editable_fields_json,
  dual_path_rule_json,
  is_active
)
values
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    1,
    'critical-evacuation',
    'Critical Evacuation Alert',
    'Alert',
    'Critical',
    'Immediate evacuation required',
    'An operational hazard has been reported. Evacuate immediately and await instructions.',
    'TemplatePolicy',
    '["WindowsAgent"]'::jsonb,
    '["WhatsApp"]'::jsonb,
    'Modal',
    'ModalThenStronger',
    true,
    '11111111-1111-1111-1111-111111111111',
    '["Site","Area","Device"]'::jsonb,
    '["priority","workflowId","channelSelections","deliveryStrategy","windowsAgentPresentation"]'::jsonb,
    '["title","body","targets"]'::jsonb,
    '{"enabled": true, "mode": "DesktopFirstShortDelayWhatsApp", "delaySeconds": 60}'::jsonb,
    true
  ),
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    1,
    'operations-reminder',
    'Operations Reminder',
    'Reminder',
    'Warning',
    'Operational reminder',
    'Please review the pending operational reminder and confirm completion.',
    'TemplatePolicy',
    '["WindowsAgent"]'::jsonb,
    '["WhatsApp"]'::jsonb,
    'Toast',
    null,
    false,
    '22222222-2222-2222-2222-222222222222',
    '["All","Site","Area","Department","Section","Employee","Group","Device"]'::jsonb,
    '["deliveryStrategy"]'::jsonb,
    '["title","body","targets","channelSelections"]'::jsonb,
    null,
    true
  )
on conflict (id) do nothing;
