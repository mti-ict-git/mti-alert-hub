import type { WellnessProgramRollup, WellnessReportingOccurrence } from "@/types";

export type WellnessComparisonDimension = "family" | "cadence" | "distribution";

export interface WellnessMetricRow {
  key: string;
  label: string;
  programCount: number;
  displayed: number;
  started: number;
  completed: number;
  deferred: number;
  completionRate: number | null;
  deferRate: number | null;
}

export interface WellnessTimeBucket {
  key: string;
  label: string;
  displayed: number;
  completed: number;
  deferred: number;
  completionRate: number | null;
  deferRate: number | null;
}

export interface WellnessGuidedRoutineDepth {
  programs: number;
  displayed: number;
  started: number;
  stepAdvanced: number;
  completed: number;
  completedAfterStart: number;
  startedButNotCompleted: number;
  startAbandonmentRate: number | null;
}

export function filterWellnessOccurrences(
  programs: WellnessProgramRollup[],
  filters: { site?: string; area?: string } = {},
) {
  return programs.flatMap((program) =>
    (program.reporting.occurrences ?? [])
      .filter(
        (occurrence) =>
          (!filters.site || filters.site === "all" || occurrence.siteName === filters.site) &&
          (!filters.area || filters.area === "all" || occurrence.areaName === filters.area),
      )
      .map((occurrence) => ({ program, occurrence })),
  );
}

export function buildProgramComparison(
  programs: WellnessProgramRollup[],
  dimension: WellnessComparisonDimension,
  filters: { site?: string; area?: string } = {},
) {
  const buckets = new Map<
    string,
    { programs: Set<string>; occurrences: WellnessReportingOccurrence[] }
  >();

  if ((!filters.site || filters.site === "all") && (!filters.area || filters.area === "all")) {
    for (const program of programs) {
      const key = programDimensionValue(program, dimension);
      const bucket = buckets.get(key) ?? { programs: new Set<string>(), occurrences: [] };
      bucket.programs.add(program.communicationId);
      buckets.set(key, bucket);
    }
  }

  for (const { program, occurrence } of filterWellnessOccurrences(programs, filters)) {
    const key = programDimensionValue(program, dimension);
    const bucket = buckets.get(key) ?? { programs: new Set<string>(), occurrences: [] };
    bucket.programs.add(program.communicationId);
    bucket.occurrences.push(occurrence);
    buckets.set(key, bucket);
  }

  return [...buckets.entries()]
    .map(([key, bucket]) => buildMetricRow(key, key, bucket.programs.size, bucket.occurrences))
    .sort(
      (left, right) => right.displayed - left.displayed || left.label.localeCompare(right.label),
    );
}

export function buildLocationComparison(
  programs: WellnessProgramRollup[],
  dimension: "site" | "area",
  filters: { site?: string; area?: string } = {},
) {
  const buckets = new Map<
    string,
    { programs: Set<string>; occurrences: WellnessReportingOccurrence[] }
  >();

  for (const { program, occurrence } of filterWellnessOccurrences(programs, filters)) {
    const value = dimension === "site" ? occurrence.siteName : occurrence.areaName;
    const key = value?.trim() || `Unknown ${dimension}`;
    const bucket = buckets.get(key) ?? { programs: new Set<string>(), occurrences: [] };
    bucket.programs.add(program.communicationId);
    bucket.occurrences.push(occurrence);
    buckets.set(key, bucket);
  }

  return [...buckets.entries()]
    .map(([key, bucket]) => buildMetricRow(key, key, bucket.programs.size, bucket.occurrences))
    .sort(
      (left, right) => right.displayed - left.displayed || left.label.localeCompare(right.label),
    );
}

export function buildHourlyPerformance(
  programs: WellnessProgramRollup[],
  filters: { site?: string; area?: string } = {},
) {
  const buckets = Array.from({ length: 24 }, (_, hour) => ({
    key: String(hour),
    label: `${String(hour).padStart(2, "0")}:00`,
    occurrences: [] as WellnessReportingOccurrence[],
  }));

  for (const { occurrence } of filterWellnessOccurrences(programs, filters)) {
    if (occurrence.localHour != null && occurrence.localHour >= 0 && occurrence.localHour <= 23) {
      buckets[occurrence.localHour]?.occurrences.push(occurrence);
    }
  }

  return buckets.map((bucket) => buildTimeBucket(bucket.key, bucket.label, bucket.occurrences));
}

export function buildDailyPerformance(
  programs: WellnessProgramRollup[],
  filters: { site?: string; area?: string } = {},
) {
  const buckets = new Map<string, WellnessReportingOccurrence[]>();
  for (const { occurrence } of filterWellnessOccurrences(programs, filters)) {
    if (!occurrence.localDate) continue;
    const bucket = buckets.get(occurrence.localDate) ?? [];
    bucket.push(occurrence);
    buckets.set(occurrence.localDate, bucket);
  }
  return [...buckets.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-14)
    .map(([key, occurrences]) => buildTimeBucket(key, key, occurrences));
}

export function buildWeeklyPerformance(
  programs: WellnessProgramRollup[],
  filters: { site?: string; area?: string } = {},
) {
  const buckets = new Map<string, WellnessReportingOccurrence[]>();
  for (const { occurrence } of filterWellnessOccurrences(programs, filters)) {
    if (!occurrence.localDate) continue;
    const week = isoWeekStart(occurrence.localDate);
    if (!week) continue;
    const bucket = buckets.get(week) ?? [];
    bucket.push(occurrence);
    buckets.set(week, bucket);
  }
  return [...buckets.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-12)
    .map(([key, occurrences]) => buildTimeBucket(key, `Week of ${key}`, occurrences));
}

export function buildGuidedRoutineDepth(
  programs: WellnessProgramRollup[],
  filters: { site?: string; area?: string } = {},
): WellnessGuidedRoutineDepth {
  const guided = programs.filter((program) => program.programType === "GuidedRoutine");
  const occurrences = filterWellnessOccurrences(guided, filters).map((item) => item.occurrence);
  const displayed = occurrences.filter((item) => item.displayed).length;
  const started = occurrences.filter((item) => item.started).length;
  const completed = occurrences.filter((item) => item.finalOutcome === "Completed").length;
  const completedAfterStart = occurrences.filter(
    (item) => item.started && item.finalOutcome === "Completed",
  ).length;
  const startedButNotCompleted = occurrences.filter(
    (item) => item.started && item.finalOutcome !== "Completed",
  ).length;

  return {
    programs: guided.length,
    displayed,
    started,
    stepAdvanced: occurrences.reduce((total, item) => total + item.stepAdvancedCount, 0),
    completed,
    completedAfterStart,
    startedButNotCompleted,
    startAbandonmentRate: safeRate(startedButNotCompleted, started),
  };
}

export function findStrongestWindow(
  rows: WellnessTimeBucket[],
  metric: "completionRate" | "deferRate",
) {
  return (
    [...rows]
      .filter((row) => row.displayed > 0 && (row[metric] ?? 0) > 0)
      .sort(
        (left, right) =>
          (right[metric] ?? -1) - (left[metric] ?? -1) || right.displayed - left.displayed,
      )[0] ?? null
  );
}

function programDimensionValue(
  program: WellnessProgramRollup,
  dimension: WellnessComparisonDimension,
) {
  if (dimension === "family") return program.programFamily || "Unknown family";
  if (dimension === "cadence") return program.cadence || "Unknown cadence";
  return program.distributionMode || "Unknown distribution";
}

function buildMetricRow(
  key: string,
  label: string,
  programCount: number,
  occurrences: WellnessReportingOccurrence[],
): WellnessMetricRow {
  const time = buildTimeBucket(key, label, occurrences);
  return {
    ...time,
    programCount,
    started: occurrences.filter((item) => item.started).length,
  };
}

function buildTimeBucket(
  key: string,
  label: string,
  occurrences: WellnessReportingOccurrence[],
): WellnessTimeBucket {
  const displayed = occurrences.filter((item) => item.displayed).length;
  const completed = occurrences.filter((item) => item.finalOutcome === "Completed").length;
  const deferred = occurrences.filter((item) => item.finalOutcome === "Deferred").length;
  return {
    key,
    label,
    displayed,
    completed,
    deferred,
    completionRate: safeRate(completed, displayed),
    deferRate: safeRate(deferred, displayed),
  };
}

function isoWeekStart(localDate: string) {
  const date = new Date(`${localDate}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  const day = date.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function safeRate(numerator: number, denominator: number) {
  return denominator > 0 ? Math.round((numerator / denominator) * 1000) / 10 : null;
}
