import assert from "node:assert/strict";
import { test } from "node:test";
import { getPolicyApplicationInsight, type PolicyApplication } from "./policy-application";
const now = new Date("2026-09-17T08:00:00Z");
const report: PolicyApplication = {
  protocolVersion: 1,
  scheduleVersion: 2,
  appliedAt: now.toISOString(),
  reportedAt: now.toISOString(),
  receivedAt: now.toISOString(),
  state: "Scheduled",
  nextRunAt: "2026-09-17T10:00:00Z",
  agentVersion: "1.0.18",
};
const policy = { isActive: true, scheduleVersion: 2, agentVersion: "1.0.18", application: report };
test("device schedule requires current-version confirmation", () => {
  assert.equal(getPolicyApplicationInsight(policy, now).nextRunAt, report.nextRunAt);
  assert.equal(
    getPolicyApplicationInsight({ ...policy, application: null }, now).scheduleState,
    "Awaiting agent confirmation",
  );
  assert.equal(getPolicyApplicationInsight({ ...policy, scheduleVersion: 3 }, now).nextRunAt, null);
  assert.equal(
    getPolicyApplicationInsight({ ...policy, application: null, agentVersion: "1.0.17.0" }, now)
      .scheduleState,
    "Agent update required",
  );
});
test("stale, inactive and expired reports cannot advertise a next run", () => {
  assert.equal(
    getPolicyApplicationInsight(policy, new Date(now.getTime() + 600001)).scheduleState,
    "Agent report stale",
  );
  assert.equal(
    getPolicyApplicationInsight({ ...policy, isActive: false }, now).scheduleState,
    "Inactive",
  );
  assert.equal(
    getPolicyApplicationInsight({ ...policy, validUntil: "2026-09-16T00:00:00Z" }, now)
      .scheduleState,
    "Expired",
  );
});
test("waiting and unsupported device reports are explicit", () => {
  for (const [state, label] of [
    ["WaitingForSession", "Waiting for unlock / resume"],
    ["WaitingForAuthorization", "Waiting for authorization"],
    ["Unsupported", "Agent update required"],
    ["NoOccurrence", "No remaining occurrence"],
  ] as const) {
    const result = getPolicyApplicationInsight(
      { ...policy, application: { ...report, state, nextRunAt: null } },
      now,
    );
    assert.equal(result.scheduleState, label);
    assert.equal(result.nextRunAt, null);
  }
});
