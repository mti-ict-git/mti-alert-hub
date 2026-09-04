import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { CommunicationDraftService } from "../src/modules/communications/service/communication-draft-service.js";
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

    assert.deepEqual(
      {
        displayedCount: reporting.summary.displayedCount,
        engagedCount: reporting.summary.engagedCount,
        completionCount: reporting.summary.completionCount,
        deferredCount: reporting.summary.deferredCount,
        dismissedCount: reporting.summary.dismissedCount,
        timedOutCount: reporting.summary.timedOutCount,
        ambiguousCloseCount: reporting.summary.ambiguousCloseCount,
      },
      {
        displayedCount: 6,
        engagedCount: 5,
        completionCount: 1,
        deferredCount: 1,
        dismissedCount: 1,
        timedOutCount: 1,
        ambiguousCloseCount: 1,
      },
    );
    assert.equal(reporting.summary.completionRate, 16.7);
    assert.equal(
      reporting.timeline.find((item) => item.eventId === "read-1")?.normalizedOutcome,
      "Engaged",
    );
    assert.equal(
      reporting.timeline.find((item) => item.eventId === "ambiguous-6")?.normalizedOutcome,
      "AmbiguousCloseCompletion",
    );
  });

  test("preserves organization context in device outcomes", () => {
    const reporting = buildWellnessReporting({ policies, events: [] });

    assert.equal(reporting.deviceOutcomes[0]?.deviceIdentifier, "MTI-001");
    assert.equal(reporting.deviceOutcomes[0]?.siteName, "Site A");
    assert.equal(reporting.deviceOutcomes[0]?.areaName, "Office");
  });

  test("uses active policies as the display-rate denominator", () => {
    const reporting = buildWellnessReporting({
      policies: [
        ...policies,
        {
          ...policies[0],
          policyId: "policy-inactive",
          deviceId: "device-inactive",
          isActive: false,
        },
      ],
      events: [event("display-1", "Displayed", "2026-09-01T01:00:00.000Z")],
    });

    assert.equal(reporting.summary.displayedDevices, 1);
    assert.equal(reporting.summary.activePolicies, 1);
    assert.equal(reporting.summary.displayRate, 100);
  });

  test("prefers an explicit terminal outcome while preserving legacy close ambiguity", () => {
    const reporting = buildWellnessReporting({
      policies,
      events: [
        event("legacy-close", "Completed", "2026-09-01T01:00:00.000Z", "Close"),
        {
          ...event("new-close", "Dismissed", "2026-09-01T02:00:00.000Z", "Close"),
          metadata: {
            occurrenceUtc: "2026-09-01T02:00:00.000Z",
            actionKind: "Close",
            terminalOutcome: "Dismissed",
          },
        },
      ],
    });

    assert.equal(
      reporting.timeline.find((item) => item.eventId === "legacy-close")?.normalizedOutcome,
      "AmbiguousCloseCompletion",
    );
    assert.equal(
      reporting.timeline.find((item) => item.eventId === "new-close")?.normalizedOutcome,
      "Dismissed",
    );
  });

  test("builds device-local occurrence analytics and guided routine depth", () => {
    const reporting = buildWellnessReporting({
      policies,
      events: [
        event("display", "Displayed", "2026-09-01T01:00:00.000Z"),
        event("start", "Started", "2026-09-01T01:00:00.000Z"),
        event("next-1", "StepAdvanced", "2026-09-01T01:00:00.000Z", "Next"),
        event("next-2", "StepAdvanced", "2026-09-01T01:00:00.000Z", "Next"),
      ],
    });

    assert.equal(reporting.summary.stepAdvancedCount, 2);
    assert.equal(reporting.summary.startedButNotCompletedCount, 1);
    assert.equal(reporting.summary.startAbandonmentRate, 100);
    assert.deepEqual(reporting.occurrences[0], {
      policyId: "policy-1",
      deviceId: "device-1",
      siteName: "Site A",
      areaName: "Office",
      occurrenceUtc: "2026-09-01T01:00:00.000Z",
      localDate: "2026-09-01",
      localHour: 9,
      timezone: "Asia/Makassar",
      displayed: true,
      engaged: true,
      started: true,
      stepAdvancedCount: 2,
      finalOutcome: "InProgress",
    });
  });
});

describe("CommunicationDraftService wellness reporting read model", () => {
  test("returns normalized terminal outcomes through the service endpoint model", async () => {
    const events = [
      event("complete", "Completed", "2026-09-01T01:00:00.000Z", "Done"),
      event("defer", "Snoozed", "2026-09-01T02:00:00.000Z"),
      event("dismiss", "Dismissed", "2026-09-01T03:00:00.000Z"),
      event("timeout", "TimedOut", "2026-09-01T04:00:00.000Z"),
      event("ambiguous", "Completed", "2026-09-01T05:00:00.000Z", "Close"),
    ];
    const database = {
      async query(sql: string) {
        if (sql.includes("from public.communications")) {
          return [
            {
              id: "communication-1",
              title: "OHIH Office Stretching",
              status: "Active",
              wellnessProgram: {
                programType: "GuidedRoutine",
                theme: "Green",
                layoutVariant: "OverviewCard",
                variantKeys: ["B2"],
                actions: [],
              },
            },
          ];
        }
        if (sql.includes("from public.agent_reminder_policies")) {
          return policies;
        }
        if (sql.includes("from public.agent_reminder_events")) {
          return events;
        }
        throw new Error(`Unexpected query in wellness reporting test: ${sql}`);
      },
    };
    const service = new CommunicationDraftService(
      database as never,
      null as never,
      null as never,
      null as never,
      null as never,
      null as never,
      [],
    );

    const result = await service.getCommunicationWellnessReporting("communication-1");

    assert.deepEqual(
      {
        completionCount: result.reporting.summary.completionCount,
        deferredCount: result.reporting.summary.deferredCount,
        dismissedCount: result.reporting.summary.dismissedCount,
        timedOutCount: result.reporting.summary.timedOutCount,
        ambiguousCloseCount: result.reporting.summary.ambiguousCloseCount,
      },
      {
        completionCount: 1,
        deferredCount: 1,
        dismissedCount: 1,
        timedOutCount: 1,
        ambiguousCloseCount: 1,
      },
    );
    assert.equal(result.reporting.deviceOutcomes[0]?.siteName, "Site A");
    assert.equal(result.reporting.deviceOutcomes[0]?.areaName, "Office");
    assert.deepEqual(
      new Set(result.reporting.timeline.map((item) => item.normalizedOutcome)),
      new Set(["Completed", "Deferred", "Dismissed", "TimedOut", "AmbiguousCloseCompletion"]),
    );
  });

  test("includes Phase C comparison dimensions in program rollups", async () => {
    const database = {
      async query(sql: string) {
        if (sql.includes("c.wellness_program_json") && sql.includes("publishRequestJson")) {
          return [
            {
              communicationId: "communication-1",
              title: "OHIH Office Stretching",
              status: "Active",
              createdAt: "2026-09-01T00:00:00.000Z",
              updatedAt: "2026-09-01T00:00:00.000Z",
              recipientsCount: 1,
              wellnessProgram: {
                programType: "GuidedRoutine",
                theme: "Green",
                variantKeys: ["B2"],
                layoutVariant: "OverviewCard",
                actions: [],
              },
              publishRequestJson: { distributionMode: "Staggered" },
            },
          ];
        }
        if (sql.includes("from public.agent_reminder_policies")) return policies;
        if (sql.includes("from public.agent_reminder_events")) return [];
        throw new Error(`Unexpected query in rollup test: ${sql}`);
      },
    };
    const service = new CommunicationDraftService(
      database as never,
      null as never,
      null as never,
      null as never,
      null as never,
      null as never,
      [],
    );

    const [rollup] = await service.listWellnessProgramRollups();

    assert.equal(rollup?.programFamily, "Office Stretching");
    assert.equal(rollup?.cadence, "FREQ=DAILY");
    assert.equal(rollup?.distributionMode, "Staggered");
    assert.deepEqual(rollup?.variantKeys, ["B2"]);
  });
});
