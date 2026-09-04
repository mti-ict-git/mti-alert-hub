type ReminderPolicyInput = {
  policyId: string;
  deviceId: string;
  deviceIdentifier?: string | null;
  hostname?: string | null;
  siteName?: string | null;
  areaName?: string | null;
  scheduleVersion: number;
  recurrenceRule: string;
  timezone: string;
  validFrom?: string | null;
  validUntil?: string | null;
  isActive: boolean;
  lastSyncedAt?: string | null;
  updatedAt?: string | null;
};

type ReminderEventInput = {
  eventId: string;
  policyId: string;
  deviceId: string;
  deviceIdentifier?: string | null;
  hostname?: string | null;
  eventType: string;
  occurredAt: string;
  reportedAt: string;
  activeUserIdentifier?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type WellnessNormalizedOutcome =
  | "Triggered"
  | "NoInteraction"
  | "Engaged"
  | "InProgress"
  | "Completed"
  | "Deferred"
  | "Dismissed"
  | "TimedOut"
  | "AmbiguousCloseCompletion";

export type WellnessTerminalOutcome = Extract<
  WellnessNormalizedOutcome,
  "Completed" | "Deferred" | "Dismissed" | "TimedOut" | "AmbiguousCloseCompletion"
>;

export type WellnessReportingTimelineItem = {
  eventId: string;
  policyId: string;
  deviceId: string;
  deviceIdentifier: string | null;
  hostname: string | null;
  eventType: string;
  occurredAt: string;
  reportedAt: string;
  activeUserIdentifier: string | null;
  occurrenceUtc: string | null;
  snoozedUntilUtc: string | null;
  actionKey: string | null;
  actionKind: string | null;
  actionLabel: string | null;
  normalizedOutcome: WellnessNormalizedOutcome;
};

export type WellnessReportingDeviceOutcome = {
  policyId: string;
  deviceId: string;
  deviceIdentifier: string | null;
  hostname: string | null;
  siteName: string | null;
  areaName: string | null;
  isActive: boolean;
  scheduleVersion: number;
  recurrenceRule: string;
  timezone: string;
  validFrom: string | null;
  validUntil: string | null;
  lastSyncedAt: string | null;
  lastActivityAt: string | null;
  lastEventType: string | null;
  lastActionKind: string | null;
  lastActionLabel: string | null;
  lastNormalizedOutcome: WellnessNormalizedOutcome | null;
  lastTerminalOutcome: WellnessTerminalOutcome | null;
  ambiguousCloseCount: number;
  displayedCount: number;
  engagedCount: number;
  startedCount: number;
  completedCount: number;
  deferredCount: number;
  dismissedCount: number;
  timedOutCount: number;
};

export type WellnessReportingOccurrence = {
  policyId: string;
  deviceId: string;
  siteName: string | null;
  areaName: string | null;
  occurrenceUtc: string | null;
  localDate: string | null;
  localHour: number | null;
  timezone: string | null;
  displayed: boolean;
  engaged: boolean;
  started: boolean;
  stepAdvancedCount: number;
  finalOutcome: WellnessNormalizedOutcome;
};

export type WellnessActionBreakdownItem = {
  actionKey: string | null;
  actionKind: string | null;
  actionLabel: string | null;
  normalizedOutcome: WellnessNormalizedOutcome;
  count: number;
};

export type WellnessReportingSummary = {
  totalPolicies: number;
  activePolicies: number;
  displayedDevices: number;
  displayedCount: number;
  engagedCount: number;
  startedCount: number;
  stepAdvancedCount: number;
  startedButNotCompletedCount: number;
  completionCount: number;
  deferredCount: number;
  dismissedCount: number;
  timedOutCount: number;
  ambiguousCloseCount: number;
  displayRate: number | null;
  engagementRate: number | null;
  completionRate: number | null;
  completionRateAfterStart: number | null;
  deferRate: number | null;
  dismissRate: number | null;
  timeoutRate: number | null;
  startAbandonmentRate: number | null;
};

export type WellnessReporting = {
  summary: WellnessReportingSummary;
  funnel: Array<{
    key: string;
    label: string;
    count: number;
  }>;
  actionBreakdown: WellnessActionBreakdownItem[];
  deviceOutcomes: WellnessReportingDeviceOutcome[];
  occurrences: WellnessReportingOccurrence[];
  timeline: WellnessReportingTimelineItem[];
};

type OccurrenceAggregate = {
  policyId: string;
  deviceId: string;
  deviceIdentifier: string | null;
  hostname: string | null;
  occurrenceUtc: string | null;
  displayed: boolean;
  engaged: boolean;
  started: boolean;
  stepAdvancedCount: number;
  latestTerminalOutcome: WellnessTerminalOutcome | null;
  latestTerminalAtMs: number | null;
  latestEventAtMs: number | null;
  finalOutcome: WellnessNormalizedOutcome;
};

const TERMINAL_OUTCOME_SET = new Set<WellnessTerminalOutcome>([
  "Completed",
  "Deferred",
  "Dismissed",
  "TimedOut",
  "AmbiguousCloseCompletion",
]);

export function buildWellnessReporting(input: {
  policies: ReminderPolicyInput[];
  events: ReminderEventInput[];
}): WellnessReporting {
  const timeline = [...input.events]
    .map((event) => buildTimelineItem(event))
    .sort((left, right) => compareIsoDesc(left.occurredAt, right.occurredAt));

  const policyById = new Map(input.policies.map((policy) => [policy.policyId, policy] as const));
  const occurrenceMap = new Map<string, OccurrenceAggregate>();

  for (const event of timeline) {
    const occurrenceKey = `${event.policyId}:${event.occurrenceUtc ?? event.occurredAt}`;
    const existing = occurrenceMap.get(occurrenceKey) ?? {
      policyId: event.policyId,
      deviceId: event.deviceId,
      deviceIdentifier: event.deviceIdentifier,
      hostname: event.hostname,
      occurrenceUtc: event.occurrenceUtc,
      displayed: false,
      engaged: false,
      started: false,
      stepAdvancedCount: 0,
      latestTerminalOutcome: null,
      latestTerminalAtMs: null,
      latestEventAtMs: null,
      finalOutcome: "Triggered" as WellnessNormalizedOutcome,
    };

    if (event.eventType === "Displayed") {
      existing.displayed = true;
    }

    if (isEngagementOutcome(event.normalizedOutcome)) {
      existing.engaged = true;
    }

    if (event.eventType === "Started") {
      existing.started = true;
    }

    if (event.eventType === "StepAdvanced") {
      existing.stepAdvancedCount += 1;
    }

    const eventAtMs = parseIsoMs(event.occurredAt);
    if (eventAtMs !== null) {
      existing.latestEventAtMs =
        existing.latestEventAtMs === null
          ? eventAtMs
          : Math.max(existing.latestEventAtMs, eventAtMs);
    }

    if (isTerminalOutcome(event.normalizedOutcome) && eventAtMs !== null) {
      if (existing.latestTerminalAtMs === null || eventAtMs >= existing.latestTerminalAtMs) {
        existing.latestTerminalAtMs = eventAtMs;
        existing.latestTerminalOutcome = event.normalizedOutcome;
      }
    }

    occurrenceMap.set(occurrenceKey, existing);
  }

  const occurrences = [...occurrenceMap.values()].map((occurrence) => {
    const finalOutcome = resolveOccurrenceFinalOutcome(occurrence);
    return {
      ...occurrence,
      finalOutcome,
    };
  });

  const displayedOccurrences = occurrences.filter((item) => item.displayed);
  const engagedOccurrences = occurrences.filter((item) => item.engaged);
  const startedOccurrences = occurrences.filter((item) => item.started);
  const completedAfterStartOccurrences = startedOccurrences.filter(
    (item) => item.finalOutcome === "Completed",
  );
  const startedButNotCompletedOccurrences = startedOccurrences.filter(
    (item) => item.finalOutcome !== "Completed",
  );
  const stepAdvancedCount = occurrences.reduce((total, item) => total + item.stepAdvancedCount, 0);
  const completedOccurrences = occurrences.filter((item) => item.finalOutcome === "Completed");
  const deferredOccurrences = occurrences.filter((item) => item.finalOutcome === "Deferred");
  const dismissedOccurrences = occurrences.filter((item) => item.finalOutcome === "Dismissed");
  const timedOutOccurrences = occurrences.filter((item) => item.finalOutcome === "TimedOut");
  const ambiguousCloseOccurrences = occurrences.filter(
    (item) => item.finalOutcome === "AmbiguousCloseCompletion",
  );

  const activePolicies = input.policies.filter((policy) => policy.isActive);
  const activeDeviceIds = new Set(activePolicies.map((policy) => policy.deviceId));
  const displayedDeviceIds = new Set(
    displayedOccurrences
      .filter((occurrence) => activeDeviceIds.has(occurrence.deviceId))
      .map((occurrence) => occurrence.deviceId),
  );

  const summary: WellnessReportingSummary = {
    totalPolicies: input.policies.length,
    activePolicies: activePolicies.length,
    displayedDevices: displayedDeviceIds.size,
    displayedCount: displayedOccurrences.length,
    engagedCount: engagedOccurrences.length,
    startedCount: startedOccurrences.length,
    stepAdvancedCount,
    startedButNotCompletedCount: startedButNotCompletedOccurrences.length,
    completionCount: completedOccurrences.length,
    deferredCount: deferredOccurrences.length,
    dismissedCount: dismissedOccurrences.length,
    timedOutCount: timedOutOccurrences.length,
    ambiguousCloseCount: ambiguousCloseOccurrences.length,
    displayRate: safeRate(displayedDeviceIds.size, activePolicies.length),
    engagementRate: safeRate(engagedOccurrences.length, displayedOccurrences.length),
    completionRate: safeRate(completedOccurrences.length, displayedOccurrences.length),
    completionRateAfterStart: safeRate(
      completedAfterStartOccurrences.length,
      startedOccurrences.length,
    ),
    deferRate: safeRate(deferredOccurrences.length, displayedOccurrences.length),
    dismissRate: safeRate(dismissedOccurrences.length, displayedOccurrences.length),
    timeoutRate: safeRate(timedOutOccurrences.length, displayedOccurrences.length),
    startAbandonmentRate: safeRate(
      startedButNotCompletedOccurrences.length,
      startedOccurrences.length,
    ),
  };

  const funnel = [
    { key: "displayed", label: "Displayed", count: displayedOccurrences.length },
    { key: "engaged", label: "Engaged", count: engagedOccurrences.length },
    { key: "started", label: "Started", count: startedOccurrences.length },
    { key: "completed", label: "Completed", count: completedOccurrences.length },
    { key: "deferred", label: "Deferred", count: deferredOccurrences.length },
    { key: "dismissed", label: "Dismissed", count: dismissedOccurrences.length },
    { key: "timedOut", label: "Timed Out", count: timedOutOccurrences.length },
    {
      key: "ambiguousCloseCompletion",
      label: "Ambiguous Close",
      count: ambiguousCloseOccurrences.length,
    },
  ];

  const actionBreakdown = buildActionBreakdown(timeline);
  const deviceOutcomes = buildDeviceOutcomes({
    policies: input.policies,
    policyById,
    occurrences,
    timeline,
  });
  const occurrenceItems = occurrences
    .map((occurrence) => buildOccurrenceItem(occurrence, policyById.get(occurrence.policyId)))
    .sort((left, right) => compareIsoDesc(left.occurrenceUtc, right.occurrenceUtc));

  return {
    summary,
    funnel,
    actionBreakdown,
    deviceOutcomes,
    occurrences: occurrenceItems,
    timeline,
  };
}

function buildOccurrenceItem(
  occurrence: OccurrenceAggregate,
  policy: ReminderPolicyInput | undefined,
): WellnessReportingOccurrence {
  const timezone = policy?.timezone || null;
  const localTime = resolveLocalTime(occurrence.occurrenceUtc, timezone);

  return {
    policyId: occurrence.policyId,
    deviceId: occurrence.deviceId,
    siteName: policy?.siteName ?? null,
    areaName: policy?.areaName ?? null,
    occurrenceUtc: occurrence.occurrenceUtc,
    localDate: localTime?.date ?? null,
    localHour: localTime?.hour ?? null,
    timezone,
    displayed: occurrence.displayed,
    engaged: occurrence.engaged,
    started: occurrence.started,
    stepAdvancedCount: occurrence.stepAdvancedCount,
    finalOutcome: occurrence.finalOutcome,
  };
}

function resolveLocalTime(value: string | null, timezone: string | null) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return null;
  }

  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone || "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);
    const read = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((part) => part.type === type)?.value;
    const year = read("year");
    const month = read("month");
    const day = read("day");
    const hour = Number(read("hour"));
    if (!year || !month || !day || !Number.isInteger(hour)) {
      return null;
    }
    return { date: `${year}-${month}-${day}`, hour };
  } catch {
    return null;
  }
}

export function inferWellnessProgramFamily(input: {
  programType?: string | null;
  theme?: string | null;
  variantKeys?: string[] | null;
}) {
  const variantKeys = Array.isArray(input.variantKeys) ? input.variantKeys : [];
  if (variantKeys.some((value) => /^B/i.test(value))) {
    return "Office Stretching";
  }

  if (variantKeys.some((value) => /^A/i.test(value))) {
    return "20-20-20 Rule";
  }

  if (input.programType === "GuidedRoutine" && input.theme === "Green") {
    return "Office Stretching";
  }

  if (input.programType === "SimpleReminder" && input.theme === "Blue") {
    return "20-20-20 Rule";
  }

  return "Unknown";
}

function buildTimelineItem(event: ReminderEventInput): WellnessReportingTimelineItem {
  return {
    eventId: event.eventId,
    policyId: event.policyId,
    deviceId: event.deviceId,
    deviceIdentifier: event.deviceIdentifier ?? null,
    hostname: event.hostname ?? null,
    eventType: event.eventType,
    occurredAt: event.occurredAt,
    reportedAt: event.reportedAt,
    activeUserIdentifier: event.activeUserIdentifier ?? null,
    occurrenceUtc: readMetadataString(event.metadata, "occurrenceUtc"),
    snoozedUntilUtc: readMetadataString(event.metadata, "snoozedUntilUtc"),
    actionKey: readMetadataString(event.metadata, "actionKey"),
    actionKind: readMetadataString(event.metadata, "actionKind"),
    actionLabel: readMetadataString(event.metadata, "actionLabel"),
    normalizedOutcome: normalizeReminderEventOutcome(event),
  };
}

function buildActionBreakdown(timeline: WellnessReportingTimelineItem[]) {
  const buckets = new Map<string, WellnessActionBreakdownItem>();

  for (const item of timeline) {
    if (!item.actionKey && !item.actionKind && !item.actionLabel) {
      continue;
    }

    const key = [
      item.actionKey ?? "",
      item.actionKind ?? "",
      item.actionLabel ?? "",
      item.normalizedOutcome,
    ].join("|");

    const existing = buckets.get(key) ?? {
      actionKey: item.actionKey,
      actionKind: item.actionKind,
      actionLabel: item.actionLabel,
      normalizedOutcome: item.normalizedOutcome,
      count: 0,
    };
    existing.count += 1;
    buckets.set(key, existing);
  }

  return [...buckets.values()].sort((left, right) => right.count - left.count);
}

function buildDeviceOutcomes(input: {
  policies: ReminderPolicyInput[];
  policyById: Map<string, ReminderPolicyInput>;
  occurrences: OccurrenceAggregate[];
  timeline: WellnessReportingTimelineItem[];
}) {
  const occurrenceByPolicyId = new Map<string, OccurrenceAggregate[]>();
  for (const item of input.occurrences) {
    const existing = occurrenceByPolicyId.get(item.policyId) ?? [];
    existing.push(item);
    occurrenceByPolicyId.set(item.policyId, existing);
  }

  const latestTimelineByPolicyId = new Map<string, WellnessReportingTimelineItem>();
  for (const item of input.timeline) {
    if (!latestTimelineByPolicyId.has(item.policyId)) {
      latestTimelineByPolicyId.set(item.policyId, item);
    }
  }

  const policyIds = new Set<string>([
    ...input.policies.map((policy) => policy.policyId),
    ...input.timeline.map((event) => event.policyId),
  ]);

  return [...policyIds]
    .map((policyId) => {
      const policy = input.policyById.get(policyId);
      const occurrences = occurrenceByPolicyId.get(policyId) ?? [];
      const latestOccurrence = getLatestOccurrence(occurrences);
      const latestTerminalOccurrence = getLatestTerminalOccurrence(occurrences);
      const latestTimeline = latestTimelineByPolicyId.get(policyId);

      return {
        policyId,
        deviceId: policy?.deviceId ?? latestTimeline?.deviceId ?? "",
        deviceIdentifier: policy?.deviceIdentifier ?? latestTimeline?.deviceIdentifier ?? null,
        hostname: policy?.hostname ?? latestTimeline?.hostname ?? null,
        siteName: policy?.siteName ?? null,
        areaName: policy?.areaName ?? null,
        isActive: policy?.isActive ?? false,
        scheduleVersion: policy?.scheduleVersion ?? 0,
        recurrenceRule: policy?.recurrenceRule ?? "",
        timezone: policy?.timezone ?? "",
        validFrom: policy?.validFrom ?? null,
        validUntil: policy?.validUntil ?? null,
        lastSyncedAt: policy?.lastSyncedAt ?? null,
        lastActivityAt: latestTimeline?.occurredAt ?? null,
        lastEventType: latestTimeline?.eventType ?? null,
        lastActionKind: latestTimeline?.actionKind ?? null,
        lastActionLabel: latestTimeline?.actionLabel ?? null,
        lastNormalizedOutcome: latestOccurrence?.finalOutcome ?? null,
        lastTerminalOutcome: latestTerminalOccurrence?.latestTerminalOutcome ?? null,
        ambiguousCloseCount: occurrences.filter(
          (item) => item.finalOutcome === "AmbiguousCloseCompletion",
        ).length,
        displayedCount: occurrences.filter((item) => item.displayed).length,
        engagedCount: occurrences.filter((item) => item.engaged).length,
        startedCount: occurrences.filter((item) => item.started).length,
        completedCount: occurrences.filter((item) => item.finalOutcome === "Completed").length,
        deferredCount: occurrences.filter((item) => item.finalOutcome === "Deferred").length,
        dismissedCount: occurrences.filter((item) => item.finalOutcome === "Dismissed").length,
        timedOutCount: occurrences.filter((item) => item.finalOutcome === "TimedOut").length,
      } satisfies WellnessReportingDeviceOutcome;
    })
    .sort((left, right) => compareIsoDesc(left.lastActivityAt, right.lastActivityAt));
}

function getLatestOccurrence(items: OccurrenceAggregate[]) {
  return (
    [...items].sort(
      (left, right) => (right.latestEventAtMs ?? 0) - (left.latestEventAtMs ?? 0),
    )[0] ?? null
  );
}

function getLatestTerminalOccurrence(items: OccurrenceAggregate[]) {
  return (
    [...items]
      .filter((item) => item.latestTerminalOutcome)
      .sort((left, right) => (right.latestTerminalAtMs ?? 0) - (left.latestTerminalAtMs ?? 0))[0] ??
    null
  );
}

function resolveOccurrenceFinalOutcome(occurrence: OccurrenceAggregate): WellnessNormalizedOutcome {
  if (occurrence.latestTerminalOutcome) {
    return occurrence.latestTerminalOutcome;
  }

  if (occurrence.started) {
    return "InProgress";
  }

  if (occurrence.engaged) {
    return "Engaged";
  }

  if (occurrence.displayed) {
    return "NoInteraction";
  }

  return "Triggered";
}

function normalizeReminderEventOutcome(event: ReminderEventInput): WellnessNormalizedOutcome {
  const actionKind = readMetadataString(event.metadata, "actionKind");
  const explicitTerminalOutcome = readMetadataString(event.metadata, "terminalOutcome");

  if (
    (event.eventType === "Completed" && explicitTerminalOutcome === "Completed") ||
    (event.eventType === "Snoozed" && explicitTerminalOutcome === "Deferred") ||
    (event.eventType === "Dismissed" && explicitTerminalOutcome === "Dismissed") ||
    (event.eventType === "TimedOut" && explicitTerminalOutcome === "TimedOut")
  ) {
    return explicitTerminalOutcome;
  }

  switch (event.eventType) {
    case "Triggered":
      return "Triggered";
    case "Displayed":
      return "NoInteraction";
    case "Read":
    case "Responded":
      return "Engaged";
    case "Started":
    case "StepAdvanced":
      return "InProgress";
    case "Snoozed":
      return "Deferred";
    case "Dismissed":
      return "Dismissed";
    case "TimedOut":
      return "TimedOut";
    case "Completed":
      return actionKind === "Close" ? "AmbiguousCloseCompletion" : "Completed";
    default:
      return "Engaged";
  }
}

function isTerminalOutcome(value: WellnessNormalizedOutcome): value is WellnessTerminalOutcome {
  return TERMINAL_OUTCOME_SET.has(value as WellnessTerminalOutcome);
}

function isEngagementOutcome(value: WellnessNormalizedOutcome) {
  return (
    value === "Engaged" ||
    value === "InProgress" ||
    value === "Completed" ||
    value === "Deferred" ||
    value === "Dismissed" ||
    value === "AmbiguousCloseCompletion"
  );
}

function safeRate(numerator: number, denominator: number) {
  if (denominator <= 0) {
    return null;
  }

  return Math.round((numerator / denominator) * 1000) / 10;
}

function readMetadataString(metadata: Record<string, unknown> | null | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function parseIsoMs(value?: string | null) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

function compareIsoDesc(left?: string | null, right?: string | null) {
  return (parseIsoMs(right) ?? 0) - (parseIsoMs(left) ?? 0);
}
