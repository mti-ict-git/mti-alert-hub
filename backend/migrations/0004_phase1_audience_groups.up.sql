create table if not exists public.audience_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_by_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audience_group_members (
  id uuid primary key default gen_random_uuid(),
  audience_group_id uuid not null references public.audience_groups(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint audience_group_members_unique_member unique (audience_group_id, employee_id)
);

create index if not exists audience_group_members_group_id_idx
  on public.audience_group_members(audience_group_id);

create index if not exists audience_group_members_employee_id_idx
  on public.audience_group_members(employee_id);

drop trigger if exists audience_groups_set_updated_at on public.audience_groups;
create trigger audience_groups_set_updated_at
before update on public.audience_groups
for each row
execute function public.set_updated_at();
