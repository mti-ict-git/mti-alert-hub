import { AppError } from "../../../shared/errors/app-error.js";
import type { AccessProfile, AdminRoleType } from "../model/admin-access.js";

export function requireRole(
  accessProfile: AccessProfile,
  allowedRoles: AdminRoleType[],
): void {
  if (allowedRoles.includes(accessProfile.roleType)) {
    return;
  }

  throw new AppError({
    statusCode: 403,
    code: "FORBIDDEN",
    message: "The current session is not allowed to access this resource.",
  });
}

export function hasGlobalScope(accessProfile: AccessProfile): boolean {
  return accessProfile.scopes.some(
    (scope) => scope.scopeType === "Global" && scope.scopeValue === "*",
  );
}
