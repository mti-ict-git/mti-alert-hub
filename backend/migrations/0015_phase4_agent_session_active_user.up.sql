alter table public.device_sessions
  add column if not exists active_user_identifier text;

create index if not exists device_sessions_device_active_user_idx
  on public.device_sessions(device_id, active_user_identifier);
