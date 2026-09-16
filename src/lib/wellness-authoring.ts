export type WellnessScheduleBasis = "Fixed" | "WindowsSignIn";

export type WellnessRecurrenceUnit = "Minute" | "Hour" | "Day";

export type WellnessRotationMode = "Fixed" | "Sequential" | "Random";

export type WellnessRecurrencePreset = {
  label: string;
  interval: number;
  unit: WellnessRecurrenceUnit;
};

const RECURRENCE_FREQUENCY_BY_UNIT: Record<WellnessRecurrenceUnit, string> = {
  Minute: "MINUTELY",
  Hour: "HOURLY",
  Day: "DAILY",
};

const RECURRENCE_UNIT_BY_FREQUENCY: Record<string, WellnessRecurrenceUnit> = {
  MINUTELY: "Minute",
  HOURLY: "Hour",
  DAILY: "Day",
};

export const WELLNESS_RECURRENCE_PRESETS: readonly WellnessRecurrencePreset[] = [
  { label: "20 min", interval: 20, unit: "Minute" },
  { label: "1 hour", interval: 1, unit: "Hour" },
  { label: "2 hours", interval: 2, unit: "Hour" },
  { label: "Daily", interval: 1, unit: "Day" },
] as const;

export function buildWellnessRecurrenceRule(input: {
  interval: number;
  unit: WellnessRecurrenceUnit;
  basis?: WellnessScheduleBasis;
}) {
  const normalizedInterval = Number.isFinite(input.interval)
    ? Math.max(1, Math.floor(input.interval))
    : 1;

  if (input.basis === "WindowsSignIn") {
    const minutes =
      normalizedInterval * (input.unit === "Day" ? 1440 : input.unit === "Hour" ? 60 : 1);
    return "FREQ=WINDOWS_SIGNIN;INTERVAL=" + minutes;
  }

  return `FREQ=${RECURRENCE_FREQUENCY_BY_UNIT[input.unit]};INTERVAL=${normalizedInterval}`;
}

export function parseWellnessRecurrenceRule(rule: string | null | undefined): {
  interval: number;
  unit: WellnessRecurrenceUnit;
  basis: WellnessScheduleBasis;
} | null {
  if (!rule?.trim()) {
    return null;
  }

  const parts = new Map(
    rule
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [key, value] = part.split("=");
        return [key?.toUpperCase() ?? "", value?.toUpperCase() ?? ""];
      }),
  );

  if (parts.get("FREQ") === "WINDOWS_SIGNIN") {
    const minutes = Number(parts.get("INTERVAL"));
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 10080) return null;
    return {
      interval: minutes % 60 === 0 ? minutes / 60 : minutes,
      unit: minutes % 60 === 0 ? "Hour" : "Minute",
      basis: "WindowsSignIn",
    };
  }

  const unit = RECURRENCE_UNIT_BY_FREQUENCY[parts.get("FREQ") ?? ""];
  const interval = Number.parseInt(parts.get("INTERVAL") ?? "", 10);

  if (!unit || !Number.isFinite(interval) || interval < 1) {
    return null;
  }

  return {
    interval,
    unit,
    basis: "Fixed",
  };
}

export function formatWellnessRecurrenceSummary(rule: string | null | undefined) {
  const parsed = parseWellnessRecurrenceRule(rule);
  if (!parsed) {
    return "Custom recurrence";
  }

  if (parsed.basis === "WindowsSignIn") {
    return (
      "After Windows sign-in · every " +
      parsed.interval +
      " " +
      pluralizeUnit(parsed.unit, parsed.interval)
    );
  }

  if (parsed.interval === 1) {
    switch (parsed.unit) {
      case "Minute":
        return "Every minute";
      case "Hour":
        return "Every hour";
      default:
        return "Every day";
    }
  }

  return `Every ${parsed.interval} ${pluralizeUnit(parsed.unit, parsed.interval)}`;
}

function pluralizeUnit(unit: WellnessRecurrenceUnit, count: number) {
  if (count === 1) {
    return unit.toLowerCase();
  }

  switch (unit) {
    case "Day":
      return "days";
    case "Hour":
      return "hours";
    default:
      return "minutes";
  }
}
