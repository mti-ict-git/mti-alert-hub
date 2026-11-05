import { AppError } from "../../../shared/errors/app-error.js";

export function validateWindowsSignInSchedule(
  rule: string | null | undefined,
  executionMode: string | null | undefined,
  distributionMode: string | null | undefined,
  isWellness: boolean,
) {
  if (rule?.toUpperCase().includes("ACTIVE_USAGE")) {
    const match =
      /^FREQ=ACTIVE_USAGE;INTERVAL=([1-9][0-9]*);REST=([1-9][0-9]*);GAP=([1-9][0-9]*)$/.exec(rule);
    const values = match?.slice(1).map(Number);
    if (
      !values ||
      values.some((v) => !Number.isSafeInteger(v)) ||
      values[0]! > 10080 ||
      values[1]! > 1440 ||
      values[2]! > 1440 ||
      !isWellness ||
      executionMode !== "AgentLocalRoutine" ||
      distributionMode === "Staggered"
    ) {
      throw new AppError({
        statusCode: 422,
        code: "ACTIVE_USAGE_SCHEDULE_INVALID",
        message:
          "Active usage requires a wellness local routine, no stagger, interval 1–10080 and rest/gap 1–1440 whole minutes.",
      });
    }
    return;
  }
  if (!rule?.toUpperCase().includes("WINDOWS_SIGNIN")) return;
  const match = /^FREQ=WINDOWS_SIGNIN;INTERVAL=([1-9][0-9]*)$/.exec(rule);
  const minutes = match ? Number(match[1]) : NaN;
  if (
    !Number.isSafeInteger(minutes) ||
    minutes > 10080 ||
    executionMode !== "AgentLocalRoutine" ||
    distributionMode === "Staggered" ||
    !isWellness
  ) {
    throw new AppError({
      statusCode: 422,
      code: "WINDOWS_SIGN_IN_SCHEDULE_INVALID",
      message:
        "After Windows sign-in requires a wellness AgentLocalRoutine schedule, no stagger, and an integer interval of 1 to 10080 minutes.",
    });
  }
}
