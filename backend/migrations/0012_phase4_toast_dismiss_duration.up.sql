alter table public.communications
  add column if not exists toast_auto_dismiss_seconds integer;

alter table public.communications
  drop constraint if exists communications_toast_auto_dismiss_seconds_check;

alter table public.communications
  add constraint communications_toast_auto_dismiss_seconds_check check (
    toast_auto_dismiss_seconds is null
    or toast_auto_dismiss_seconds between 1 and 60
  );

alter table public.agent_reminder_policies
  add column if not exists toast_auto_dismiss_seconds integer;

alter table public.agent_reminder_policies
  drop constraint if exists agent_reminder_policies_toast_auto_dismiss_seconds_check;

alter table public.agent_reminder_policies
  add constraint agent_reminder_policies_toast_auto_dismiss_seconds_check check (
    toast_auto_dismiss_seconds is null
    or toast_auto_dismiss_seconds between 1 and 60
  );
