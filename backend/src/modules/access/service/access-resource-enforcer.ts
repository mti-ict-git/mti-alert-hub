import { CommunicationAccessService } from "./communication-access-service.js";
import { createHash } from "node:crypto";
import type { DatabaseClient } from "../../../infrastructure/db/connection.js";
import { AppError } from "../../../shared/errors/app-error.js";
import { accessRole, grantSchema } from "../model/permission-catalog.js";
import { withAccess, requireLocation } from "./access-context.js";
import type { ResourceEnforcer } from "./administrative-route-policy.js";

/** Resource queries execute inside one locked, current authorization snapshot. */
export function createAccessResourceEnforcer(database: DatabaseClient): ResourceEnforcer {
  return async (policy, route, context, run) => {
    // These services already own their user/session transactions and lock ordering.
    if (policy === "session" || route.path.startsWith("/access/")) return run();
    const session = context.auth!.session;
    return database.withTransaction(async (tx) => {
      const [user] = await tx.query<{
        id: string;
        role_type: string;
        authorization_version: number;
      }>(
        `select u.id::text,u.role_type,u.authorization_version from public.users u
        where u.id=$1 and u.status='Active' and u.authorization_version=$2 for share`,
        [session.user.id, session.authorizationVersion],
      );
      const [validSession] = await tx.query(
        `select token_digest from public.admin_sessions where token_digest=$1 and user_id=$2 and authorization_version=$3 and revoked_at is null and expires_at>now() for share`,
        [
          createHash("sha256").update(session.sessionToken).digest("hex"),
          session.user.id,
          session.authorizationVersion,
        ],
      );
      if (!user || !validSession)
        throw new AppError({
          statusCode: 401,
          code: "ACCESS_CHANGED",
          message: "Your access changed. Sign in again.",
        });
      const records = await tx.query<{ scopeType: string; scopeValue: string }>(
        `select scope_type as "scopeType",scope_value as "scopeValue" from public.user_scopes where user_id=$1`,
        [user.id],
      );
      let scopes = grantSchema.array().parse(records);
      if (route.method !== "GET" && policy !== "global") {
        // Keep master activation stable until the authorized mutation commits.
        const siteGrants = scopes.filter((s) => s.scopeType === "Site").map((s) => s.scopeValue);
        const areaGrants = scopes.filter((s) => s.scopeType === "Area").map((s) => s.scopeValue);
        await tx.query(
          `select s.id from public.sites s where s.id::text=any($1::text[]) or s.id in(select a.site_id from public.areas a where a.id::text=any($2::text[])) order by s.id for share`,
          [siteGrants, areaGrants],
        );
        await tx.query(
          `select a.id from public.areas a where a.id::text=any($1::text[]) order by a.id for share`,
          [areaGrants],
        );
        const active = await tx.query<{ id: string }>(
          `select s.id::text from public.sites s where s.status='Active' union all select a.id::text from public.areas a join public.sites s on s.id=a.site_id where a.status='Active' and s.status='Active'`,
        );
        const activeIds = new Set(active.map((r) => r.id));
        scopes = scopes.filter((s) => s.scopeType === "Global" || activeIds.has(s.scopeValue));
      }
      if (!scopes.length)
        throw new AppError({
          statusCode: 403,
          code: "INACTIVE_SCOPE",
          message: "No active location grants are available for this action.",
        });
      return withAccess(
        {
          userId: user.id,
          role: accessRole.parse(user.role_type),
          authorizationVersion: user.authorization_version,
          scopes,
        },
        async () => {
          if (policy === "enrollment" && !scopes.some((s) => s.scopeType === "Global"))
            throw new AppError({
              statusCode: 403,
              code: "GLOBAL_SCOPE_REQUIRED",
              message: "Unassigned devices require Global scope.",
            });
          if (policy === "devices" && context.params.deviceId) {
            const [device] = await tx.query<{ siteId: string | null; areaId: string | null }>(
              `select site_id::text as "siteId",area_id::text as "areaId" from public.devices where id::text=$1 ${route.method === "GET" ? "for share" : "for update"}`,
              [context.params.deviceId],
            );
            if (!device)
              throw new AppError({
                statusCode: 404,
                code: "NOT_FOUND",
                message: "The requested device was not found.",
              });
            requireLocation(device.siteId, device.areaId);
          }
          if (policy === "communications" && context.params.communicationId) {
            await tx.query(
              `select id from public.communications where id::text=$1 ${route.method === "GET" ? "for share" : "for update"}`,
              [context.params.communicationId],
            );
            await new CommunicationAccessService(database).requireVisible(
              context.params.communicationId,
            );
          }
          return run();
        },
      );
    });
  };
}
