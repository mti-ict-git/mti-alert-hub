import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Client } from "pg";
import { loadEnv } from "../src/app/config/env.js";
import { resolvePostgresConnectionConfig } from "../src/infrastructure/db/postgres-connection-config.js";
import type { DatabaseClient } from "../src/infrastructure/db/connection.js";
import {
  savePolicyApplication,
  policyApplicationSchema,
} from "../src/modules/agent/service/policy-application-service.js";

// All DDL and fixture changes are rolled back. No server or device calls.
const client = new Client(resolvePostgresConnectionConfig(loadEnv()));
await client.connect();
let sequence = 0;
const db: DatabaseClient = {
  query: async (sql, params) => (await client.query(sql, params)).rows,
  maybeQuery: async (_table, sql, params) => (await client.query(sql, params)).rows,
  tableExists: async () => true,
  ping: async () => {},
  withTransaction: async (run) => {
    const name = `application_test_${++sequence}`;
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
try {
  await client.query("begin");
  await client.query("set local lock_timeout='3s'");
  const exists = (
    await client.query("select to_regclass('public.agent_reminder_policy_applications') as name")
  ).rows[0].name;
  if (!exists)
    await client.query(
      readFileSync("backend/migrations/0021_phase4_policy_application_reports.up.sql", "utf8"),
    );
  const [p] = await db.query<{ id: string; device: string; version: number }>(
    `select id::text,device_id::text as device,schedule_version as version from public.agent_reminder_policies limit 1`,
  );
  assert.ok(p, "Requires one existing policy for a rollback-only fixture");
  await client.query(
    "update public.agent_reminder_policies set is_active=true, valid_from=now()-interval '1 day',valid_until=now()+interval '1 day' where id=$1",
    [p.id],
  );
  await client.query("delete from public.agent_reminder_policy_applications where policy_id=$1", [
    p.id,
  ]);
  const now = Date.now();
  const report = {
    protocolVersion: 1 as const,
    scheduleVersion: p.version,
    appliedAt: new Date(now - 10000).toISOString(),
    reportedAt: new Date(now).toISOString(),
    state: "Scheduled" as const,
    nextRunAt: new Date(now + 7200000).toISOString(),
    agentVersion: "1.0.18",
  };
  assert.equal(policyApplicationSchema.safeParse({ ...report, nextRunAt: null }).success, false);
  assert.equal(
    policyApplicationSchema.safeParse({
      ...report,
      reportedAt: new Date(now + 3600000).toISOString(),
    }).success,
    false,
  );
  await assert.rejects(
    savePolicyApplication(db, "00000000-0000-0000-0000-000000000000", p.id, report),
    { code: "POLICY_NOT_FOUND" },
  );
  await assert.rejects(
    savePolicyApplication(db, p.device, p.id, { ...report, scheduleVersion: p.version + 1 }),
    { code: "POLICY_VERSION_STALE" },
  );
  await assert.rejects(
    savePolicyApplication(db, p.device, p.id, {
      ...report,
      nextRunAt: new Date(now + 172800000).toISOString(),
    }),
    { code: "NEXT_RUN_OUTSIDE_POLICY" },
  );
  await savePolicyApplication(db, p.device, p.id, report);
  await savePolicyApplication(db, p.device, p.id, {
    ...report,
    reportedAt: new Date(now - 1000).toISOString(),
    state: "WaitingForSession",
    nextRunAt: null,
  });
  const [saved] = await db.query<{ state: string }>(
    "select state from public.agent_reminder_policy_applications where policy_id=$1",
    [p.id],
  );
  assert.equal(saved.state, "Scheduled", "Older reports cannot replace current state");
  await savePolicyApplication(db, p.device, p.id, {
    ...report,
    reportedAt: new Date(now + 1000).toISOString(),
    state: "WaitingForSession",
    nextRunAt: null,
  });
  assert.equal(
    (
      await db.query<{ state: string }>(
        "select state from public.agent_reminder_policy_applications where policy_id=$1",
        [p.id],
      )
    )[0].state,
    "WaitingForSession",
  );
  await client.query("update public.agent_reminder_policies set is_active=false where id=$1", [
    p.id,
  ]);
  await assert.rejects(savePolicyApplication(db, p.device, p.id, report), {
    code: "POLICY_VERSION_STALE",
  });
  console.log(
    "PASS: report validation, ownership, version, validity, application, ordering, state transition, inactive rejection; transaction rolled back.",
  );
} finally {
  await client.query("rollback");
  await client.end();
}
