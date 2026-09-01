create table if not exists public.device_enrollment_requests (
  id uuid primary key default gen_random_uuid(),
  device_identifier text not null,
  hostname text not null,
  agent_version text,
  employee_number text,
  active_user_identifier text,
  request_status text not null default 'Pending',
  request_count integer not null default 1,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by_user_id text,
  decided_by_username text,
  decision_reason text,
  approved_device_id uuid references public.devices(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint device_enrollment_requests_status_check check (
    request_status in ('Pending', 'Approved', 'Rejected')
  ),
  constraint device_enrollment_requests_request_count_check check (
    request_count >= 1
  )
);

create unique index if not exists device_enrollment_requests_hostname_lower_uk
  on public.device_enrollment_requests(lower(hostname));

create index if not exists device_enrollment_requests_status_idx
  on public.device_enrollment_requests(request_status);

create index if not exists device_enrollment_requests_last_seen_at_idx
  on public.device_enrollment_requests(last_seen_at desc);

create index if not exists device_enrollment_requests_device_identifier_idx
  on public.device_enrollment_requests(device_identifier);

drop trigger if exists device_enrollment_requests_set_updated_at on public.device_enrollment_requests;
create trigger device_enrollment_requests_set_updated_at
before update on public.device_enrollment_requests
for each row
execute function public.set_updated_at();
