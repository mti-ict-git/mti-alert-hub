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
import type { AgentService } from "../src/modules/agent/service/agent-service.js";

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
  assert.equal(third.policies.filter((p) => p.isActive).length, 1);
  assert.equal(third.policies.find((p) => p.isActive)?.deviceId, devices[1].id);
  assert.equal(third.policies.find((p) => p.isActive)?.scheduleVersion, 3);
  assert.equal(third.events.length, 1);
  const audits = await db.query(
    "select id from public.audit_logs where entity_id::text=$1 and action_type='ReviseWellnessProgram'",
    [draft.id],
  );
  assert.equal(audits.length, 2);
  await service.cancelCommunication(draft.id, actor);
  await assert.rejects(service.reviseWellnessProgram(draft.id, both, 3, actor), {
    code: "WELLNESS_NOT_EDITABLE",
  });
  console.log(
    "PASS: add/remove devices, Scheduled/Active revisions, versions 1→2→3, historical events, audit, stale/invalid/empty rollback, stopped-program rejection; fixture rolled back.",
  );
} finally {
  await client.query("rollback");
  await client.end();
}
