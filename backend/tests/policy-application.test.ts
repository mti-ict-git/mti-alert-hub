import assert from "node:assert/strict";
import { test } from "node:test";
import {
  policyApplicationSchema,
  savePolicyApplication,
} from "../src/modules/agent/service/policy-application-service.js";
import type { DatabaseClient } from "../src/infrastructure/db/connection.js";
const timestamp = new Date(Date.now() - 1000).toISOString();
const report = {
  protocolVersion: 1 as const,
  scheduleVersion: 2,
  appliedAt: timestamp,
  reportedAt: timestamp,
  state: "Scheduled" as const,
  nextRunAt: new Date(Date.now() + 3600000).toISOString(),
  agentVersion: "1.0.18",
};
function fixture(policy: object | null) {
  const calls: { sql: string; params: unknown[] | undefined }[] = [];
  const db = {
    withTransaction: async (run: (tx: unknown) => Promise<unknown>) => run(db),
    query: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      return sql.startsWith("select") ? (policy ? [policy] : []) : [];
    },
  } as unknown as DatabaseClient;
  return { db, calls };
}
const policy = {
  scheduleVersion: 2,
  isActive: true,
  validFrom: new Date(Date.now() - 86400000).toISOString(),
  validUntil: new Date(Date.now() + 86400000).toISOString(),
};
test("strict report validation rejects contradictory state, future clocks, and unknown protocol", () => {
  assert.equal(policyApplicationSchema.safeParse(report).success, true);
  for (const bad of [
    { ...report, nextRunAt: null },
    { ...report, state: "WaitingForSession" },
    { ...report, protocolVersion: 2 },
    { ...report, reportedAt: new Date(Date.now() + 3600000).toISOString() },
    { ...report, appliedAt: new Date(Date.now() + 10000).toISOString() },
  ])
    assert.equal(policyApplicationSchema.safeParse(bad).success, false);
});
test("ownership and current active version are required before storage", async () => {
  const missing = fixture(null);
  await assert.rejects(savePolicyApplication(missing.db, "device", "policy", report), {
    code: "POLICY_NOT_FOUND",
  });
  assert.deepEqual(missing.calls[0].params, ["policy", "device"]);
  for (const current of [
    { ...policy, isActive: false },
    { ...policy, scheduleVersion: 3 },
  ]) {
    const f = fixture(current);
    await assert.rejects(savePolicyApplication(f.db, "device", "policy", report), {
      code: "POLICY_VERSION_STALE",
    });
    assert.equal(f.calls.length, 1);
  }
});
test("next run validity checked before accepting a persisted report", async () => {
  const f = fixture(policy);
  await assert.rejects(
    savePolicyApplication(f.db, "device", "policy", {
      ...report,
      nextRunAt: new Date(Date.now() + 172800000).toISOString(),
    }),
    { code: "NEXT_RUN_OUTSIDE_POLICY" },
  );
  assert.equal(f.calls.length, 1);
  await savePolicyApplication(f.db, "device", "policy", report);
  assert.equal(f.calls.length, 3);
  assert.deepEqual(f.calls[2].params, [
    "policy",
    2,
    report.appliedAt,
    report.reportedAt,
    "Scheduled",
    report.nextRunAt,
    "1.0.18",
  ]);
});
