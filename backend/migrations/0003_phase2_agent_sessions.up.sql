create table if not exists public.device_sessions (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices(id) on delete cascade,
  session_token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists device_sessions_device_id_idx
  on public.device_sessions(device_id, expires_at desc);

create index if not exists device_sessions_expires_at_idx
  on public.device_sessions(expires_at);
