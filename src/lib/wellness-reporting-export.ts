import type { WellnessProgramReportDetail, WellnessProgramRollup } from "@/types";

type CsvValue = string | number | boolean | null | undefined;

export function buildCsv(headers: string[], rows: CsvValue[][]) {
  return [headers, ...rows].map((row) => row.map(escapeCsvValue).join(",")).join("\r\n");
}

export function buildWellnessProgramSummaryCsv(programs: WellnessProgramRollup[]) {
  return buildCsv(
    [
      "Program ID",
      "Program",
      "Family",
      "Status",
      "Cadence",
      "Target Size",
      "Displayed",
      "Engaged",
      "Started",
      "Completed",
      "Deferred",
      "Dismissed",
      "Timed Out",
      "Ambiguous Close",
      "Completion Rate (%)",
      "Updated At",
    ],
    programs.map((program) => [
      program.communicationId,
      program.title,
      program.programFamily,
      program.status,
      program.cadence,
      program.targetSize,
      program.reporting.summary.displayedCount,
      program.reporting.summary.engagedCount,
      program.reporting.summary.startedCount,
      program.reporting.summary.completionCount,
      program.reporting.summary.deferredCount,
      program.reporting.summary.dismissedCount,
      program.reporting.summary.timedOutCount,
      program.reporting.summary.ambiguousCloseCount,
      program.reporting.summary.completionRate,
      program.updatedAt,
    ]),
  );
}

export function buildWellnessDeviceOutcomeCsv(report: WellnessProgramReportDetail) {
  return buildCsv(
    [
      "Program ID",
      "Program",
      "Policy ID",
      "Device ID",
      "Device",
      "Site",
      "Area",
      "Active",
      "Last Event",
      "Last Normalized Outcome",
      "Last Terminal Outcome",
      "Displayed",
      "Engaged",
      "Started",
      "Completed",
      "Deferred",
      "Dismissed",
      "Timed Out",
      "Ambiguous Close",
      "Last Activity At",
    ],
    report.reporting.deviceOutcomes.map((outcome) => [
      report.communicationId,
      report.title,
      outcome.policyId,
      outcome.deviceId,
      outcome.deviceIdentifier ?? outcome.hostname,
      outcome.siteName,
      outcome.areaName,
      outcome.isActive,
      outcome.lastEventType,
      outcome.lastNormalizedOutcome,
      outcome.lastTerminalOutcome,
      outcome.displayedCount,
      outcome.engagedCount,
      outcome.startedCount,
      outcome.completedCount,
      outcome.deferredCount,
      outcome.dismissedCount,
      outcome.timedOutCount,
      outcome.ambiguousCloseCount,
      outcome.lastActivityAt,
    ]),
  );
}

export function buildWellnessEventTimelineCsv(report: WellnessProgramReportDetail) {
  return buildCsv(
    [
      "Program ID",
      "Program",
      "Event ID",
      "Policy ID",
      "Device ID",
      "Device",
      "Event Type",
      "Normalized Outcome",
      "Action Key",
      "Action Kind",
      "Action Label",
      "Active User",
      "Occurrence At",
      "Snoozed Until",
      "Occurred At",
      "Reported At",
    ],
    report.reporting.timeline.map((event) => [
      report.communicationId,
      report.title,
      event.eventId,
      event.policyId,
      event.deviceId,
      event.deviceIdentifier ?? event.hostname,
      event.eventType,
      event.normalizedOutcome,
      event.actionKey,
      event.actionKind,
      event.actionLabel,
      event.activeUserIdentifier,
      event.occurrenceUtc,
      event.snoozedUntilUtc,
      event.occurredAt,
      event.reportedAt,
    ]),
  );
}

export function downloadCsv(fileName: string, csv: string) {
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = "none";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function safeCsvFileStem(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "wellness-program";
}

function escapeCsvValue(value: CsvValue) {
  if (value === null || value === undefined) {
    return "";
  }

  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
