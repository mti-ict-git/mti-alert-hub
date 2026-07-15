import { apiClient } from "@/services/api-client";
import { referenceService } from "@/services/reference.service";
import type { Device } from "@/types";

type ApiDevice = {
  id: string;
  primaryEmployeeId?: string | null;
  deviceIdentifier?: string | null;
  hostname: string;
  siteId: string;
  areaId?: string | null;
  locationLabel?: string | null;
  ownershipMode: "LocationOwned" | "EmployeeAssigned" | "Mixed";
  agentVersion?: string | null;
  lastHeartbeatAt?: string | null;
  lastConnectionAt?: string | null;
  status: "Online" | "Offline" | "Stale";
};

type DeviceListResponse = {
  items: ApiDevice[];
};

type DeviceTestNotificationResponse = {
  deviceId: string;
  deviceIdentifier?: string | null;
  hostname: string;
  communicationId: string;
  communicationStatus: "Queued" | "Scheduled" | "Active";
  title: string;
};

export const devicesService = {
  async list(): Promise<Device[]> {
    const [response, organizationReference, employees] = await Promise.all([
      apiClient.get<DeviceListResponse>("/devices?page=1&pageSize=200"),
      referenceService.getOrganizationReference(),
      referenceService.listEmployees(),
    ]);

    const sitesById = new Map(organizationReference.sites.map((item) => [item.id, item.name]));
    const areasById = new Map(organizationReference.areas.map((item) => [item.id, item.name]));
    const employeesById = new Map(employees.map((item) => [item.id, item.fullName]));

    return response.items.map((item) => ({
      id: item.id,
      deviceId: item.deviceIdentifier ?? item.id,
      hostname: item.hostname,
      siteId: item.siteId,
      siteName: sitesById.get(item.siteId) ?? item.siteId,
      areaId: item.areaId ?? null,
      areaName: item.areaId ? areasById.get(item.areaId) ?? item.areaId : null,
      locationLabel: item.locationLabel ?? null,
      ownershipMode: item.ownershipMode,
      primaryEmployeeId: item.primaryEmployeeId ?? null,
      primaryEmployeeName: item.primaryEmployeeId
        ? employeesById.get(item.primaryEmployeeId) ?? item.primaryEmployeeId
        : null,
      agentVersion: item.agentVersion ?? null,
      status: item.status,
      lastSeen: item.lastHeartbeatAt ?? item.lastConnectionAt ?? null,
    }));
  },
  async sendTest(id: string): Promise<DeviceTestNotificationResponse> {
    return apiClient.post<DeviceTestNotificationResponse>(`/devices/${id}/test-notification`, {});
  },
};
