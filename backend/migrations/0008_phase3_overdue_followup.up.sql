alter table public.communication_recipients
  drop constraint if exists communication_recipients_response_state_check;

alter table public.communication_recipients
  add column if not exists follow_up_triggered_at timestamptz;

alter table public.communication_recipients
  add constraint communication_recipients_response_state_check check (
    response_state in ('NotRequired', 'AwaitingResponse', 'Overdue', 'Responded')
  );

alter table public.delivery_events
  drop constraint if exists delivery_events_type_check;

alter table public.delivery_events
  add constraint delivery_events_type_check check (
    event_type in ('Queued', 'Sent', 'Delivered', 'Displayed', 'Read', 'Overdue', 'Responded', 'Failed')
  );

create index if not exists communication_recipients_overdue_idx
  on public.communication_recipients(response_state, follow_up_triggered_at, created_at);
