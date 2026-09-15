alter table public.communications add column if not exists toast_renderer text not null default 'Auto' check (toast_renderer in ('Auto','Native','Custom'));
alter table public.agent_reminder_policies add column if not exists toast_renderer text not null default 'Auto' check (toast_renderer in ('Auto','Native','Custom'));
