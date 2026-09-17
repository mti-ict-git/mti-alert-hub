create table public.agent_reminder_policy_applications (
  policy_id uuid primary key references public.agent_reminder_policies(id) on delete cascade,
  schedule_version integer not null,
  protocol_version integer not null check (protocol_version = 1),
  applied_at timestamptz not null,
  reported_at timestamptz not null,
  received_at timestamptz not null default now(),
  state text not null check (state in ('Scheduled','WaitingForSession','WaitingForAuthorization','Unsupported','NoOccurrence')),
  next_run_at timestamptz,
  agent_version text not null
);
