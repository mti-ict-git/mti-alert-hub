import { apiClient } from "@/services/api-client";

export type DashboardOverview = {
  activeCommunications: number;
  recipientsPending: number;
  deliveredCount: number;
  respondedCount: number;
  failedCount: number;
  overdueResponses: number;
};

export const dashboardService = {
  async overview(): Promise<DashboardOverview> {
    return apiClient.get<DashboardOverview>("/dashboard/overview");
  },
};
