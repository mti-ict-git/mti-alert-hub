create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id text,
  actor_username text,
  action_type text not null,
  module_name text not null,
  entity_type text not null,
  entity_id text,
  description text not null,
  ip_address text,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_created_at_idx
  on public.audit_logs(created_at desc);

create index if not exists audit_logs_module_created_at_idx
  on public.audit_logs(module_name, created_at desc);

create index if not exists audit_logs_entity_idx
  on public.audit_logs(entity_type, entity_id, created_at desc);
