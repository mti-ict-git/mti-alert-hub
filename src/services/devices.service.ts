import { apiClient } from "@/services/api-client";
import { referenceService } from "@/services/reference.service";
import type {
  ApprovePendingDeviceRequest,
  ApprovePendingDeviceResponse,
  Device,
  DeviceRolloutDeleteResponse,
  PendingDeviceEnrollment,
  DeviceRolloutApplyResponse,
  DeviceRolloutPackage,
  DeviceRolloutUploadResponse,
  DeviceRolloutPreviewResponse,
  DeviceRolloutRequest,
  RejectPendingDeviceRequest,
  RejectPendingDeviceResponse,
} from "@/types";

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

type PendingDeviceEnrollmentApi = {
  id: string;
  deviceIdentifier: string;
  hostname: string;
  agentVersion?: string | null;
  employeeNumber?: string | null;
  activeUserIdentifier?: string | null;
  requestStatus: "Pending" | "Approved" | "Rejected";
  requestCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  decidedAt?: string | null;
  decidedByUserId?: string | null;
  decidedByUsername?: string | null;
  decisionReason?: string | null;
  approvedDeviceId?: string | null;
};

type PendingDeviceEnrollmentListResponse = {
  items: PendingDeviceEnrollmentApi[];
};

type DeviceTestNotificationResponse = {
  deviceId: string;
  deviceIdentifier?: string | null;
  hostname: string;
  communicationId: string;
  communicationStatus: "Queued" | "Scheduled" | "Active";
  title: string;
  instruction?: string | null;
};

type DeviceRolloutPackageListResponse = {
  items: DeviceRolloutPackage[];
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
  async listPending(): Promise<PendingDeviceEnrollment[]> {
    const response = await apiClient.get<PendingDeviceEnrollmentListResponse>(
      "/devices/pending?page=1&pageSize=200",
    );

    return response.items.map((item) => ({
      id: item.id,
      deviceIdentifier: item.deviceIdentifier,
      hostname: item.hostname,
      agentVersion: item.agentVersion ?? null,
      employeeNumber: item.employeeNumber ?? null,
      activeUserIdentifier: item.activeUserIdentifier ?? null,
      requestStatus: item.requestStatus,
      requestCount: item.requestCount,
      firstSeenAt: item.firstSeenAt,
      lastSeenAt: item.lastSeenAt,
      decidedAt: item.decidedAt ?? null,
      decidedByUserId: item.decidedByUserId ?? null,
      decidedByUsername: item.decidedByUsername ?? null,
      decisionReason: item.decisionReason ?? null,
      approvedDeviceId: item.approvedDeviceId ?? null,
    }));
  },
  async approvePending(
    requestId: string,
    payload: ApprovePendingDeviceRequest,
  ): Promise<ApprovePendingDeviceResponse> {
    return apiClient.post<ApprovePendingDeviceResponse>(
      `/devices/pending/${requestId}/approve`,
      payload,
    );
  },
  async rejectPending(
    requestId: string,
    payload: RejectPendingDeviceRequest = {},
  ): Promise<RejectPendingDeviceResponse> {
    return apiClient.post<RejectPendingDeviceResponse>(
      `/devices/pending/${requestId}/reject`,
      payload,
    );
  },
  async sendTest(id: string): Promise<DeviceTestNotificationResponse> {
    return apiClient.post<DeviceTestNotificationResponse>(`/devices/${id}/test-notification`, {});
  },
  async listRolloutPackages(): Promise<DeviceRolloutPackage[]> {
    const response = await apiClient.get<DeviceRolloutPackageListResponse>("/devices/rollout-packages/local");
    return response.items;
  },
  async uploadRolloutPackage(file: File): Promise<DeviceRolloutUploadResponse> {
    return apiClient.postRaw<DeviceRolloutUploadResponse>(
      "/devices/rollout-packages/upload",
      file,
      {
        "Content-Type": file.type || "application/octet-stream",
        "X-File-Name": file.name,
      },
    );
  },
  async deleteRolloutPackage(fileName: string): Promise<DeviceRolloutDeleteResponse> {
    return apiClient.del<DeviceRolloutDeleteResponse>(
      `/devices/rollout-packages/local/${encodeURIComponent(fileName)}`,
    );
  },
  async previewRollout(
    id: string,
    payload: DeviceRolloutRequest,
  ): Promise<DeviceRolloutPreviewResponse> {
    return apiClient.post<DeviceRolloutPreviewResponse>(`/devices/${id}/rollouts`, {
      ...payload,
      apply: false,
    });
  },
  async applyRollout(
    id: string,
    payload: DeviceRolloutRequest,
  ): Promise<DeviceRolloutApplyResponse> {
    return apiClient.post<DeviceRolloutApplyResponse>(`/devices/${id}/rollouts`, {
      ...payload,
      apply: true,
    });
  },
};
