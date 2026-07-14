import type { WorkflowDefinition } from "@/types";
import { apiClient } from "@/services/api-client";

type WorkflowListResponse = {
  items: WorkflowDefinition[];
};

export const workflowsService = {
  async list(): Promise<WorkflowDefinition[]> {
    const response = await apiClient.get<WorkflowListResponse>("/workflows?page=1&pageSize=200");
    return response.items;
  },
};
