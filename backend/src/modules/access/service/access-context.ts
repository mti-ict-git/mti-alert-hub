import { AsyncLocalStorage } from "node:async_hooks";
import { AppError } from "../../../shared/errors/app-error.js";
import {
  accessRole,
  grantSchema,
  allowsLocation,
  type AccessGrant,
  type AccessRole,
} from "../model/permission-catalog.js";

export type RequestAccess = {
  userId: string;
  authorizationVersion: number;
  role: AccessRole;
  scopes: readonly AccessGrant[];
};
const storage = new AsyncLocalStorage<RequestAccess>();
export const currentAccess = () => storage.getStore();
export function withAccess<T>(context: RequestAccess, run: () => T): T {
  const role = accessRole.parse(context.role);
  const scopes = grantSchema.array().parse(context.scopes);
  return storage.run({ ...context, role, scopes }, run);
}
function column(value: string) {
  if (!/^[a-z_][a-z0-9_]*(\.[a-z_][a-z0-9_]*)?$/i.test(value))
    throw Error("Invalid scope SQL column");
  return value;
}
/** Values are validated UUIDs, never user-supplied SQL. Predicate applies before count/pagination. */
export function locationScopeSql(siteColumn: string, areaColumn: string): string {
  const context = currentAccess();
  if (!context) return "true"; // Existing device-auth/system paths; managed HTTP always sets context.
  if (context.scopes.some((s) => s.scopeType === "Global")) return "true";
  const clauses = context.scopes.map(
    (s) => `${column(s.scopeType === "Site" ? siteColumn : areaColumn)} = '${s.scopeValue}'::uuid`,
  );
  return clauses.length ? `coalesce((${clauses.join(" or ")}), false)` : "false";
}
export function requireLocation(siteId: string | null, areaId: string | null) {
  const context = currentAccess();
  if (context && !allowsLocation(context.scopes, siteId, areaId))
    throw new AppError({
      statusCode: 404,
      code: "NOT_FOUND",
      message: "The requested resource was not found.",
    });
}
export function referenceScopeSql(
  kind: "sites" | "areas" | "departments" | "sections" | "employees",
) {
  const context = currentAccess();
  if (!context || context.scopes.some((s) => s.scopeType === "Global")) return "true";
  if (kind === "employees") return locationScopeSql("employees.site_id", "employees.area_id");
  if (kind === "areas") return locationScopeSql("areas.site_id", "areas.id");
  if (kind === "sites") {
    const siteGrants = context.scopes
      .filter((s) => s.scopeType === "Site")
      .map((s) => `sites.id = '${s.scopeValue}'::uuid`);
    return `(exists(select 1 from public.areas access_area where access_area.site_id = sites.id and ${locationScopeSql("access_area.site_id", "access_area.id")}) or ${siteGrants.length ? siteGrants.join(" or ") : "false"})`;
  }
  return `exists(select 1 from public.employees access_employee where access_employee.${kind === "departments" ? "department_id" : "section_id"} = ${kind}.id and ${locationScopeSql("access_employee.site_id", "access_employee.area_id")})`;
}
export function appendScopeWhere(where: { clause: string; params: unknown[] }, predicate: string) {
  where.clause = where.clause ? `${where.clause} and (${predicate})` : `where ${predicate}`;
  return where;
}
