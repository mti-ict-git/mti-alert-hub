alter table public.communications
  add column if not exists instruction text;

alter table public.agent_reminder_policies
  add column if not exists instruction_snapshot text;
