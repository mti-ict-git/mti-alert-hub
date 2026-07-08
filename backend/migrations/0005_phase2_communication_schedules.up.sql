create table if not exists public.communication_schedules (
  id uuid primary key default gen_random_uuid(),
  communication_id uuid not null references public.communications(id) on delete cascade,
  schedule_type text not null,
  scheduled_at timestamptz,
  recurrence_rule text,
  timezone text,
  execution_mode text,
  schedule_version integer not null default 1,
  valid_from timestamptz,
  valid_until timestamptz,
  is_active boolean not null default true,
  publish_request_json jsonb not null default '{}'::jsonb,
  requested_by_user_identifier text,
  requested_by_username text,
  requested_at timestamptz not null default now(),
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint communication_schedules_type_check check (
    schedule_type in ('Immediate', 'Scheduled', 'Recurring')
  ),
  constraint communication_schedules_execution_mode_check check (
    execution_mode is null
    or execution_mode in ('ServerGenerated', 'AgentLocalRoutine')
  ),
  constraint communication_schedules_immediate_fields_check check (
    schedule_type <> 'Immediate'
    or (recurrence_rule is null and execution_mode is null)
  ),
  constraint communication_schedules_scheduled_fields_check check (
    schedule_type <> 'Scheduled'
    or (scheduled_at is not null and recurrence_rule is null and execution_mode is null)
  ),
  constraint communication_schedules_recurring_fields_check check (
    schedule_type <> 'Recurring'
    or (recurrence_rule is not null and timezone is not null and execution_mode is not null)
  )
);

create unique index if not exists communication_schedules_active_per_communication_idx
  on public.communication_schedules(communication_id)
  where is_active = true;

create index if not exists communication_schedules_communication_id_idx
  on public.communication_schedules(communication_id, created_at desc);

create index if not exists communication_schedules_schedule_type_idx
  on public.communication_schedules(schedule_type, is_active);

drop trigger if exists communication_schedules_set_updated_at on public.communication_schedules;
create trigger communication_schedules_set_updated_at
before update on public.communication_schedules
for each row
execute function public.set_updated_at();
