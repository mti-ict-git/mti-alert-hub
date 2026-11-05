import test from "node:test";
import assert from "node:assert/strict";
import { validateWindowsSignInSchedule as validate } from "../src/modules/communications/service/windows-sign-in-schedule.js";
import {
  buildWellnessRecurrenceRule,
  parseWellnessRecurrenceRule,
} from "../../src/lib/wellness-authoring.ts";
import { policyApplicationSchema } from "../src/modules/agent/service/policy-application-service.ts";
import { getPolicyApplicationInsight } from "../../src/lib/policy-application.ts";

test("server-owned parameters survive authoring parse/publish round trips", () => {
  for (const [interval, rest, gap] of [
    [1, 1, 1],
    [120, 5, 15],
    [10080, 1440, 1440],
  ]) {
    const rule = buildWellnessRecurrenceRule({
      basis: "ActiveUsage",
      unit: "Minute",
      interval,
      minimumRestMinutes: rest,
      interProgramGapMinutes: gap,
    });
    validate(rule, "AgentLocalRoutine", "Synchronized", true);
    const parsed = parseWellnessRecurrenceRule(rule)!;
    assert.equal(parsed.minimumRestMinutes, rest);
    assert.equal(parsed.interProgramGapMinutes, gap);
    assert.equal(buildWellnessRecurrenceRule(parsed), rule);
  }
});
test("server rejects invalid/missing settings and incompatible schedules", () => {
  const good = "FREQ=ACTIVE_USAGE;INTERVAL=120;REST=5;GAP=15";
  for (const rule of [
    good.replace("120", "0"),
    good.replace("REST=5", "REST=1.5"),
    good.replace("REST=5", "REST=1441"),
    good.replace("GAP=15", "GAP=0"),
    good.replace("120", "10081"),
    good + ";X=1",
    good.replace(";GAP=15", ""),
  ]) {
    assert.throws(() => validate(rule, "AgentLocalRoutine", "Synchronized", true));
    assert.equal(parseWellnessRecurrenceRule(rule), null);
  }
  assert.throws(() => validate(good, "ServerGenerated", "Synchronized", true));
  assert.throws(() => validate(good, "AgentLocalRoutine", "Staggered", true));
  assert.throws(() => validate(good, "AgentLocalRoutine", "Synchronized", false));
});
test("waiting slot carries no invented next-run time and is displayed explicitly", () => {
  const now = new Date().toISOString();
  const application = {
    protocolVersion: 1 as const,
    scheduleVersion: 1,
    appliedAt: now,
    reportedAt: now,
    receivedAt: now,
    state: "WaitingForWellnessSlot" as const,
    nextRunAt: null,
    agentVersion: "usage-test",
  };
  const { receivedAt, ...payload } = application;
  assert.equal(policyApplicationSchema.safeParse(payload).success, true);
  assert.equal(policyApplicationSchema.safeParse({ ...payload, nextRunAt: now }).success, false);
  assert.equal(
    getPolicyApplicationInsight({ isActive: true, scheduleVersion: 1, application }).scheduleState,
    "Waiting for wellness slot",
  );
});
