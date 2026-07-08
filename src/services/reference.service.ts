import { apiClient } from "@/services/api-client";

export type SiteReference = {
  id: string;
  code: string;
  name: string;
};

export type AreaReference = {
  id: string;
  code?: string | null;
  name: string;
  siteId: string;
};

export type DepartmentReference = {
  id: string;
  code?: string | null;
  name: string;
  siteId?: string | null;
};

export type SectionReference = {
  id: string;
  code?: string | null;
  name: string;
  departmentId?: string | null;
};

export type EmployeeReference = {
  id: string;
  employeeNumber: string;
  fullName: string;
  siteId?: string | null;
  areaId?: string | null;
  departmentId?: string | null;
  sectionId?: string | null;
  whatsappNumber?: string | null;
  email?: string | null;
  preferredPrimaryChannel?: string | null;
  preferredSecondaryChannel?: string | null;
};

type OrganizationReferenceResponse = {
  sites: SiteReference[];
  areas: AreaReference[];
  departments: DepartmentReference[];
  sections: SectionReference[];
};

type EmployeeListResponse = {
  items: EmployeeReference[];
};

export const referenceService = {
  async getOrganizationReference(): Promise<OrganizationReferenceResponse> {
    return apiClient.get<OrganizationReferenceResponse>("/reference/organization");
  },
  async listEmployees(): Promise<EmployeeReference[]> {
    const response = await apiClient.get<EmployeeListResponse>("/employees?page=1&pageSize=200");
    return response.items;
  },
};
