import { z } from "zod";
import type { DatabaseClient } from "../../../infrastructure/db/connection.js";
import { AppError } from "../../../shared/errors/app-error.js";

export const policyApplicationSchema = z
  .object({
    protocolVersion: z.literal(1),
    scheduleVersion: z.number().int().positive(),
    appliedAt: z.string().datetime({ offset: true }),
    reportedAt: z.string().datetime({ offset: true }),
    state: z.enum([
      "Scheduled",
      "WaitingForSession",
      "WaitingForAuthorization",
      "Unsupported",
      "NoOccurrence",
    ]),
    nextRunAt: z.string().datetime({ offset: true }).nullable(),
    agentVersion: z.string().trim().min(1).max(64),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      Date.parse(value.appliedAt) > Date.parse(value.reportedAt) ||
      Date.parse(value.reportedAt) > Date.now() + 300000 ||
      (value.state === "Scheduled") !== (value.nextRunAt !== null)
    ) {
      context.addIssue({
        code: "custom",
        message: "Invalid application report timestamps or schedule state.",
      });
    }
  });
export type PolicyApplicationReport = z.infer<typeof policyApplicationSchema>;

export async function savePolicyApplication(
  db: DatabaseClient,
  deviceId: string,
  policyId: string,
  input: PolicyApplicationReport,
) {
  const report = policyApplicationSchema.parse(input);
  await db.withTransaction(async (tx) => {
    const [policy] = await tx.query<{
      scheduleVersion: number;
      isActive: boolean;
      validFrom: string;
      validUntil: string;
    }>(
      'select schedule_version as "scheduleVersion", is_active as "isActive", valid_from::text as "validFrom", valid_until::text as "validUntil" from public.agent_reminder_policies where id::text=$1 and device_id::text=$2 for share',
      [policyId, deviceId],
    );
    if (!policy)
      throw new AppError({
        statusCode: 404,
        code: "POLICY_NOT_FOUND",
        message: "Policy not found.",
      });
    if (!policy.isActive || policy.scheduleVersion !== report.scheduleVersion)
      throw new AppError({
        statusCode: 409,
        code: "POLICY_VERSION_STALE",
        message: "Sync the current active policy version before reporting.",
      });
    if (
      report.nextRunAt &&
      (Date.parse(report.nextRunAt) < Date.parse(policy.validFrom) ||
        Date.parse(report.nextRunAt) > Date.parse(policy.validUntil))
    )
      throw new AppError({
        statusCode: 422,
        code: "NEXT_RUN_OUTSIDE_POLICY",
        message: "Next run must fall within policy validity.",
      });
    await tx.query(
      `insert into public.agent_reminder_policy_applications
        (policy_id,schedule_version,protocol_version,applied_at,reported_at,state,next_run_at,agent_version)
       values($1,$2,1,$3,$4,$5,$6,$7)
       on conflict(policy_id) do update set schedule_version=excluded.schedule_version,
         applied_at=excluded.applied_at,reported_at=excluded.reported_at,received_at=now(),
         state=excluded.state,next_run_at=excluded.next_run_at,agent_version=excluded.agent_version
       where agent_reminder_policy_applications.schedule_version <> excluded.schedule_version
         or agent_reminder_policy_applications.reported_at <= excluded.reported_at`,
      [
        policyId,
        report.scheduleVersion,
        report.appliedAt,
        report.reportedAt,
        report.state,
        report.nextRunAt,
        report.agentVersion,
      ],
    );
  });
}
