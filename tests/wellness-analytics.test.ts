import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  buildDailyPerformance,
  buildGuidedRoutineDepth,
  buildHourlyPerformance,
  buildLocationComparison,
  buildProgramComparison,
  buildWeeklyPerformance,
  findStrongestWindow,
} from "../src/lib/wellness-analytics.ts";
import type { WellnessProgramRollup, WellnessReportingOccurrence } from "../src/types/index.ts";

function occurrence(
  hour: number,
  finalOutcome: WellnessReportingOccurrence["finalOutcome"],
  overrides: Partial<WellnessReportingOccurrence> = {},
): WellnessReportingOccurrence {
  return {
    policyId: `policy-${hour}`,
    deviceId: `device-${hour}`,
    siteName: "Site A",
    areaName: "Office",
    occurrenceUtc: `2026-09-0${hour < 3 ? 1 : 8}T${String(hour).padStart(2, "0")}:00:00.000Z`,
    localDate: hour < 3 ? "2026-09-01" : "2026-09-08",
    localHour: hour,
    timezone: "Asia/Makassar",
    displayed: true,
    engaged: true,
    started: false,
    stepAdvancedCount: 0,
    finalOutcome,
    ...overrides,
  };
}

function program(
  id: string,
  family: string,
  distributionMode: "Synchronized" | "Staggered",
  occurrences: WellnessReportingOccurrence[],
): WellnessProgramRollup {
  return {
    communicationId: id,
    title: id,
    status: "Active",
    recipientsCount: 2,
    programFamily: family,
    programType: "GuidedRoutine",
    variantKeys: ["B1"],
    cadence: "FREQ=DAILY",
    distributionMode,
    targetSize: 2,
    reporting: {
      summary: {} as WellnessProgramRollup["reporting"]["summary"],
      funnel: [],
      actionBreakdown: [],
      deviceOutcomes: [],
      occurrences,
      timeline: [],
    },
  };
}

describe("wellness advanced analytics", () => {
  const programs = [
    program("stretch", "Office Stretching", "Staggered", [
      occurrence(1, "Completed", { started: true, stepAdvancedCount: 2 }),
      occurrence(2, "Deferred", { started: true, stepAdvancedCount: 1 }),
    ]),
    program("eyes", "20-20-20 Rule", "Synchronized", [occurrence(9, "Completed")]),
  ];

  test("compares family, cadence, distribution, and location using occurrence denominators", () => {
    assert.equal(buildProgramComparison(programs, "family")[0]?.displayed, 2);
    assert.equal(buildProgramComparison(programs, "cadence")[0]?.programCount, 2);
    assert.equal(buildProgramComparison(programs, "distribution").length, 2);
    assert.equal(buildLocationComparison(programs, "site")[0]?.completionRate, 66.7);
  });

  test("builds local hourly, daily, and ISO-week trends", () => {
    const hourly = buildHourlyPerformance(programs);
    assert.equal(hourly[1]?.completionRate, 100);
    assert.equal(findStrongestWindow(hourly, "deferRate")?.label, "02:00");
    assert.equal(
      findStrongestWindow(
        hourly.map((item) => ({ ...item, deferred: 0, deferRate: 0 })),
        "deferRate",
      ),
      null,
    );
    assert.equal(buildDailyPerformance(programs).length, 2);
    assert.deepEqual(
      buildWeeklyPerformance(programs).map((item) => item.key),
      ["2026-08-31", "2026-09-07"],
    );
  });

  test("keeps unfinished starts distinct from partial completion", () => {
    const depth = buildGuidedRoutineDepth(programs);
    assert.equal(depth.started, 2);
    assert.equal(depth.stepAdvanced, 3);
    assert.equal(depth.completed, 2);
    assert.equal(depth.completedAfterStart, 1);
    assert.equal(depth.startedButNotCompleted, 1);
    assert.equal(depth.startAbandonmentRate, 50);
  });
});
