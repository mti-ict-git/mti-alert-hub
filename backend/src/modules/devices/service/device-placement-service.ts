import { requireLocation } from "../../access/service/access-context.js";
import { z } from "zod";
import type { DatabaseClient } from "../../../infrastructure/db/connection.js";
import { AppError } from "../../../shared/errors/app-error.js";
import { AuditLogService } from "../../audit/service/audit-log-service.js";
export const placementFields = z
  .object({
    siteId: z.string().uuid(),
    areaId: z.string().uuid().nullable(),
    locationLabel: z.string().max(160).nullable(),
    ownershipMode: z.enum(["LocationOwned", "EmployeeAssigned", "Mixed"]),
  })
  .strict();
export const placementUpdate = z
  .object({ expected: placementFields, changes: placementFields.partial() })
  .strict()
  .refine((v) => Object.keys(v.changes).length > 0, "Select at least one field to change.");
export type Placement = z.infer<typeof placementFields>;
function conflict(message: string, statusCode = 409): never {
  throw new AppError({ statusCode, code: "DEVICE_PLACEMENT_CONFLICT", message });
}
export class DevicePlacementService {
  constructor(private readonly db: DatabaseClient) {}
  async get(id: string) {
    const [row] = await this.db.query(
      `select id::text,hostname,site_id::text as "siteId",area_id::text as "areaId",location_label as "locationLabel",ownership_mode as "ownershipMode",last_directory_department as department from public.devices where id=$1::uuid`,
      [id],
    );
    if (!row) conflict("Device not found.", 404);
    requireLocation(row.siteId as string | null, row.areaId as string | null);
    return row;
  }
  async update(id: string, input: z.infer<typeof placementUpdate>, actor: string) {
    return this.db.withTransaction(async (tx) => {
      await tx.query("select pg_advisory_xact_lock(8120741)");
      const [row] = await tx.query(
        `select id::text,hostname,site_id::text as "siteId",area_id::text as "areaId",location_label as "locationLabel",ownership_mode as "ownershipMode" from public.devices where id=$1::uuid for update`,
        [id],
      );
      if (!row) conflict("Device not found.", 404);
      requireLocation(row.siteId as string | null, row.areaId as string | null);
      for (const key of Object.keys(input.expected) as (keyof Placement)[])
        if (row[key] !== input.expected[key])
          conflict(
            "Placement changed since review. Close and reopen to review the latest placement.",
          );
      const next = { ...input.expected, ...input.changes };
      requireLocation(next.siteId, next.areaId);
      if (
        input.changes.siteId &&
        input.changes.siteId !== row.siteId &&
        !Object.hasOwn(input.changes, "areaId")
      )
        conflict("Select an area or explicitly clear it when changing site.", 400);
      if (Object.hasOwn(input.changes, "siteId") || Object.hasOwn(input.changes, "areaId")) {
        const [site] = await tx.query(
          "select status from public.sites where id=$1::uuid for share",
          [next.siteId],
        );
        if (site?.status !== "Active") conflict("Choose an active site.", 400);
        if (next.areaId) {
          const [area] = await tx.query(
            'select site_id::text as "siteId",status from public.areas where id=$1::uuid for share',
            [next.areaId],
          );
          if (area?.status !== "Active" || area.siteId !== next.siteId)
            conflict("Area must be active and belong to the selected site.", 400);
        }
      }
      await tx.query(
        "update public.devices set site_id=$2::uuid,area_id=$3::uuid,location_label=$4,ownership_mode=$5,updated_at=now() where id=$1::uuid",
        [id, next.siteId, next.areaId, next.locationLabel, next.ownershipMode],
      );
      await new AuditLogService(this.db).record(tx, {
        actorUsername: actor,
        actionType: "DevicePlacementUpdated",
        moduleName: "Devices",
        entityType: "Device",
        entityId: id,
        description: `Updated placement for ${row.hostname}`,
        metadata: { before: input.expected, after: next },
      });
      return { id, ...next };
    });
  }
}
