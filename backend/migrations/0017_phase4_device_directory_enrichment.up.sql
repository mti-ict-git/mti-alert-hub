alter table public.devices
  add column if not exists last_active_user_identifier text,
  add column if not exists last_directory_user_type text not null default 'Unknown',
  add column if not exists last_directory_username text,
  add column if not exists last_directory_display_name text,
  add column if not exists last_directory_employee_number text,
  add column if not exists last_directory_department text,
  add column if not exists last_directory_title text,
  add column if not exists last_directory_mobile text,
  add column if not exists last_directory_email text,
  add column if not exists last_directory_lookup_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'devices_last_directory_user_type_check'
  ) then
    alter table public.devices
      add constraint devices_last_directory_user_type_check check (
        last_directory_user_type in ('Employee', 'NonEmployee', 'Unknown')
      );
  end if;
end
$$;
