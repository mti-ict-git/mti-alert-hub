create table if not exists public.communication_recipients (
  id uuid primary key default gen_random_uuid(),
  communication_id uuid not null references public.communications(id) on delete cascade,
  communication_schedule_id uuid not null references public.communication_schedules(id) on delete cascade,
  recipient_type text not null,
  device_id uuid references public.devices(id) on delete set null,
  employee_id uuid references public.employees(id) on delete set null,
  channel_endpoint text,
  site_id uuid references public.sites(id) on delete set null,
  area_id uuid references public.areas(id) on delete set null,
  site_name_snapshot text,
  area_name_snapshot text,
  department_name_snapshot text,
  section_name_snapshot text,
  recipient_name_snapshot text,
  response_state text not null default 'NotRequired',
  ack_state text not null default 'Pending',
  template_version_snapshot integer,
  workflow_reference_id uuid references public.response_workflows(id) on delete set null,
  workflow_snapshot_json jsonb,
  template_policy_snapshot_json jsonb,
  created_at timestamptz not null default now(),
  constraint communication_recipients_type_check check (
    recipient_type in ('Device', 'Employee', 'ContactEndpoint')
  )
);

create table if not exists public.delivery_jobs (
  id uuid primary key default gen_random_uuid(),
  communication_id uuid not null references public.communications(id) on delete cascade,
  communication_schedule_id uuid not null references public.communication_schedules(id) on delete cascade,
  communication_recipient_id uuid not null references public.communication_recipients(id) on delete cascade,
  channel text not null,
  delivery_strategy text,
  template_policy_snapshot_json jsonb,
  job_status text not null default 'Pending',
  retry_limit integer not null default 3,
  attempt_count integer not null default 0,
  queued_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  next_retry_at timestamptz,
  last_error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint delivery_jobs_channel_check check (
    channel in ('WindowsAgent', 'WhatsApp', 'Email', 'DigitalSignage')
  ),
  constraint delivery_jobs_strategy_check check (
    delivery_strategy is null
    or delivery_strategy in ('UserPreference', 'MultiSend', 'PrimaryFallback', 'TemplatePolicy')
  ),
  constraint delivery_jobs_status_check check (
    job_status in ('Pending', 'Sent', 'Delivered', 'Displayed', 'Read', 'Responded', 'Failed')
  )
);

create table if not exists public.delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  delivery_job_id uuid not null references public.delivery_jobs(id) on delete cascade,
  attempt_number integer not null,
  provider_message_id text,
  attempt_status text not null,
  attempted_at timestamptz not null default now(),
  response_payload_json jsonb,
  created_at timestamptz not null default now(),
  constraint delivery_attempts_status_check check (
    attempt_status in ('Pending', 'Sent', 'Delivered', 'Displayed', 'Read', 'Responded', 'Failed')
  ),
  constraint delivery_attempts_unique_attempt unique (delivery_job_id, attempt_number)
);

create table if not exists public.delivery_events (
  id uuid primary key default gen_random_uuid(),
  delivery_job_id uuid not null references public.delivery_jobs(id) on delete cascade,
  event_type text not null,
  event_source text not null,
  event_payload_json jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint delivery_events_type_check check (
    event_type in ('Queued', 'Sent', 'Delivered', 'Displayed', 'Read', 'Responded', 'Failed')
  ),
  constraint delivery_events_source_check check (
    event_source in ('System', 'AdminApi', 'Agent', 'Provider')
  )
);

create index if not exists communication_recipients_communication_id_idx
  on public.communication_recipients(communication_id, communication_schedule_id);

create index if not exists communication_recipients_employee_id_idx
  on public.communication_recipients(employee_id);

create index if not exists communication_recipients_device_id_idx
  on public.communication_recipients(device_id);

create index if not exists delivery_jobs_communication_id_idx
  on public.delivery_jobs(communication_id, channel, job_status);

create index if not exists delivery_jobs_recipient_id_idx
  on public.delivery_jobs(communication_recipient_id, channel);

create index if not exists delivery_attempts_job_id_idx
  on public.delivery_attempts(delivery_job_id, attempt_number desc);

create index if not exists delivery_events_job_id_idx
  on public.delivery_events(delivery_job_id, occurred_at desc);

drop trigger if exists delivery_jobs_set_updated_at on public.delivery_jobs;
create trigger delivery_jobs_set_updated_at
before update on public.delivery_jobs
for each row
execute function public.set_updated_at();
