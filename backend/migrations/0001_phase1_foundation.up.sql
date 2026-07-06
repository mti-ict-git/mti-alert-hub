create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  full_name text not null,
  email text,
  status text not null default 'Active',
  role_type text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_role_type_check check (
    role_type in ('CentralAdmin', 'LocalOperator', 'ManagementViewer')
  )
);

create table if not exists public.user_scopes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  scope_type text not null,
  scope_value text not null,
  created_at timestamptz not null default now(),
  constraint user_scopes_scope_type_check check (
    scope_type in ('Global', 'Site', 'Area', 'Department', 'Section')
  ),
  constraint user_scopes_unique_scope unique (user_id, scope_type, scope_value)
);

create table if not exists public.sites (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  status text not null default 'Active',
  source_system text,
  external_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.areas (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete restrict,
  code text,
  name text not null,
  status text not null default 'Active',
  source_system text,
  external_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint areas_unique_name_per_site unique (site_id, name)
);

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references public.sites(id) on delete restrict,
  code text,
  name text not null,
  status text not null default 'Active',
  source_system text,
  external_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint departments_unique_name_per_site unique (site_id, name)
);

create table if not exists public.sections (
  id uuid primary key default gen_random_uuid(),
  department_id uuid references public.departments(id) on delete restrict,
  code text,
  name text not null,
  status text not null default 'Active',
  source_system text,
  external_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sections_unique_name_per_department unique (department_id, name)
);

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  employee_number text not null unique,
  full_name text not null,
  email text,
  phone_number text,
  site_id uuid references public.sites(id) on delete set null,
  area_id uuid references public.areas(id) on delete set null,
  department_id uuid references public.departments(id) on delete set null,
  section_id uuid references public.sections(id) on delete set null,
  job_role text,
  employment_status text not null default 'Active',
  has_windows_agent boolean not null default false,
  has_whatsapp boolean not null default false,
  preferred_primary_channel text,
  preferred_secondary_channel text,
  source_system text,
  external_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employees_preferred_primary_channel_check check (
    preferred_primary_channel is null
    or preferred_primary_channel in ('WindowsAgent', 'WhatsApp', 'Email', 'DigitalSignage')
  ),
  constraint employees_preferred_secondary_channel_check check (
    preferred_secondary_channel is null
    or preferred_secondary_channel in ('WindowsAgent', 'WhatsApp', 'Email', 'DigitalSignage')
  )
);

create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  primary_employee_id uuid references public.employees(id) on delete set null,
  device_identifier text,
  hostname text not null unique,
  site_id uuid not null references public.sites(id) on delete restrict,
  area_id uuid references public.areas(id) on delete set null,
  location_label text,
  ownership_mode text not null,
  agent_version text,
  os_version text,
  last_heartbeat_at timestamptz,
  last_connection_at timestamptz,
  status text not null default 'Offline',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint devices_ownership_mode_check check (
    ownership_mode in ('LocationOwned', 'EmployeeAssigned', 'Mixed')
  ),
  constraint devices_status_check check (
    status in ('Online', 'Offline', 'Stale')
  )
);

create index if not exists user_scopes_user_id_idx on public.user_scopes(user_id);
create index if not exists user_scopes_scope_lookup_idx on public.user_scopes(scope_type, scope_value);

create index if not exists areas_site_id_idx on public.areas(site_id);
create index if not exists departments_site_id_idx on public.departments(site_id);
create index if not exists sections_department_id_idx on public.sections(department_id);

create index if not exists employees_site_id_idx on public.employees(site_id);
create index if not exists employees_area_id_idx on public.employees(area_id);
create index if not exists employees_department_id_idx on public.employees(department_id);
create index if not exists employees_section_id_idx on public.employees(section_id);
create index if not exists employees_source_reference_idx on public.employees(source_system, external_reference);

create index if not exists devices_site_id_idx on public.devices(site_id);
create index if not exists devices_area_id_idx on public.devices(area_id);
create index if not exists devices_status_idx on public.devices(status);
create index if not exists devices_device_identifier_idx on public.devices(device_identifier);

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at
before update on public.users
for each row
execute function public.set_updated_at();

drop trigger if exists sites_set_updated_at on public.sites;
create trigger sites_set_updated_at
before update on public.sites
for each row
execute function public.set_updated_at();

drop trigger if exists areas_set_updated_at on public.areas;
create trigger areas_set_updated_at
before update on public.areas
for each row
execute function public.set_updated_at();

drop trigger if exists departments_set_updated_at on public.departments;
create trigger departments_set_updated_at
before update on public.departments
for each row
execute function public.set_updated_at();

drop trigger if exists sections_set_updated_at on public.sections;
create trigger sections_set_updated_at
before update on public.sections
for each row
execute function public.set_updated_at();

drop trigger if exists employees_set_updated_at on public.employees;
create trigger employees_set_updated_at
before update on public.employees
for each row
execute function public.set_updated_at();

drop trigger if exists devices_set_updated_at on public.devices;
create trigger devices_set_updated_at
before update on public.devices
for each row
execute function public.set_updated_at();
