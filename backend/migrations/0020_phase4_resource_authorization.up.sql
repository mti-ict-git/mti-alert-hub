-- Access ownership is explicit. Existing records are retained without inferred owners.
create table if not exists public.communication_access (
  communication_id uuid primary key references public.communications(id) on delete cascade,
  owner_user_id uuid not null references public.users(id),
  scope_grants_json jsonb not null,
  publisher_user_id uuid references public.users(id),
  publisher_authorization_version bigint,
  authorization_state text not null default 'Draft',
  updated_at timestamptz not null default now(),
  constraint communication_access_scope_array check (jsonb_typeof(scope_grants_json) = 'array'),
  constraint communication_access_state check (authorization_state in ('Draft','Authorized','BlockedAuthorization')),
  constraint communication_access_publisher_pair check ((publisher_user_id is null) = (publisher_authorization_version is null))
);
create index if not exists communication_access_owner_idx on public.communication_access(owner_user_id);
alter table public.agent_rollout_intents add column if not exists initiated_by_user_id uuid references public.users(id);
alter table public.agent_rollout_intents add column if not exists initiator_authorization_version bigint;
alter table public.agent_rollout_intents add column if not exists authorization_state text not null default 'BlockedAuthorization';
alter table public.agent_rollout_intents add constraint agent_rollout_intents_authorization_state_check
  check (authorization_state in ('Authorized','BlockedAuthorization'));

create table public.communication_preview_receipts (
 communication_id uuid not null references public.communications(id) on delete cascade,
 user_id uuid not null references public.users(id) on delete cascade,
 authorization_version bigint not null,
 audience_digest text not null,
 previewed_at timestamptz not null default now(),
 primary key(communication_id,user_id)
);
