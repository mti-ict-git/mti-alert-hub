import { apiClient } from "./api-client";
export type OrganizationKind = "sites" | "areas" | "departments" | "sections";
export type OrganizationEntry = {
  id: string;
  name: string;
  code: string | null;
  status: "Active" | "Inactive";
  parentId: string | null;
  sourceSystem: string | null;
  updatedAt: string;
  editable: boolean;
  employeeCount: number;
  deviceCount: number;
};
export type OrganizationData = Record<OrganizationKind, OrganizationEntry[]>;
export type OrganizationInput = Pick<OrganizationEntry, "name" | "status" | "parentId"> & {
  code: string;
  updatedAt?: string;
};
export const organizationService = {
  list: () => apiClient.get<OrganizationData>("/organization"),
  save: (kind: OrganizationKind, id: string | null, input: OrganizationInput) =>
    id
      ? apiClient.patch(`/organization/${kind}/${id}`, input)
      : apiClient.post(`/organization/${kind}`, input),
};
