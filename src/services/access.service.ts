import { apiClient } from "./api-client";

export type AccessRole =
  "CentralAdmin" | "ITOperator" | "CommunicationOperator" | "EmergencyOfficer" | "ManagementViewer";
export type AccessScope = { scopeType: "Global" | "Site" | "Area"; scopeValue: string };
export type AccessUser = {
  id: string;
  username: string;
  fullName: string;
  email: string | null;
  status: "Pending" | "Active" | "Disabled";
  roleId: AccessRole | null;
  revision: number;
  authorizationVersion: number;
  lastLoginAt: string | null;
  isLastAdministrator?: boolean;
  scopes: AccessScope[];
  legacyScopes?: { scopeType: string; scopeValue: string }[];
};
export type RoleDefinition = { id: AccessRole; label: string; permissions: string[] };
export type AccessQuery = {
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
  roleId?: string;
  siteId?: string;
};
export type DirectoryUser = {
  directoryId: string;
  directorySubjectId: string;
  username: string;
  fullName: string;
  email: string | null;
  existingUserId?: string | null;
  existingStatus?: string | null;
};
export const accessService = {
  searchDirectory: (search: string) =>
    apiClient.get<{ items: DirectoryUser[] }>(
      "/access/directory-users?search=" + encodeURIComponent(search),
    ),
  grant: (payload: unknown, key: string) =>
    apiClient.post<AccessUser>("/access/users", payload, { "Idempotency-Key": key }),

  list(query: AccessQuery) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query))
      if (value !== "" && value !== undefined) params.set(key, String(value));
    return apiClient.get<{ items: AccessUser[]; page: number; pageSize: number; total: number }>(
      "/access/users?" + params,
    );
  },
  roles: () => apiClient.get<{ items: RoleDefinition[] }>("/access/roles"),
  detail: (id: string) => apiClient.get<AccessUser>("/access/users/" + encodeURIComponent(id)),
  async change(
    id: string,
    operation: "assignment" | "status" | "revoke",
    payload: unknown,
    idempotencyKey: string,
  ): Promise<AccessUser> {
    const path =
      "/access/users/" +
      encodeURIComponent(id) +
      "/" +
      (operation === "revoke" ? "revoke-sessions" : operation);
    const headers = { "Idempotency-Key": idempotencyKey };
    return operation === "revoke"
      ? apiClient.post<AccessUser>(path, payload, headers)
      : apiClient.patch<AccessUser>(path, payload, headers);
  },
};
