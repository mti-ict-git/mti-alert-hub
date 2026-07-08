import { apiClient } from "@/services/api-client";
import { referenceService } from "@/services/reference.service";
import type { Employee } from "@/types";

type ApiEmployeeSummary = {
  id: string;
  employeeNumber: string;
  fullName: string;
  siteId?: string | null;
  areaId?: string | null;
  departmentId?: string | null;
  sectionId?: string | null;
  whatsappNumber?: string | null;
  email?: string | null;
  preferredChannels: Array<"WindowsAgent" | "WhatsApp" | "Email" | "DigitalSignage">;
};

type EmployeeListResponse = {
  items: ApiEmployeeSummary[];
};

export const employeesService = {
  async list(): Promise<Employee[]> {
    const [response, organizationReference] = await Promise.all([
      apiClient.get<EmployeeListResponse>("/employees?page=1&pageSize=200"),
      referenceService.getOrganizationReference(),
    ]);

    const sitesById = new Map(organizationReference.sites.map((item) => [item.id, item.name]));
    const areasById = new Map(organizationReference.areas.map((item) => [item.id, item.name]));
    const departmentsById = new Map(
      organizationReference.departments.map((item) => [item.id, item.name]),
    );
    const sectionsById = new Map(organizationReference.sections.map((item) => [item.id, item.name]));

    return response.items.map((item) => ({
      id: item.id,
      employeeId: item.employeeNumber,
      name: item.fullName,
      siteId: item.siteId ?? null,
      siteName: item.siteId ? sitesById.get(item.siteId) ?? item.siteId : null,
      areaId: item.areaId ?? null,
      areaName: item.areaId ? areasById.get(item.areaId) ?? item.areaId : null,
      departmentId: item.departmentId ?? null,
      departmentName: item.departmentId ? departmentsById.get(item.departmentId) ?? item.departmentId : null,
      sectionId: item.sectionId ?? null,
      sectionName: item.sectionId ? sectionsById.get(item.sectionId) ?? item.sectionId : null,
      phone: item.whatsappNumber ?? null,
      email: item.email ?? null,
      preferredChannels: item.preferredChannels,
      status: "Active",
    }));
  },
};
