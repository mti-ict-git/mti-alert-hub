import { apiClient } from "@/services/api-client";

type CommunicationType =
  | "Alert"
  | "Reminder"
  | "OperationalNotice"
  | "News"
  | "Article"
  | "KnowledgeUpdate";

type ApiContentTypeRollup = {
  communicationType: CommunicationType;
  communicationCount: number;
  activeCommunications: number;
  recipientCount: number;
  deliveredCount: number;
  readCount: number;
  respondedCount: number;
  failedCount: number;
  pendingResponseCount: number;
  overdueResponses: number;
};

type ApiContentTypeRollupResponse = {
  items: ApiContentTypeRollup[];
};

async function getContentTypeRollups() {
  const response = await apiClient.get<ApiContentTypeRollupResponse>("/dashboard/content-type-rollups");
  return response.items;
}

function formatCommunicationTypeLabel(value: CommunicationType) {
  switch (value) {
    case "OperationalNotice":
      return "Operational Notice";
    case "KnowledgeUpdate":
      return "Knowledge Update";
    default:
      return value;
  }
}

export const reportsService = {
  async deliveryByContentType() {
    const items = await getContentTypeRollups();
    return items.map((item) => ({
      name: formatCommunicationTypeLabel(item.communicationType),
      delivered: item.deliveredCount,
      failed: item.failedCount,
    }));
  },
  async responseByContentType() {
    const items = await getContentTypeRollups();
    return items.map((item) => ({
      name: formatCommunicationTypeLabel(item.communicationType),
      read: item.readCount,
      responded: item.respondedCount,
      overdue: item.overdueResponses,
    }));
  },
  async monitoringByContentType() {
    const items = await getContentTypeRollups();
    return items.map((item) => ({
      name: formatCommunicationTypeLabel(item.communicationType),
      active: item.activeCommunications,
      pending: item.pendingResponseCount,
      recipients: item.recipientCount,
    }));
  },
};
