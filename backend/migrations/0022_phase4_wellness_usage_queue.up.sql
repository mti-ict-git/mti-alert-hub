alter table public.agent_reminder_policy_applications
  drop constraint agent_reminder_policy_applications_state_check;
alter table public.agent_reminder_policy_applications
  add constraint agent_reminder_policy_applications_state_check
  check (state in ('Scheduled','WaitingForSession','WaitingForAuthorization','WaitingForWellnessSlot','Unsupported','NoOccurrence'));
