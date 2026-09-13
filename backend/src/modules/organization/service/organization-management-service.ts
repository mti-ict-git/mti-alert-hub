import { z } from "zod";
import type { DatabaseClient } from "../../../infrastructure/db/connection.js";
import { AppError } from "../../../shared/errors/app-error.js";
import { AuditLogService } from "../../audit/service/audit-log-service.js";

export const organizationKind = z.enum(["sites", "areas", "departments", "sections"]);
export const organizationInput = z
  .object({
    name: z.string().trim().min(1).max(160),
    code: z.string().trim().max(64).default(""),
    parentId: z.string().uuid().nullable().default(null),
    status: z.enum(["Active", "Inactive"]).default("Active"),
    updatedAt: z.string().optional(),
  })
  .strict();
type Kind = z.infer<typeof organizationKind>;
type Input = z.infer<typeof organizationInput>;
const config = {
  sites: { parent: null, column: null, employee: "site_id" },
  areas: { parent: "sites", column: "site_id", employee: "area_id" },
  departments: { parent: "sites", column: "site_id", employee: "department_id" },
  sections: { parent: "departments", column: "department_id", employee: "section_id" },
} as const;
function fail(message: string, statusCode = 409): never {
  throw new AppError({ statusCode, code: "ORGANIZATION_CONFLICT", message });
}
export function isLocalOrganizationSource(source: string | null) {
  return !source || ["local", "manual"].includes(source.toLowerCase());
}

export class OrganizationManagementService {
  constructor(private readonly database: DatabaseClient) {}
  async list() {
    const entries = await Promise.all(
      organizationKind.options.map(async (kind) => {
        const c = config[kind];
        const devices =
          kind === "sites" || kind === "areas"
            ? `select count(*)::int from public.devices d where d.${c.employee} = o.id`
            : `select count(*)::int from public.devices d join public.employees e on e.id=d.primary_employee_id where e.${c.employee}=o.id`;
        const rows = await this.database.query(
          `select o.id::text, o.code, o.name, o.status, o.source_system as "sourceSystem", o.updated_at::text as "updatedAt", ${c.column ? `o.${c.column}::text` : "null"} as "parentId", (select count(*)::int from public.employees e where e.${c.employee}=o.id) as "employeeCount", (${devices}) as "deviceCount" from public.${kind} o order by o.name, o.id`,
        );
        return [
          kind,
          rows.map((r) => ({
            ...r,
            editable: isLocalOrganizationSource(r.sourceSystem as string | null),
          })),
        ];
      }),
    );
    return Object.fromEntries(entries);
  }
  async save(kind: Kind, id: string | null, input: Input, actor: string) {
    const c = config[kind];
    if (kind === "sites" && !input.code) fail("Site code is required.", 400);
    if (kind === "sites" && input.parentId) fail("Sites cannot have a parent.", 400);
    if (kind === "areas" && !input.parentId) fail("Select a site for this area.", 400);
    try {
      return await this.database.withTransaction(async (tx) => {
        // Serialize hierarchy edits, including child creation and parent deactivation.
        await tx.query("select pg_advisory_xact_lock(8120741)");
        let before: Record<string, unknown> | undefined;
        if (id) {
          [before] = await tx.query(
            `select *, updated_at::text as version from public.${kind} where id=$1::uuid for update`,
            [id],
          );
          if (!before) fail("This entry no longer exists.", 404);
          if (!isLocalOrganizationSource(before!.source_system as string | null))
            fail("This entry is managed by an external source. Update it in that system.", 403);
          if (!input.updatedAt || input.updatedAt !== before!.version)
            fail("This entry changed. Close the form, refresh the list, and try again.");
          if (c.column && (before![c.column] ?? null) !== input.parentId)
            fail(
              "Parent reassignment is not supported. Existing employee and device placements must remain consistent.",
            );
        }
        if (input.parentId && c.parent) {
          const [parent] = await tx.query(
            `select status from public.${c.parent} where id=$1::uuid for update`,
            [input.parentId],
          );
          if (!parent) fail("Parent entry was not found.", 400);
          if (input.status === "Active" && parent.status !== "Active")
            fail("Activate the parent before adding or activating this entry.");
        }
        if (id && input.status === "Inactive") {
          const childChecks =
            kind === "sites"
              ? [
                  ["areas", "site_id"],
                  ["departments", "site_id"],
                ]
              : kind === "departments"
                ? [["sections", "department_id"]]
                : [];
          for (const [table, column] of childChecks) {
            const [child] = await tx.query(
              `select id from public.${table} where ${column}=$1::uuid and status='Active' limit 1`,
              [id],
            );
            if (child)
              fail("Deactivate active child entries first. Existing assignments will be retained.");
          }
        }
        const duplicates = await tx.query(
          `select id from public.${kind} where ($1::uuid is null or id<>$1::uuid) and (lower(name)=lower($2) or ($3::text <> '' and lower(code)=lower($3))) ${c.column ? `and ${c.column} is not distinct from $4::uuid` : ""} limit 1`,
          c.column ? [id, input.name, input.code, input.parentId] : [id, input.name, input.code],
        );
        if (duplicates.length)
          fail("An entry with this name or code already exists in this scope.");
        let result;
        if (id) {
          [result] = await tx.query(
            `update public.${kind} set name=$2, code=$3, status=$4, updated_at=clock_timestamp() where id=$1::uuid returning id::text`,
            [id, input.name, input.code || null, input.status],
          );
        } else {
          [result] = await tx.query(
            `insert into public.${kind} (name,code,status,source_system${c.column ? `,${c.column}` : ""}) values ($1,$2,$3,'Local'${c.column ? ",$4::uuid" : ""}) returning id::text`,
            c.column
              ? [input.name, input.code || null, input.status, input.parentId]
              : [input.name, input.code || null, input.status],
          );
        }
        if (!result) fail("The entry could not be saved.", 500);
        await new AuditLogService(this.database).record(tx, {
          actorUsername: actor,
          actionType: id ? "OrganizationUpdated" : "OrganizationCreated",
          moduleName: "Organization",
          entityType: kind,
          entityId: result.id as string,
          description: `${id ? "Updated" : "Created"} ${kind}: ${input.name}`,
          metadata: { before, after: input },
        });
        return result;
      });
    } catch (error) {
      if ((error as { code?: string }).code === "23505")
        fail("An entry with this name or code already exists.");
      throw error;
    }
  }
}
