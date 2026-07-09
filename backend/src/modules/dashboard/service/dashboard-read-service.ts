import type { DatabaseClient } from "../../../infrastructure/db/connection.js";

type DashboardOverviewRow = {
  activeCommunications: number;
  recipientsPending: number;
  deliveredCount: number;
  respondedCount: number;
  failedCount: number;
  overdueResponses: number;
};

type CommunicationType =
  | "Alert"
  | "Reminder"
  | "OperationalNotice"
  | "News"
  | "Article"
  | "KnowledgeUpdate";

type DashboardContentTypeRollupRow = {
  communicationType: CommunicationType;
  communicationCount: number;
  activeCommunications: number;
  recipientCount: number;
  deliveredCount: number;
  readCount: number;
  respondedCount: number;
  failedCount: number;
  pendingResponseCount: number;
  overdueResponses: number;
};

export class DashboardReadService {
  constructor(private readonly database: DatabaseClient) {}

  async getOverview() {
    const rows = await this.database.query<DashboardOverviewRow>(
      `
        with active_communications as (
          select count(*)::int as count
          from public.communications
          where status in ('Scheduled', 'Queued', 'Sending', 'Active')
        ),
        pending_recipients as (
          select count(*)::int as count
          from public.communication_recipients cr
          inner join public.communications c
            on c.id = cr.communication_id
          where c.status in ('Scheduled', 'Queued', 'Sending', 'Active')
            and (
              cr.ack_state = 'Pending'
              or cr.response_state in ('AwaitingResponse', 'Overdue')
            )
        ),
        delivered_jobs as (
          select count(*)::int as count
          from public.delivery_jobs
          where job_status in ('Delivered', 'Displayed', 'Read', 'Responded')
        ),
        responded_recipients as (
          select count(distinct dj.communication_recipient_id)::int as count
          from public.delivery_jobs dj
          where dj.job_status = 'Responded'
        ),
        failed_jobs as (
          select count(*)::int as count
          from public.delivery_jobs
          where job_status = 'Failed'
        ),
        overdue_response_recipients as (
          select count(*)::int as count
          from public.communication_recipients cr
          inner join public.communications c
            on c.id = cr.communication_id
          inner join public.response_workflows rw
            on rw.id = c.workflow_id
          where c.status in ('Queued', 'Sending', 'Active')
            and cr.response_state in ('AwaitingResponse', 'Overdue')
            and rw.escalation_timeout_minutes is not null
            and cr.created_at <= now() - make_interval(mins => rw.escalation_timeout_minutes)
        )
        select
          (select count from active_communications) as "activeCommunications",
          (select count from pending_recipients) as "recipientsPending",
          (select count from delivered_jobs) as "deliveredCount",
          (select count from responded_recipients) as "respondedCount",
          (select count from failed_jobs) as "failedCount",
          (select count from overdue_response_recipients) as "overdueResponses"
      `,
    );

    return (
      rows[0] ?? {
        activeCommunications: 0,
        recipientsPending: 0,
        deliveredCount: 0,
        respondedCount: 0,
        failedCount: 0,
        overdueResponses: 0,
      }
    );
  }

  async getContentTypeRollups() {
    return this.database.query<DashboardContentTypeRollupRow>(
      `
        with communication_types as (
          select *
          from (
            values
              ('Alert'),
              ('Reminder'),
              ('OperationalNotice'),
              ('News'),
              ('Article'),
              ('KnowledgeUpdate')
          ) as types(communication_type)
        ),
        communication_rollups as (
          select
            c.communication_type::text as communication_type,
            count(distinct c.id)::int as communication_count,
            count(distinct c.id) filter (
              where c.status in ('Scheduled', 'Queued', 'Sending', 'Active')
            )::int as active_communications
          from public.communications c
          group by c.communication_type
        ),
        recipient_rollups as (
          select
            c.communication_type::text as communication_type,
            count(distinct cr.id)::int as recipient_count,
            count(distinct cr.id) filter (
              where cr.response_state in ('AwaitingResponse', 'Overdue')
            )::int as pending_response_count,
            count(distinct cr.id) filter (
              where cr.response_state = 'Responded'
            )::int as responded_count,
            count(distinct cr.id) filter (
              where cr.response_state in ('AwaitingResponse', 'Overdue')
                and rw.escalation_timeout_minutes is not null
                and cr.created_at <= now() - make_interval(mins => rw.escalation_timeout_minutes)
            )::int as overdue_responses
          from public.communications c
          left join public.communication_recipients cr
            on cr.communication_id = c.id
          left join public.response_workflows rw
            on rw.id = c.workflow_id
          group by c.communication_type
        ),
        delivery_rollups as (
          select
            c.communication_type::text as communication_type,
            count(dj.id) filter (
              where dj.job_status in ('Delivered', 'Displayed', 'Read', 'Responded')
            )::int as delivered_count,
            count(dj.id) filter (
              where dj.job_status in ('Read', 'Responded')
            )::int as read_count,
            count(dj.id) filter (
              where dj.job_status = 'Failed'
            )::int as failed_count
          from public.communications c
          left join public.communication_recipients cr
            on cr.communication_id = c.id
          left join public.delivery_jobs dj
            on dj.communication_recipient_id = cr.id
          group by c.communication_type
        )
        select
          ct.communication_type::text as "communicationType",
          coalesce(cr.communication_count, 0)::int as "communicationCount",
          coalesce(cr.active_communications, 0)::int as "activeCommunications",
          coalesce(rr.recipient_count, 0)::int as "recipientCount",
          coalesce(dr.delivered_count, 0)::int as "deliveredCount",
          coalesce(dr.read_count, 0)::int as "readCount",
          coalesce(rr.responded_count, 0)::int as "respondedCount",
          coalesce(dr.failed_count, 0)::int as "failedCount",
          coalesce(rr.pending_response_count, 0)::int as "pendingResponseCount",
          coalesce(rr.overdue_responses, 0)::int as "overdueResponses"
        from communication_types ct
        left join communication_rollups cr
          on cr.communication_type = ct.communication_type
        left join recipient_rollups rr
          on rr.communication_type = ct.communication_type
        left join delivery_rollups dr
          on dr.communication_type = ct.communication_type
        order by array_position(
          array[
            'Alert',
            'Reminder',
            'OperationalNotice',
            'News',
            'Article',
            'KnowledgeUpdate'
          ]::text[],
          ct.communication_type
        )
      `,
    );
  }
}
