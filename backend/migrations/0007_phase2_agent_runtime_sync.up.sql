create table if not exists public.device_realtime_connections (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices(id) on delete cascade,
  connection_identifier text not null unique,
  connected_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  disconnected_at timestamptz,
  status text not null default 'Connected',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint device_realtime_connections_status_check check (
    status in ('Connected', 'Disconnected', 'Expired')
  )
);

create table if not exists public.agent_reminder_policies (
  id uuid primary key default gen_random_uuid(),
  communication_schedule_id uuid not null references public.communication_schedules(id) on delete cascade,
  communication_id uuid not null references public.communications(id) on delete cascade,
  device_id uuid not null references public.devices(id) on delete cascade,
  schedule_version integer not null default 1,
  recurrence_rule text not null,
  timezone text not null,
  title_snapshot text not null,
  body_snapshot text not null,
  windows_agent_presentation text,
  valid_from timestamptz,
  valid_until timestamptz,
  is_active boolean not null default true,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agent_reminder_policies_schedule_device_unique unique (
    communication_schedule_id,
    device_id
  ),
  constraint agent_reminder_policies_presentation_check check (
    windows_agent_presentation is null
    or windows_agent_presentation in ('Toast', 'Modal', 'Fullscreen')
  )
);

create table if not exists public.agent_reminder_events (
  id uuid primary key default gen_random_uuid(),
  agent_reminder_policy_id uuid not null references public.agent_reminder_policies(id) on delete cascade,
  device_id uuid not null references public.devices(id) on delete cascade,
  event_type text not null,
  occurred_at timestamptz not null,
  reported_at timestamptz not null default now(),
  active_user_identifier text,
  metadata_json jsonb,
  created_at timestamptz not null default now(),
  constraint agent_reminder_events_type_check check (
    event_type in ('Triggered', 'Displayed', 'Read', 'Dismissed', 'Snoozed', 'Responded')
  ),
  constraint agent_reminder_events_unique_occurrence unique (
    agent_reminder_policy_id,
    device_id,
    event_type,
    occurred_at
  )
);

create index if not exists device_realtime_connections_device_id_idx
  on public.device_realtime_connections(device_id, status, last_seen_at desc);

create index if not exists agent_reminder_policies_device_id_idx
  on public.agent_reminder_policies(device_id, is_active, updated_at desc);

create index if not exists agent_reminder_policies_communication_id_idx
  on public.agent_reminder_policies(communication_id, is_active);

create index if not exists agent_reminder_events_policy_id_idx
  on public.agent_reminder_events(agent_reminder_policy_id, occurred_at desc);

drop trigger if exists device_realtime_connections_set_updated_at on public.device_realtime_connections;
create trigger device_realtime_connections_set_updated_at
before update on public.device_realtime_connections
for each row
execute function public.set_updated_at();

drop trigger if exists agent_reminder_policies_set_updated_at on public.agent_reminder_policies;
create trigger agent_reminder_policies_set_updated_at
before update on public.agent_reminder_policies
for each row
execute function public.set_updated_at();
