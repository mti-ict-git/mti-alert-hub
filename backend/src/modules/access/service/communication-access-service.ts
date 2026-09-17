import type { DatabaseClient } from "../../../infrastructure/db/connection.js";
import { AppError } from "../../../shared/errors/app-error.js";
import { currentAccess, locationScopeSql } from "./access-context.js";
import {
  type AccessGrant,
  requirePermission,
  requiresEmergencyPermission,
} from "../model/permission-catalog.js";

/** Draft ownership covers intended future audience; publication uses recipient snapshots. */
export function communicationScopeSql(alias = "communications") {
  if (!/^[a-z_][a-z0-9_]*$/i.test(alias)) throw Error("Invalid communication alias");
  const context = currentAccess();
  if (!context || context.scopes.some((s) => s.scopeType === "Global")) return "true";
  const scopeChecks = context.scopes.map((s) =>
    s.scopeType === "Site"
      ? `(grant_item->>'scopeType' = 'Site' and grant_item->>'scopeValue' = '${s.scopeValue}') or (grant_item->>'scopeType' = 'Area' and exists(select 1 from public.areas granted_area where granted_area.id::text = grant_item->>'scopeValue' and granted_area.site_id = '${s.scopeValue}'::uuid))`
      : `(grant_item->>'scopeType' = 'Area' and grant_item->>'scopeValue' = '${s.scopeValue}')`,
  );
  const covered = scopeChecks.length ? `(${scopeChecks.join(" or ")})` : "false";
  return `((exists(select 1 from public.communication_recipients content_recipient where content_recipient.communication_id = ${alias}.id) or exists(select 1 from public.communication_access access_record where access_record.communication_id = ${alias}.id
    and jsonb_array_length(access_record.scope_grants_json) > 0
    and not exists(select 1 from jsonb_array_elements(access_record.scope_grants_json) grant_item where not coalesce((${covered}), false))))
    and not exists(select 1 from public.communication_recipients scope_recipient where scope_recipient.communication_id = ${alias}.id and not (${locationScopeSql("scope_recipient.site_id", "scope_recipient.area_id")})))`;
}
export function reminderHistoryScopeSql() {
  const actor = currentAccess();
  if (!actor || actor.scopes.some((s) => s.scopeType === "Global")) return "true";
  return `exists(select 1 from public.communication_recipients history_recipient
    where history_recipient.communication_id=arp.communication_id
    and history_recipient.communication_schedule_id=arp.communication_schedule_id
    and history_recipient.device_id=arp.device_id
    and ${locationScopeSql("history_recipient.site_id", "history_recipient.area_id")})`;
}
export function communicationReportScopeSql(alias = "communications") {
  if (!/^[a-z_][a-z0-9_]*$/i.test(alias)) throw Error("Invalid communication alias");
  return `(${communicationScopeSql(alias)} or exists(select 1 from public.communication_recipients report_recipient where report_recipient.communication_id = ${alias}.id and ${locationScopeSql("report_recipient.site_id", "report_recipient.area_id")}))`;
}
export function requireCommunicationCapability(
  priority: string,
  criticalBehavior: string | null,
  wellness: boolean,
  action: "draft" | "publish" | "cancel",
) {
  const context = currentAccess();
  if (!context) return;
  requirePermission(context.role, `notifications.${action}`);
  if (wellness)
    requirePermission(context.role, action === "publish" ? "wellness.publish" : "wellness.manage");
  if (requiresEmergencyPermission(priority, criticalBehavior))
    requirePermission(context.role, "notifications.emergency");
}
export class CommunicationAccessService {
  constructor(private readonly db: DatabaseClient) {}
  async recordDraft(id: string) {
    const actor = currentAccess();
    if (!actor) return;
    const targets = await this.db.query<{ type: string; value: string }>(
      `select target_type as type,target_value as value from public.communication_targets where communication_id=$1`,
      [id],
    );
    let scopes: readonly AccessGrant[] = actor.scopes;
    if (
      targets.length &&
      targets.every((t) => ["Site", "Area", "Device", "Employee"].includes(t.type))
    ) {
      const explicit: AccessGrant[] = [];
      for (const target of targets) {
        const lookup = {
          Site: {
            table: "sites",
            site: "id",
            area: "null::uuid",
            match: "id::text=$1 or code=$1 or name ilike $2",
          },
          Area: {
            table: "areas",
            site: "site_id",
            area: "id",
            match: "id::text=$1 or code=$1 or name ilike $2",
          },
          Device: {
            table: "devices",
            site: "site_id",
            area: "area_id",
            match: "id::text=$1 or device_identifier=$1 or hostname ilike $2",
          },
          Employee: {
            table: "employees",
            site: "site_id",
            area: "area_id",
            match: "id::text=$1 or employee_number=$1 or full_name ilike $2",
          },
        }[target.type as "Site" | "Area" | "Device" | "Employee"];
        const rows = await this.db.query<{ site: string | null; area: string | null }>(
          `select ${lookup.site}::text as site,${lookup.area}::text as area from public.${lookup.table} where (${lookup.match})`,
          [target.value, `%${target.value}%`],
        );
        for (const row of rows)
          explicit.push(
            row.area
              ? { scopeType: "Area", scopeValue: row.area }
              : row.site
                ? { scopeType: "Site", scopeValue: row.site }
                : { scopeType: "Global", scopeValue: "*" },
          );
      }
      if (explicit.length)
        scopes = explicit.some((s) => s.scopeType === "Global")
          ? [{ scopeType: "Global", scopeValue: "*" }]
          : [...new Map(explicit.map((s) => [s.scopeType + ":" + s.scopeValue, s])).values()];
    }
    await this.db.query(
      `insert into public.communication_access(communication_id,owner_user_id,scope_grants_json)
      values($1,$2,$3::jsonb) on conflict(communication_id) do update set scope_grants_json=$3::jsonb,updated_at=now()`,
      [id, actor.userId, JSON.stringify(scopes)],
    );
  }

  async reportDetail(id: string) {
    const [row] = await this.db.query<{
      id: string;
      status: string;
      title: string;
      wellnessProgram: unknown;
    }>(
      `select id::text,status,case when ${communicationScopeSql()} then title else 'Restricted communication' end as title,
       case when ${communicationScopeSql()} then wellness_program_json else null end as "wellnessProgram"
       from public.communications where id::text=$1 and ${communicationReportScopeSql()}`,
      [id],
    );
    return row;
  }
  async authorizePublication(id: string) {
    const actor = currentAccess();
    if (!actor) return;
    await this.db.query(
      `insert into public.communication_access(communication_id,owner_user_id,scope_grants_json,publisher_user_id,publisher_authorization_version,authorization_state)
      values($1,$2,$3::jsonb,$2,$4,'Authorized') on conflict(communication_id) do update
      set publisher_user_id=$2,publisher_authorization_version=$4,authorization_state='Authorized',updated_at=now()`,
      [id, actor.userId, JSON.stringify(actor.scopes), actor.authorizationVersion],
    );
  }
  async requireVisible(id: string) {
    const [row] = await this.db.query(
      `select id from public.communications where id::text=$1 and ${communicationScopeSql()}`,
      [id],
    );
    if (!row)
      throw new AppError({
        statusCode: 404,
        code: "NOT_FOUND",
        message: "The requested communication was not found.",
      });
  }
}
