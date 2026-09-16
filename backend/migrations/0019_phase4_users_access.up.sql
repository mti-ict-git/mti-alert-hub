-- Additive foundation only. No identity is promoted and no legacy session is cut over.
alter table public.users
  add column directory_id text,
  add column directory_subject_id uuid,
  add column authorization_version integer not null default 1,
  add column revision integer not null default 1,
  add column last_login_at timestamptz,
  add column assignment_source text not null default 'Manual';
alter table public.users alter column role_type drop not null;
alter table public.users drop constraint users_role_type_check;
alter table public.users add constraint users_role_type_check check (
 role_type in ('CentralAdmin','LocalOperator','ManagementViewer','ITOperator','CommunicationOperator','EmergencyOfficer')
);
alter table public.users add constraint users_pending_role_check check (role_type is not null or status='Pending');
alter table public.users add constraint users_directory_pair_check check (
 (directory_id is null and directory_subject_id is null) or
 (directory_id is not null and directory_subject_id is not null)
);
create unique index users_directory_identity on public.users(directory_id,directory_subject_id)
 where directory_subject_id is not null;
create table public.admin_sessions (
 token_digest text primary key,
 user_id uuid not null references public.users(id),
 authorization_version integer not null,
 expires_at timestamptz not null,
 revoked_at timestamptz,
 created_at timestamptz not null default now()
);
create index admin_sessions_user on public.admin_sessions(user_id);
create index admin_sessions_expiry on public.admin_sessions(expires_at);
create table public.access_idempotency (
 actor_id uuid not null references public.users(id),
 operation text not null,
 key text not null,
 request_hash text not null,
 result_json jsonb not null,
 expires_at timestamptz not null,
 primary key(actor_id,operation,key)
);
