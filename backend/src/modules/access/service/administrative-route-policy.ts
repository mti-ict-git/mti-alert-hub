import type { AppRoute, AppRouteHandlerContext } from "../../../app/http/create-server.js";
import { AppError } from "../../../shared/errors/app-error.js";
import { requirePermission, type Permission } from "../model/permission-catalog.js";

/** Resource policies are mandatory, separate from the coarse feature permission. */
export type ResourcePolicy =
  | "session"
  | "global"
  | "reference"
  | "devices"
  | "enrollment"
  | "communications"
  | "reports"
  | "templates"
  | "dashboard";
type Policy = { permission: Permission | null; resource: ResourcePolicy };
const policies: Record<string, Policy> = {};
function add(permission: Permission | null, resource: ResourcePolicy, ...routes: string[]) {
  for (const route of routes) {
    if (policies[route]) throw new Error(`Duplicate access policy: ${route}`);
    policies[route] = { permission, resource };
  }
}
add(
  null,
  "session",
  "GET /auth/me",
  "POST /auth/logout",
  "POST /auth/rotate-session",
  "GET /access/me",
);
add("access.read", "global", "GET /access/users", "GET /access/users/{id}", "GET /access/roles");
add(
  "access.manage",
  "global",
  "GET /access/directory-users",
  "POST /access/users",
  "PATCH /access/users/{id}/assignment",
  "PATCH /access/users/{id}/status",
  "POST /access/users/{id}/revoke-sessions",
);
add("audit.read", "global", "GET /audit-logs");
add("settings.manage", "global", "GET /health/diagnostics");
add(
  "organization.manage",
  "global",
  "GET /organization",
  "POST /organization/{kind}",
  "PATCH /organization/{kind}/{id}",
);
add(
  null,
  "reference",
  "GET /reference/organization",
  "GET /reference/sites",
  "GET /reference/areas",
  "GET /reference/departments",
  "GET /reference/sections",
  "GET /workflows",
);
add("notifications.draft", "devices", "GET /reference/devices");
add("employees.read", "reference", "GET /employees");
add("devices.read", "devices", "GET /devices", "GET /devices/{deviceId}/placement");
add("devices.placement", "devices", "PATCH /devices/{deviceId}/placement");
add(
  "devices.enroll",
  "enrollment",
  "GET /devices/pending",
  "POST /devices/pending/{requestId}/approve",
  "POST /devices/pending/{requestId}/reject",
);
add("devices.test", "devices", "POST /devices/{deviceId}/test-notification");
add("devices.revoke", "devices", "POST /devices/{deviceId}/revoke-session");
add("rollouts.apply", "devices", "POST /devices/{deviceId}/rollouts");
// Registry access is deliberately global for IT Operators, independently of device scope.
add(
  "packages.read",
  "global",
  "GET /devices/rollout-packages/local",
  "GET /devices/rollout-packages/github-sync",
);
add(
  "packages.import",
  "global",
  "POST /devices/rollout-packages/upload",
  "POST /devices/rollout-packages/github-sync",
);
add("packages.delete", "global", "DELETE /devices/rollout-packages/local/{fileName}");
add("templates.read", "templates", "GET /templates", "GET /templates/{templateId}");
add(
  "notifications.read",
  "communications",
  "GET /communications",
  "GET /communications/{communicationId}",
);
add(
  "notifications.draft",
  "communications",
  "POST /communications",
  "PATCH /communications/{communicationId}",
  "POST /communications/{communicationId}/duplicate",
  "POST /communications/{communicationId}/audience-preview",
);
add("notifications.publish", "communications", "POST /communications/{communicationId}/publish");
add("notifications.cancel", "communications", "POST /communications/{communicationId}/cancel");
add("wellness.manage", "communications", "POST /communications/{communicationId}/revise-wellness");
add(
  "reports.read",
  "reports",
  "GET /communications/{communicationId}/reminder-activity",
  "GET /communications/{communicationId}/wellness-reporting",
);
add(
  "reports.recipients.read",
  "reports",
  "GET /communications/{communicationId}/deliveries",
  "GET /communications/{communicationId}/responses",
);
add(
  "notifications.publish",
  "communications",
  "POST /communications/{communicationId}/deliveries/{deliveryJobId}/response",
);
add(
  "dashboard.read",
  "dashboard",
  "GET /dashboard/overview",
  "GET /dashboard/content-type-rollups",
  "GET /dashboard/wellness-program-rollups",
);

// Device routes retain their existing device-session checks. This is an exact allowlist,
// never a wildcard that could accidentally exempt a future administrative endpoint.
export const nonAdministrativeRoutes = new Set([
  "GET /health",
  "POST /auth/login",
  "GET /agent/packages/local/{fileName}",
  "POST /agent/session",
  "POST /agent/realtime/negotiate",
  "GET /agent/realtime-hub",
  "POST /agent/heartbeat",
  "GET /agent/rollout-intent",
  "POST /agent/rollout-status",
  "GET /agent/messages",
  "GET /agent/reminder-policies",
  "POST /agent/messages/{messageId}/displayed",
  "POST /agent/messages/{messageId}/read",
  "POST /agent/messages/{messageId}/response",
  "POST /agent/reminder-policies/{policyId}/events",
]);
export const administrativeRoutePolicies: Readonly<Record<string, Policy>> = policies;

export type ResourceEnforcer = (
  policy: ResourcePolicy,
  route: AppRoute,
  context: AppRouteHandlerContext,
  run: () => ReturnType<AppRoute["handler"]>,
) => ReturnType<AppRoute["handler"]>;

/** Activate only with reviewed resource enforcers and database-backed session resolution. */
export function protectAdministrativeRoutes(
  routes: AppRoute[],
  enforceResource: ResourceEnforcer,
): AppRoute[] {
  return routes.map((route) => {
    const key = `${route.method} ${route.path}`;
    if (nonAdministrativeRoutes.has(key)) return route;
    const policy = policies[key];
    if (!policy) throw new Error(`Administrative route has no access policy: ${key}`);
    return {
      ...route,
      requiresAuth: true,
      allowAnonymous: false,
      // This reviewed permission catalog replaces the old three-role route declarations.
      requiredRoles: undefined,
      async handler(context) {
        const session = context.auth?.session;
        if (!session?.authorizationVersion || !session.permissions) {
          throw new AppError({
            statusCode: 401,
            code: "ACCESS_CHANGED",
            message: "Sign in again to refresh your access.",
          });
        }
        if (policy.permission) requirePermission(session.accessProfile.roleType, policy.permission);
        return enforceResource(policy.resource, route, context, () => route.handler(context));
      },
    };
  });
}
