import { z } from "zod";
import { AppError } from "../../../shared/errors/app-error.js";

export const accessRole = z.enum([
  "CentralAdmin",
  "ITOperator",
  "CommunicationOperator",
  "EmergencyOfficer",
  "ManagementViewer",
]);
export type AccessRole = z.infer<typeof accessRole>;
export const permissions = [
  "dashboard.read",
  "reports.read",
  "reports.export",
  "reports.recipients.read",
  "notifications.read",
  "notifications.draft",
  "notifications.publish",
  "notifications.cancel",
  "notifications.emergency",
  "wellness.read",
  "wellness.manage",
  "wellness.publish",
  "templates.read",
  "templates.manage",
  "employees.read",
  "devices.read",
  "devices.enroll",
  "devices.placement",
  "devices.revoke",
  "devices.test",
  "packages.read",
  "packages.import",
  "packages.delete",
  "rollouts.preview",
  "rollouts.apply",
  "rollouts.read",
  "organization.manage",
  "settings.manage",
  "channels.manage",
  "access.read",
  "access.manage",
  "audit.read",
] as const;
export type Permission = (typeof permissions)[number];
const common: Permission[] = [
  "dashboard.read",
  "reports.read",
  "reports.export",
  "reports.recipients.read",
  "notifications.read",
  "wellness.read",
  "templates.read",
];
const author: Permission[] = [
  "notifications.draft",
  "notifications.publish",
  "notifications.cancel",
  "employees.read",
];
export const rolePermissions: Record<AccessRole, readonly Permission[]> = {
  CentralAdmin: permissions,
  ITOperator: [
    ...common,
    ...author,
    "devices.read",
    "devices.enroll",
    "devices.placement",
    "devices.revoke",
    "devices.test",
    "packages.read",
    "packages.import",
    "rollouts.preview",
    "rollouts.apply",
    "rollouts.read",
  ],
  CommunicationOperator: [
    ...common,
    ...author,
    "wellness.manage",
    "wellness.publish",
    "templates.manage",
  ],
  EmergencyOfficer: [...common, ...author, "notifications.emergency", "devices.read"],
  ManagementViewer: common,
};
export const roleLabels: Record<AccessRole, string> = {
  CentralAdmin: "Administrator",
  ITOperator: "IT Operator",
  CommunicationOperator: "Communication Operator",
  EmergencyOfficer: "Emergency Officer",
  ManagementViewer: "Viewer",
};
export const grantSchema = z.discriminatedUnion("scopeType", [
  z.object({ scopeType: z.literal("Global"), scopeValue: z.literal("*") }).strict(),
  z.object({ scopeType: z.literal("Site"), scopeValue: z.string().uuid() }).strict(),
  z.object({ scopeType: z.literal("Area"), scopeValue: z.string().uuid() }).strict(),
]);
export type AccessGrant = z.infer<typeof grantSchema>;
export const assignmentSchema = z
  .object({
    roleId: accessRole,
    scopes: z.array(grantSchema).min(1).max(500),
    expectedRevision: z.number().int().positive(),
    reason: z.string().trim().min(5).max(500),
  })
  .strict()
  .superRefine((value, context) => {
    const global = value.scopes.some((s) => s.scopeType === "Global");
    if (global && value.scopes.length !== 1)
      context.addIssue({
        code: "custom",
        path: ["scopes"],
        message: "Global cannot be combined with local scopes.",
      });
    if (value.roleId === "CentralAdmin" && !global)
      context.addIssue({
        code: "custom",
        path: ["scopes"],
        message: "Administrators require Global scope.",
      });
    if (
      new Set(value.scopes.map((s) => s.scopeType + ":" + s.scopeValue)).size !==
      value.scopes.length
    )
      context.addIssue({ code: "custom", path: ["scopes"], message: "Duplicate scope grants." });
  });
export function requirePermission(role: string, permission: Permission) {
  if (
    !accessRole.safeParse(role).success ||
    !rolePermissions[role as AccessRole].includes(permission)
  )
    throw new AppError({
      statusCode: 403,
      code: "FORBIDDEN",
      message: "You do not have permission to perform this action.",
    });
}
export function allowsLocation(
  scopes: readonly AccessGrant[],
  siteId: string | null,
  areaId: string | null,
): boolean {
  return scopes.some(
    (s) =>
      s.scopeType === "Global" ||
      (s.scopeType === "Site" && siteId === s.scopeValue) ||
      (s.scopeType === "Area" && areaId === s.scopeValue),
  );
}
export function requiresEmergencyPermission(
  priority: string,
  criticalBehavior: string | null,
): boolean {
  return (
    ["critical", "emergency"].includes(priority.toLowerCase()) ||
    Boolean(criticalBehavior && !["none", "off", "normal"].includes(criticalBehavior.toLowerCase()))
  );
}
