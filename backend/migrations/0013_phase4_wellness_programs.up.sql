alter table public.communications
  add column if not exists wellness_program_json jsonb;

alter table public.agent_reminder_policies
  add column if not exists wellness_program_json jsonb;

alter table public.agent_reminder_events
  drop constraint if exists agent_reminder_events_type_check;

alter table public.agent_reminder_events
  add constraint agent_reminder_events_type_check check (
    event_type in (
      'Triggered',
      'Displayed',
      'Read',
      'Dismissed',
      'Snoozed',
      'Responded',
      'Started',
      'StepAdvanced',
      'Completed',
      'TimedOut'
    )
  );
