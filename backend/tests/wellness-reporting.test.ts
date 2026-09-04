import { describe, expect, test } from "bun:test";
import { buildWellnessReporting } from "../src/modules/communications/service/wellness-reporting.js";

const policies = [
  {
    policyId: "policy-1",
    deviceId: "device-1",
    deviceIdentifier: "MTI-001",
    hostname: "MTI-NB-001",
    siteName: "Site A",
    areaName: "Office",
    scheduleVersion: 1,
    recurrenceRule: "FREQ=DAILY",
    timezone: "Asia/Makassar",
    isActive: true,
  },
];

function event(eventId: string, eventType: string, occurrenceUtc: string, actionKind?: string) {
  return {
    eventId,
    policyId: "policy-1",
    deviceId: "device-1",
    eventType,
    occurredAt: occurrenceUtc,
    reportedAt: occurrenceUtc,
    metadata: {
      occurrenceUtc,
      ...(actionKind ? { actionKind } : {}),
    },
  };
}

describe("buildWellnessReporting", () => {
  test("normalizes terminal outcomes without treating Read as completion", () => {
    const reporting = buildWellnessReporting({
      policies,
      events: [
        event("display-1", "Displayed", "2026-09-01T01:00:00.000Z"),
        event("read-1", "Read", "2026-09-01T01:00:00.000Z"),
        event("display-2", "Displayed", "2026-09-01T02:00:00.000Z"),
        event("complete-2", "Completed", "2026-09-01T02:00:00.000Z", "Done"),
        event("display-3", "Displayed", "2026-09-01T03:00:00.000Z"),
        event("defer-3", "Snoozed", "2026-09-01T03:00:00.000Z"),
        event("display-4", "Displayed", "2026-09-01T04:00:00.000Z"),
        event("dismiss-4", "Dismissed", "2026-09-01T04:00:00.000Z"),
        event("display-5", "Displayed", "2026-09-01T05:00:00.000Z"),
        event("timeout-5", "TimedOut", "2026-09-01T05:00:00.000Z"),
        event("display-6", "Displayed", "2026-09-01T06:00:00.000Z"),
        event("ambiguous-6", "Completed", "2026-09-01T06:00:00.000Z", "Close"),
      ],
    });

    expect(reporting.summary).toMatchObject({
      displayedCount: 6,
      engagedCount: 5,
      completionCount: 1,
      deferredCount: 1,
      dismissedCount: 1,
      timedOutCount: 1,
      ambiguousCloseCount: 1,
    });
    expect(reporting.summary.completionRate).toBe(16.7);
    expect(reporting.timeline.find((item) => item.eventId === "read-1")?.normalizedOutcome).toBe(
      "Engaged",
    );
    expect(
      reporting.timeline.find((item) => item.eventId === "ambiguous-6")?.normalizedOutcome,
    ).toBe("AmbiguousCloseCompletion");
  });

  test("preserves organization context in device outcomes", () => {
    const reporting = buildWellnessReporting({ policies, events: [] });

    expect(reporting.deviceOutcomes[0]).toMatchObject({
      deviceIdentifier: "MTI-001",
      siteName: "Site A",
      areaName: "Office",
    });
  });
});
