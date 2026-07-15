alter table public.communications
  add column if not exists draft_schedule_json jsonb;
