create table if not exists public.agent_release_packages (
  id uuid primary key default gen_random_uuid(),
  version text not null,
  package_type text not null,
  package_url text not null,
  sha256 text not null,
  signature text not null,
  release_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agent_release_packages_package_type_check check (
    package_type in ('MSI')
  ),
  constraint agent_release_packages_version_unique unique (version, package_type)
);

create table if not exists public.agent_rollout_intents (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices(id) on delete cascade,
  release_package_id uuid not null references public.agent_release_packages(id) on delete restrict,
  action text not null,
  rollout_channel text,
  target_version text not null,
  mandatory boolean not null default false,
  deadline_at timestamptz,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agent_rollout_intents_action_check check (
    action in ('Upgrade', 'Repair', 'Uninstall')
  )
);

create table if not exists public.agent_rollout_status_events (
  id uuid primary key default gen_random_uuid(),
  rollout_intent_id uuid not null references public.agent_rollout_intents(id) on delete cascade,
  device_id uuid not null references public.devices(id) on delete cascade,
  state text not null,
  installed_version text,
  target_version text,
  updater_version text,
  startup_registered boolean,
  error_code text,
  error_message text,
  occurred_at timestamptz not null,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint agent_rollout_status_events_state_check check (
    state in (
      'UpdateAvailable',
      'Downloading',
      'Staged',
      'InstallPending',
      'Installing',
      'Succeeded',
      'Failed',
      'UninstallPending',
      'Uninstalling',
      'Uninstalled'
    )
  )
);

create index if not exists agent_rollout_intents_device_id_idx
  on public.agent_rollout_intents(device_id, is_active, created_at desc);

create index if not exists agent_rollout_status_events_rollout_intent_id_idx
  on public.agent_rollout_status_events(rollout_intent_id, occurred_at desc);

create index if not exists agent_rollout_status_events_device_id_idx
  on public.agent_rollout_status_events(device_id, occurred_at desc);

drop trigger if exists agent_release_packages_set_updated_at on public.agent_release_packages;
create trigger agent_release_packages_set_updated_at
before update on public.agent_release_packages
for each row execute function public.set_updated_at();

drop trigger if exists agent_rollout_intents_set_updated_at on public.agent_rollout_intents;
create trigger agent_rollout_intents_set_updated_at
before update on public.agent_rollout_intents
for each row execute function public.set_updated_at();
