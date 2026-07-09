import type { DatabaseClient, TransactionClient } from "../../../infrastructure/db/connection.js";

type OverdueCandidateRow = {
  deliveryJobId: string;
  communicationRecipientId: string;
  attemptCount: number;
  timeoutMinutes: number;
};

export class ResponseOverdueService {
  constructor(private readonly database: DatabaseClient) {}

  async evaluateRecipientOnlyOverdueForDevice(deviceId: string) {
    const candidates = await this.database.query<OverdueCandidateRow>(
      `
        select
          dj.id::text as "deliveryJobId",
          cr.id::text as "communicationRecipientId",
          dj.attempt_count as "attemptCount",
          (cr.workflow_snapshot_json ->> 'escalationTimeoutMinutes')::int as "timeoutMinutes"
        from public.delivery_jobs dj
        inner join public.communication_recipients cr
          on cr.id = dj.communication_recipient_id
        where dj.channel = 'WindowsAgent'
          and cr.device_id = $1::uuid
          and cr.response_state = 'AwaitingResponse'
          and cr.follow_up_triggered_at is null
          and coalesce(cr.workflow_snapshot_json ->> 'escalationMode', '') = 'RecipientOnly'
          and nullif(cr.workflow_snapshot_json ->> 'escalationTimeoutMinutes', '') is not null
          and cr.created_at <= now() - make_interval(
            mins => (cr.workflow_snapshot_json ->> 'escalationTimeoutMinutes')::int
          )
      `,
      [deviceId],
    );

    for (const candidate of candidates) {
      const occurredAt = new Date().toISOString();
      await this.database.withTransaction(async (transaction) => {
        await markRecipientOverdue(transaction, candidate.communicationRecipientId, occurredAt);
        await insertOverdueEvent(transaction, candidate.deliveryJobId, occurredAt, candidate.timeoutMinutes);
        await requeueRecipientOnlyFollowUp(
          transaction,
          candidate.deliveryJobId,
          candidate.attemptCount + 1,
          occurredAt,
          candidate.timeoutMinutes,
        );
      });
    }

    return candidates.map((candidate) => candidate.deliveryJobId);
  }
}

async function markRecipientOverdue(
  transaction: TransactionClient,
  communicationRecipientId: string,
  occurredAt: string,
) {
  await transaction.query(
    `
      update public.communication_recipients
      set
        response_state = 'Overdue',
        follow_up_triggered_at = $2::timestamptz
      where id::text = $1
        and response_state = 'AwaitingResponse'
        and follow_up_triggered_at is null
    `,
    [communicationRecipientId, occurredAt],
  );
}

async function insertOverdueEvent(
  transaction: TransactionClient,
  deliveryJobId: string,
  occurredAt: string,
  timeoutMinutes: number,
) {
  await transaction.query(
    `
      insert into public.delivery_events (
        delivery_job_id,
        event_type,
        event_source,
        event_payload_json,
        occurred_at
      )
      values (
        $1::uuid,
        'Overdue',
        'System',
        $2::jsonb,
        $3::timestamptz
      )
    `,
    [
      deliveryJobId,
      JSON.stringify({
        reason: "ResponseTimeoutExceeded",
        escalationMode: "RecipientOnly",
        escalationTimeoutMinutes: timeoutMinutes,
      }),
      occurredAt,
    ],
  );
}

async function requeueRecipientOnlyFollowUp(
  transaction: TransactionClient,
  deliveryJobId: string,
  attemptNumber: number,
  occurredAt: string,
  timeoutMinutes: number,
) {
  await transaction.query(
    `
      update public.delivery_jobs
      set
        job_status = 'Pending',
        attempt_count = $2,
        queued_at = $3::timestamptz,
        completed_at = null,
        next_retry_at = null,
        last_error_message = null
      where id::text = $1
    `,
    [deliveryJobId, attemptNumber, occurredAt],
  );

  await transaction.query(
    `
      insert into public.delivery_attempts (
        delivery_job_id,
        attempt_number,
        attempt_status,
        attempted_at,
        response_payload_json
      )
      values (
        $1::uuid,
        $2,
        'Pending',
        $3::timestamptz,
        $4::jsonb
      )
    `,
    [
      deliveryJobId,
      attemptNumber,
      occurredAt,
      JSON.stringify({
        reason: "RecipientOnlyFollowUp",
        escalationMode: "RecipientOnly",
        escalationTimeoutMinutes: timeoutMinutes,
      }),
    ],
  );

  await transaction.query(
    `
      insert into public.delivery_events (
        delivery_job_id,
        event_type,
        event_source,
        event_payload_json,
        occurred_at
      )
      values (
        $1::uuid,
        'Queued',
        'System',
        $2::jsonb,
        $3::timestamptz
      )
    `,
    [
      deliveryJobId,
      JSON.stringify({
        reason: "RecipientOnlyFollowUp",
        escalationMode: "RecipientOnly",
        escalationTimeoutMinutes: timeoutMinutes,
        attemptNumber,
      }),
      occurredAt,
    ],
  );
}
