export type UtcOffsetTimeZoneOption = {
  label: string;
  value: string;
  offsetHours: number;
};

const MIN_UTC_OFFSET_HOURS = -12;
const MAX_UTC_OFFSET_HOURS = 14;

function buildTimeZoneValue(offsetHours: number) {
  if (offsetHours === 0) {
    return "UTC";
  }

  // IANA's Etc/GMT sign is intentionally inverted: Etc/GMT-8 means UTC+8.
  return `Etc/GMT${offsetHours > 0 ? "-" : "+"}${Math.abs(offsetHours)}`;
}

function buildTimeZoneLabel(offsetHours: number) {
  if (offsetHours === 0) {
    return "UTC";
  }

  return `UTC${offsetHours > 0 ? "+" : ""}${offsetHours}`;
}

export const UTC_OFFSET_TIME_ZONE_OPTIONS: UtcOffsetTimeZoneOption[] = Array.from(
  { length: MAX_UTC_OFFSET_HOURS - MIN_UTC_OFFSET_HOURS + 1 },
  (_, index) => {
    const offsetHours = MIN_UTC_OFFSET_HOURS + index;
    return {
      label: buildTimeZoneLabel(offsetHours),
      value: buildTimeZoneValue(offsetHours),
      offsetHours,
    };
  },
);

const TIME_ZONE_OPTION_BY_VALUE = new Map(
  UTC_OFFSET_TIME_ZONE_OPTIONS.map((option) => [option.value, option]),
);

export function normalizeUtcOffsetTimeZone(
  timeZone: string | null | undefined,
  referenceDate = new Date(),
) {
  const normalized = timeZone?.trim();
  if (!normalized) {
    return getLocalUtcOffsetTimeZone(referenceDate);
  }

  if (TIME_ZONE_OPTION_BY_VALUE.has(normalized)) {
    return normalized;
  }

  try {
    const offsetName = new Intl.DateTimeFormat("en-US", {
      timeZone: normalized,
      timeZoneName: "longOffset",
    })
      .formatToParts(referenceDate)
      .find((part) => part.type === "timeZoneName")?.value;
    const match = offsetName?.match(/^GMT(?:([+-])(\d{2}):?(\d{2}))?$/);

    if (!match) {
      return "UTC";
    }

    const offsetHours = match[1] ? (match[1] === "+" ? 1 : -1) * Number.parseInt(match[2], 10) : 0;
    const offsetMinutes = match[3] ? Number.parseInt(match[3], 10) : 0;

    if (offsetMinutes !== 0) {
      return "UTC";
    }

    return TIME_ZONE_OPTION_BY_VALUE.get(buildTimeZoneValue(offsetHours))?.value ?? "UTC";
  } catch {
    return "UTC";
  }
}

export function getLocalUtcOffsetTimeZone(referenceDate = new Date()) {
  const offsetHours = -referenceDate.getTimezoneOffset() / 60;
  if (!Number.isInteger(offsetHours)) {
    return "UTC";
  }

  return TIME_ZONE_OPTION_BY_VALUE.get(buildTimeZoneValue(offsetHours))?.value ?? "UTC";
}

export function formatUtcOffsetTimeZone(timeZone: string | null | undefined) {
  if (!timeZone?.trim()) {
    return "—";
  }

  const normalized = normalizeUtcOffsetTimeZone(timeZone);
  return TIME_ZONE_OPTION_BY_VALUE.get(normalized)?.label ?? "UTC";
}
