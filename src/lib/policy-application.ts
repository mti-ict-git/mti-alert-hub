export type PolicyApplication = {
  protocolVersion: number;
  scheduleVersion: number;
  appliedAt: string;
  reportedAt: string;
  receivedAt: string;
  state:
    "Scheduled" | "WaitingForSession" | "WaitingForAuthorization" | "Unsupported" | "NoOccurrence";
  nextRunAt: string | null;
  agentVersion: string;
};
export type DevicePolicyState =
  | "Inactive"
  | "Expired"
  | "Awaiting agent confirmation"
  | "Agent update required"
  | "Agent report stale"
  | "Scheduled on device"
  | "Waiting for unlock / resume"
  | "Waiting for authorization"
  | "No remaining occurrence";

type Policy = {
  isActive: boolean;
  scheduleVersion: number;
  validUntil?: string | null;
  agentVersion?: string | null;
  application?: PolicyApplication | null;
};
export function getPolicyApplicationInsight(
  policy: Policy,
  now = new Date(),
): {
  scheduleState: DevicePolicyState;
  nextRunAt: string | null;
} {
  const result = (scheduleState: DevicePolicyState, nextRunAt: string | null = null) => ({
    scheduleState,
    nextRunAt,
  });
  if (!policy.isActive) return result("Inactive");
  if (policy.validUntil && Date.parse(policy.validUntil) < now.getTime()) return result("Expired");
  const report = policy.application;
  if (
    !report ||
    report.protocolVersion !== 1 ||
    report.scheduleVersion !== policy.scheduleVersion
  ) {
    const parts = /^([0-9]+)\.([0-9]+)\.([0-9]+)(?:\.[0-9]+)?$/.exec(policy.agentVersion ?? "");
    const old =
      parts &&
      (Number(parts[1]) < 1 ||
        (Number(parts[1]) === 1 && Number(parts[2]) === 0 && Number(parts[3]) < 18));
    return result(old ? "Agent update required" : "Awaiting agent confirmation");
  }
  if (
    !Number.isFinite(Date.parse(report.receivedAt)) ||
    now.getTime() - Date.parse(report.receivedAt) > 600000
  )
    return result("Agent report stale");
  switch (report.state) {
    case "Scheduled":
      return result("Scheduled on device", report.nextRunAt);
    case "WaitingForSession":
      return result("Waiting for unlock / resume");
    case "WaitingForAuthorization":
      return result("Waiting for authorization");
    case "Unsupported":
      return result("Agent update required");
    default:
      return result("No remaining occurrence");
  }
}
