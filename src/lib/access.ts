import type { User } from "@/types";

/** UI capabilities come from /auth/me. The backend independently enforces every operation. */
export function can(user: User | null | undefined, permission: string) {
  return Boolean(user?.permissions?.includes(permission));
}
export function canVisit(user: User | null | undefined, path: string) {
  if (path === "/") return can(user, "dashboard.read");
  const routes: Array<[string, string[]]> = [
    ["/notifications/new", ["notifications.draft"]],
    ["/notifications", ["notifications.read"]],
    ["/wellness-programs/new", ["wellness.manage"]],
    ["/wellness-programs", ["wellness.read"]],
    ["/employees", ["employees.read"]],
    ["/devices", ["devices.read"]],
    ["/templates", ["templates.read"]],
    ["/reports", ["reports.read"]],
    ["/whatsapp", ["channels.manage"]],
    ["/audit-logs", ["audit.read"]],
    ["/organization", ["organization.manage"]],
    ["/settings", ["settings.manage", "access.read", "packages.read"]],
  ];
  const match = routes.find(([prefix]) => path === prefix || path.startsWith(prefix + "/"));
  return Boolean(match?.[1].some((permission) => can(user, permission)));
}
