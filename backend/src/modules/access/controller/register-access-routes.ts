import { AppError } from "../../../shared/errors/app-error.js";
import type { AccessDirectoryService } from "../service/access-directory-service.js";
import { z } from "zod";
import type { AppRoute, AuthContext } from "../../../app/http/create-server.js";
import { validateWithSchema } from "../../../shared/validation/validate-zod.js";
import {
  accessRole,
  grantSchema,
  roleLabels,
  rolePermissions,
} from "../model/permission-catalog.js";
import type { AccessActor, UserAccessService } from "../service/user-access-service.js";

const listQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce
    .number()
    .refine((n) => [10, 25, 50, 100].includes(n), "Choose 10, 25, 50 or 100 rows.")
    .default(25),
  search: z.string().trim().max(100).optional(),
  status: z.enum(["Pending", "Active", "Disabled"]).optional(),
  roleId: accessRole.optional(),
  siteId: z.string().uuid().optional(),
});
/** Register only after persistent-session cutover and full administrative route policy coverage. */
export function registerAccessRoutes(options: {
  service: UserAccessService;
  directory: Pick<AccessDirectoryService, "search" | "resolve">;
  resolveActor: (auth: AuthContext) => AccessActor;
}): AppRoute[] {
  return [
    {
      method: "GET",
      path: "/access/me",
      requiresAuth: true,
      async handler({ auth }) {
        const session = auth!.session;
        if (!session.authorizationVersion || !session.permissions)
          throw new AppError({
            statusCode: 401,
            code: "ACCESS_CHANGED",
            message: "Sign in again to refresh your access.",
          });
        return {
          statusCode: 200,
          body: {
            roleId: session.accessProfile.roleType,
            scopes: session.accessProfile.scopes,
            permissions: session.permissions,
            authorizationVersion: session.authorizationVersion,
          },
        };
      },
    },
    {
      method: "GET",
      path: "/access/directory-users",
      requiresAuth: true,
      requiredRoles: ["CentralAdmin"],
      async handler({ auth, url }) {
        const actor = options.resolveActor(auth!);
        await options.service.read(actor, actor.id);
        const search = validateWithSchema(
          z.string().trim().min(3).max(100),
          url.searchParams.get("search"),
        );
        const entries = await options.directory.search(actor.id, search);
        return {
          statusCode: 200,
          body: { items: await options.service.findDirectoryUsers(actor, entries) },
        };
      },
    },
    {
      method: "POST",
      path: "/access/users",
      requiresAuth: true,
      requiredRoles: ["CentralAdmin"],
      async handler({ auth, json, request }) {
        const actor = options.resolveActor(auth!);
        await options.service.read(actor, actor.id);
        const value = validateWithSchema(
          z
            .object({
              directoryId: z.string().min(1).max(512),
              directorySubjectId: z.string().uuid(),
              roleId: accessRole,
              scopes: z.array(grantSchema).min(1).max(500),
              reason: z.string().trim().min(5).max(500),
            })
            .strict(),
          await json(),
        );
        const key = validateWithSchema(
          z.string().min(16).max(128),
          request.headers["idempotency-key"],
        );
        const identity = await options.directory.resolve(
          value.directoryId,
          value.directorySubjectId,
        );
        return {
          statusCode: 201,
          body: await options.service.grant(
            actor,
            identity,
            { roleId: value.roleId, scopes: value.scopes, reason: value.reason },
            key,
          ),
        };
      },
    },

    {
      method: "GET",
      path: "/access/users",
      requiresAuth: true,
      requiredRoles: ["CentralAdmin"],
      async handler({ auth, url }) {
        const query = validateWithSchema(listQuery, Object.fromEntries(url.searchParams));
        return {
          statusCode: 200,
          body: await options.service.list(options.resolveActor(auth!), query),
        };
      },
    },
    {
      method: "GET",
      path: "/access/users/{id}",
      requiresAuth: true,
      requiredRoles: ["CentralAdmin"],
      async handler({ auth, params }) {
        return {
          statusCode: 200,
          body: await options.service.read(
            options.resolveActor(auth!),
            validateWithSchema(z.string().uuid(), params.id),
          ),
        };
      },
    },
    {
      method: "GET",
      path: "/access/roles",
      requiresAuth: true,
      requiredRoles: ["CentralAdmin"],
      async handler({ auth }) {
        const actor = options.resolveActor(auth!);
        await options.service.read(actor, actor.id); // Recheck current role/version, not only route snapshot.
        return {
          statusCode: 200,
          body: {
            items: accessRole.options.map((id) => ({
              id,
              label: roleLabels[id],
              permissions: rolePermissions[id],
            })),
          },
        };
      },
    },
    ...(["assignment", "status", "revoke"] as const).map((operation): AppRoute => ({
      method: operation === "revoke" ? "POST" : "PATCH",
      path: "/access/users/{id}/" + (operation === "revoke" ? "revoke-sessions" : operation),
      requiresAuth: true,
      requiredRoles: ["CentralAdmin"],
      async handler({ auth, params, request, json }) {
        const actor = options.resolveActor(auth!);
        actor.ipAddress = request.socket.remoteAddress;
        const key = validateWithSchema(
          z.string().min(16).max(128),
          request.headers["idempotency-key"],
        );
        return {
          statusCode: 200,
          body: await options.service.change(
            actor,
            validateWithSchema(z.string().uuid(), params.id),
            operation,
            await json(),
            key,
          ),
        };
      },
    })),
  ];
}
