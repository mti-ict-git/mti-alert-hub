import assert from "node:assert/strict";
import { Client } from "pg";
import { loadEnv } from "../src/app/config/env.js";
import { resolvePostgresConnectionConfig } from "../src/infrastructure/db/postgres-connection-config.js";
import type { DatabaseClient } from "../src/infrastructure/db/connection.js";
import { CommunicationDraftService } from "../src/modules/communications/service/communication-draft-service.js";
import { CommunicationTemplateService } from "../src/modules/communications/service/communication-template-service.js";
import { AudiencePreviewService } from "../src/modules/communications/service/audience-preview-service.js";
import { AuditLogService } from "../src/modules/audit/service/audit-log-service.js";
import { WorkflowDefinitionService } from "../src/modules/workflows/service/workflow-definition-service.js";
import { AgentService } from "../src/modules/agent/service/agent-service.js";

// Uses configured PostgreSQL, but all fixture writes are hidden in a transaction
// and rolled back. Never starts a server or notifies an agent.
const client = new Client(resolvePostgresConnectionConfig(loadEnv()));
await client.connect();
let savepoint = 0;
const db: DatabaseClient = {
  query: async (sql, params) => (await client.query(sql, params)).rows,
  maybeQuery: async (_table, sql, params) => (await client.query(sql, params)).rows,
  tableExists: async () => true,
  ping: async () => {
    await client.query("select 1");
  },
  withTransaction: async (run) => {
    const name = `revision_test_${++savepoint}`;
    await client.query(`savepoint ${name}`);
    try {
      const result = await run(db);
      await client.query(`release savepoint ${name}`);
      return result;
    } catch (error) {
      await client.query(`rollback to savepoint ${name}`);
      throw error;
    }
  },
};
const templates = new CommunicationTemplateService(db);
const service = new CommunicationDraftService(
  db,
  templates,
  new AudiencePreviewService(db, templates),
  {
    notifyPendingMessagesForDevices: async () => {
      throw new Error("Unexpected agent notification");
    },
  } as unknown as AgentService,
  new AuditLogService(db),
  new WorkflowDefinitionService(db),
  ["WindowsAgent"],
);
const actor = { userIdentifier: "revision-test", username: "revision-test" };
try {
  await client.query("begin");
  const [source] = await db.query<{ id: string; wellness: unknown }>(
    "select id::text, wellness_program_json as wellness from public.communications where wellness_program_json is not null limit 1",
  );
  const devices = await db.query<{ id: string }>(
    "select id::text from public.devices order by id limit 2",
  );
  assert.ok(
    source && devices.length === 2,
    "Requires one existing wellness definition and two registered devices",
  );
  const draft = await service.duplicateDraft(source.id);
  const schedule = {
    recurrenceRule: "FREQ=DAILY;INTERVAL=1",
    timezone: "UTC",
    executionMode: "AgentLocalRoutine" as const,
    scheduledAt: null,
    validUntil: null,
  };
  const changes = {
    templateId: null,
    targets: [{ targetType: "Device" as const, targetValue: devices[0].id }],
    reminderSchedule: schedule,
    wellnessProgram: source.wellness as NonNullable<
      Parameters<typeof service.updateDraft>[1]["wellnessProgram"]
    >,
  };
  await service.updateDraft(draft.id, changes);
  await service.publishCommunication(
    draft.id,
    { ...schedule, publishMode: "Recurring", confirmedPreview: true },
    actor,
  );
  const old = await service.getCommunicationReminderActivity(draft.id);
  assert.equal(old.policies.length, 1);
  const assertPolicyOnly = async () => {
    const jobs = await db.query(
      "select id from public.delivery_jobs where communication_id::text=$1",
      [draft.id],
    );
    assert.equal(jobs.length, 0, "Local routine publish/revision must not create delivery jobs");
    const recipients = await db.query(
      "select id from public.communication_recipients where communication_id::text=$1",
      [draft.id],
    );
    assert.ok(recipients.length > 0, "Recipient snapshots must remain available");
  };
  await assertPolicyOnly();
  await db.query(
    "insert into public.agent_reminder_events (agent_reminder_policy_id, device_id, event_type, occurred_at) values ($1::uuid,$2::uuid,'Displayed',now())",
    [old.policies[0].policyId, devices[0].id],
  );
  const both = {
    ...changes,
    targets: devices.map((d) => ({ targetType: "Device" as const, targetValue: d.id })),
    reminderSchedule: {
      ...schedule,
      timezone: "Etc/GMT-8",
      recurrenceRule: "FREQ=HOURLY;INTERVAL=2",
    },
  };
  await service.reviseWellnessProgram(draft.id, both, 1, actor);
  const second = await service.getCommunicationReminderActivity(draft.id);
  const secondDetail = await service.getCommunicationDetail(draft.id);
  await assertPolicyOnly();
  assert.equal(second.policies.filter((p) => p.isActive).length, 2);
  assert.ok(
    second.policies
      .filter((p) => p.isActive)
      .every((p) => p.scheduleVersion === 2 && p.timezone === "Etc/GMT-8"),
  );
  assert.equal(second.events.length, 1);
  assert.equal(
    second.policies.find((p) => p.policyId === old.policies[0].policyId)?.isActive,
    false,
  );
  await assert.rejects(service.reviseWellnessProgram(draft.id, both, 1, actor), {
    code: "WELLNESS_VERSION_CONFLICT",
  });
  await assert.rejects(
    service.reviseWellnessProgram(
      draft.id,
      { ...both, reminderSchedule: { ...schedule, timezone: "bad/timezone" } },
      2,
      actor,
    ),
  );
  await assert.rejects(service.reviseWellnessProgram(draft.id, { ...both, targets: [] }, 2, actor));
  await assert.rejects(
    service.reviseWellnessProgram(
      draft.id,
      {
        ...both,
        targets: [...both.targets, { targetType: "Device", targetValue: "unregistered-device" }],
      },
      2,
      actor,
    ),
    { code: "WELLNESS_DEVICE_NOT_FOUND" },
  );
  assert.deepEqual(
    await service.getCommunicationReminderActivity(draft.id),
    second,
    "Rejected revisions must roll back all policy/event changes",
  );
  assert.deepEqual(
    await service.getCommunicationDetail(draft.id),
    secondDetail,
    "Rejected revisions must also roll back communication fields, targets and schedules",
  );
  await db.query("update public.communications set status='Active' where id::text=$1", [draft.id]);
  await service.reviseWellnessProgram(
    draft.id,
    { ...both, targets: [{ targetType: "Device", targetValue: devices[1].id }] },
    2,
    actor,
  );
  const third = await service.getCommunicationReminderActivity(draft.id);
  await assertPolicyOnly();
  assert.equal(third.policies.filter((p) => p.isActive).length, 1);
  assert.equal(third.policies.find((p) => p.isActive)?.deviceId, devices[1].id);
  assert.equal(third.policies.find((p) => p.isActive)?.scheduleVersion, 3);
  assert.equal(third.events.length, 1);
  const audits = await db.query(
    "select id from public.audit_logs where entity_id::text=$1 and action_type='ReviseWellnessProgram'",
    [draft.id],
  );
  assert.equal(audits.length, 2);

  // Exercise the real pending-message SQL and policy serialization with only
  // session/overdue dependencies isolated; all database writes still roll back.
  const agent = new AgentService(
    db,
    {
      renewSession: async (token: string) =>
        token === "fixture"
          ? { device: { id: devices[1].id }, activeUserIdentifier: null }
          : undefined,
    } as unknown as ConstructorParameters<typeof AgentService>[1],
    new AuditLogService(db),
    { evaluateRecipientOnlyOverdueForDevice: async () => {} } as unknown as ConstructorParameters<
      typeof AgentService
    >[3],
    {} as ConstructorParameters<typeof AgentService>[4],
    {} as ConstructorParameters<typeof AgentService>[5],
    loadEnv(),
    {} as ConstructorParameters<typeof AgentService>[7],
  );
  const synced = await agent.listReminderPolicies("fixture");
  const active = synced.items.filter((p) => p.communicationId === draft.id && p.isActive);
  assert.equal(active.length, 1);
  assert.ok(active[0].wellnessProgram, "Template payload must survive policy sync");
  assert.ok(
    synced.items.some((p) => p.communicationId === draft.id && !p.isActive),
    "Replacement tombstones must still sync",
  );

  // Model a job left by the old publisher, without modifying any real job.
  const [legacy] = await db.query<{ id: string }>(
    `insert into public.delivery_jobs
      (communication_id, communication_schedule_id, communication_recipient_id, channel,
       delivery_strategy, job_status, retry_limit, attempt_count, queued_at)
     select cr.communication_id, cr.communication_schedule_id, cr.id, 'WindowsAgent',
       c.delivery_strategy, 'Pending', 3, 0, now()
     from public.communication_recipients cr
     join public.communications c on c.id=cr.communication_id
     join public.communication_schedules cs on cs.id=cr.communication_schedule_id
     where cr.communication_id::text=$1 and cs.is_active=true
     returning id::text`,
    [draft.id],
  );
  assert.ok(legacy);

  // Normal server-generated and one-time delivery must stay available.
  const ordinary = await service.duplicateDraft(source.id);
  await service.updateDraft(ordinary.id, {
    ...changes,
    wellnessProgram: null,
    targets: [{ targetType: "Device", targetValue: devices[1].id }],
    reminderSchedule: { ...schedule, executionMode: "ServerGenerated" },
  });
  await service.publishCommunication(
    ordinary.id,
    {
      ...schedule,
      executionMode: "ServerGenerated",
      publishMode: "Recurring",
      confirmedPreview: true,
    },
    actor,
  );
  // PostgreSQL now() stays at transaction start while publish uses wall time.
  // Make both fixtures eligible so exclusion is tested by execution mode alone.
  await db.query(
    "update public.communication_schedules set valid_from=now()-interval '1 minute' where communication_id::text=any($1::text[]) and is_active=true",
    [[draft.id, ordinary.id]],
  );
  for (const since of [null, "2026-01-01T00:00:00Z"]) {
    const pending = await agent.listPendingMessages("fixture", since);
    assert.ok(
      !pending.items.some((m) => m.communicationId === draft.id),
      "Legacy local-routine jobs must be excluded from full and incremental sync",
    );
    assert.ok(
      pending.items.some((m) => m.communicationId === ordinary.id),
      "Server-generated reminders must retain ordinary delivery",
    );
  }
  await db.query(
    "update public.communication_schedules set schedule_type='Immediate', execution_mode=null, recurrence_rule=null, timezone=null where communication_id::text=$1",
    [ordinary.id],
  );
  assert.ok(
    (await agent.listPendingMessages("fixture")).items.some(
      (m) => m.communicationId === ordinary.id,
    ),
    "One-time schedules with null execution mode must remain deliverable",
  );
  await assert.rejects(agent.listPendingMessages("invalid"), { code: "UNAUTHORIZED" });
  assert.equal(
    (await db.query("select id from public.delivery_jobs where id::text=$1", [legacy.id])).length,
    1,
    "Legacy history must remain stored",
  );

  const sessionSchedule = { ...schedule, recurrenceRule: "FREQ=WINDOWS_SIGNIN;INTERVAL=60" };
  await assert.rejects(
    service.reviseWellnessProgram(
      draft.id,
      {
        ...both,
        reminderSchedule: {
          ...sessionSchedule,
          distributionMode: "Staggered",
          staggerWindowMinutes: 30,
        },
      },
      3,
      actor,
    ),
    { code: "WINDOWS_SIGN_IN_SCHEDULE_INVALID" },
  );
  await service.reviseWellnessProgram(
    draft.id,
    {
      ...both,
      reminderSchedule: sessionSchedule,
    },
    3,
    actor,
  );
  const sessionPolicies = (await agent.listReminderPolicies("fixture")).items.filter(
    (p) => p.communicationId === draft.id && p.isActive,
  );
  assert.equal(sessionPolicies.length, 1);
  assert.equal(sessionPolicies[0].recurrenceRule, sessionSchedule.recurrenceRule);
  assert.equal(sessionPolicies[0].scheduleVersion, 4);
  assert.equal(
    (await service.getCommunicationDetail(draft.id)).schedule?.recurrenceRule,
    sessionSchedule.recurrenceRule,
  );

  await service.cancelCommunication(draft.id, actor);
  await assert.rejects(service.reviseWellnessProgram(draft.id, both, 4, actor), {
    code: "WELLNESS_NOT_EDITABLE",
  });
  console.log(
    "PASS: policy-only publish/revisions, legacy job exclusion (full/incremental), template/tombstone sync, server-generated/one-time delivery, auth rejection, add/remove devices, versions, history, audit and rollback; fixture rolled back.",
  );
} finally {
  await client.query("rollback");
  await client.end();
}
