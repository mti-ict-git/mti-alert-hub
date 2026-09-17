import type { ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { can } from "@/lib/access";
export function PermissionGate({
  permission,
  children,
}: {
  permission: string;
  children: ReactNode;
}) {
  const { user } = useAuth();
  return can(user, permission) ? children : null;
}
