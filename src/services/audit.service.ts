import type { AuditLog } from "@/types";
import { apiClient } from "@/services/api-client";

type ApiAuditLogRecord = AuditLog;
type ApiAuditLogListResponse = {
  items: ApiAuditLogRecord[];
};

export const auditService = {
  async list(): Promise<AuditLog[]> {
    const response = await apiClient.get<ApiAuditLogListResponse>("/audit-logs?page=1&pageSize=200");
    return response.items;
  },
};
