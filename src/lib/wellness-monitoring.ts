import type {
  ReminderActivity,
  ReminderEventRecord,
  WellnessMonitoringSummary,
} from "@/types";

export function buildWellnessMonitoringSummary(
  reminderActivity?: ReminderActivity | null,
): WellnessMonitoringSummary {
  const policies = reminderActivity?.policies ?? [];
  const events = [...(reminderActivity?.events ?? [])].sort(
    (left, right) =>
      new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime(),
  );

  const counts = {
    triggered: 0,
    displayed: 0,
    started: 0,
    snoozed: 0,
    completed: 0,
    timedOut: 0,
    stepAdvanced: 0,
  };

  const deviceMap = new Map<
    string,
    WellnessMonitoringSummary["deviceItems"][number]
  >();

  for (const policy of policies) {
    deviceMap.set(policy.policyId, {
      policyId: policy.policyId,
      deviceId: policy.deviceId,
      deviceLabel: policy.deviceIdentifier ?? policy.hostname ?? policy.deviceId,
      isActive: policy.isActive,
      scheduleVersion: policy.scheduleVersion,
      lastSyncedAt: policy.lastSyncedAt ?? null,
      lastActivityAt: null,
      lastEventType: null,
    });
  }

  for (const event of events) {
    incrementCount(counts, event.eventType);

    const existing = deviceMap.get(event.policyId);
    if (existing) {
      if (!existing.lastActivityAt) {
        existing.lastActivityAt = event.occurredAt;
        existing.lastEventType = event.eventType;
      }
      continue;
    }

    deviceMap.set(event.policyId, {
      policyId: event.policyId,
      deviceId: event.deviceId,
      deviceLabel: event.deviceIdentifier ?? event.hostname ?? event.deviceId,
      isActive: false,
      scheduleVersion: 0,
      lastSyncedAt: null,
      lastActivityAt: event.occurredAt,
      lastEventType: event.eventType,
    });
  }

  const deviceItems = [...deviceMap.values()].sort((left, right) => {
    const leftTime = left.lastActivityAt ?? left.lastSyncedAt ?? "";
    const rightTime = right.lastActivityAt ?? right.lastSyncedAt ?? "";
    return new Date(rightTime || 0).getTime() - new Date(leftTime || 0).getTime();
  });

  const completionDenominator = Math.max(
    counts.triggered,
    counts.started,
    counts.completed + counts.timedOut,
  );

  return {
    counts,
    totalPolicies: policies.length,
    activePolicies: policies.filter((policy) => policy.isActive).length,
    lastSyncedAt: getLatestDate(policies.map((policy) => policy.lastSyncedAt ?? null)),
    lastActivityAt: getLatestDate(events.map((event) => event.occurredAt)),
    completionRate:
      completionDenominator > 0
        ? Math.round((counts.completed / completionDenominator) * 100)
        : null,
    deviceItems,
    recentEvents: events.slice(0, 12),
  };
}

function incrementCount(
  counts: WellnessMonitoringSummary["counts"],
  eventType: ReminderEventRecord["eventType"],
) {
  switch (eventType) {
    case "Triggered":
      counts.triggered += 1;
      break;
    case "Displayed":
      counts.displayed += 1;
      break;
    case "Started":
      counts.started += 1;
      break;
    case "Snoozed":
      counts.snoozed += 1;
      break;
    case "Completed":
      counts.completed += 1;
      break;
    case "TimedOut":
      counts.timedOut += 1;
      break;
    case "StepAdvanced":
      counts.stepAdvanced += 1;
      break;
    default:
      break;
  }
}

function getLatestDate(values: Array<string | null | undefined>) {
  const timestamps = values
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value).getTime())
    .filter((value) => !Number.isNaN(value));

  if (timestamps.length === 0) {
    return null;
  }

  return new Date(Math.max(...timestamps)).toISOString();
}
