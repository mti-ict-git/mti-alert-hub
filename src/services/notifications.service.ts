import type { AudiencePreview, DeliveryLog, Notification, Recipient } from "@/types";
import { apiClient } from "@/services/api-client";

type ApiCommunicationSummary = {
  id: string;
  communicationType: string;
  priority: "Info" | "Warning" | "Critical";
  title: string;
  status: string;
  scheduledAt?: string | null;
  templateId?: string | null;
  templateVersion?: number | null;
  channelSelections: Array<"WindowsAgent" | "WhatsApp" | "Email" | "DigitalSignage">;
};

type ApiCommunicationDetail = ApiCommunicationSummary & {
  body: string;
  category?: string | null;
  requiresResponse?: boolean;
  workflow?: { id: string } | null;
  targets: Array<{
    targetType: string;
    targetValue: string;
  }>;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type ApiListResponse = {
  items: ApiCommunicationSummary[];
};

type ApiAudiencePreview = AudiencePreview;

type CreateNotificationInput = Omit<
  Notification,
  "id" | "createdAt" | "createdBy" | "recipientsCount" | "ackCount" | "status"
> & { scheduleLater?: boolean; templateId?: string };

export const notificationsService = {
  async list(): Promise<Notification[]> {
    const response = await apiClient.get<ApiListResponse>("/communications");
    return response.items.map(mapSummaryToNotification);
  },
  async get(id: string): Promise<Notification | undefined> {
    const detail = await apiClient.get<ApiCommunicationDetail>(`/communications/${id}`);
    return mapDetailToNotification(detail);
  },
  async recipients(id: string): Promise<Recipient[]> {
    void id;
    return [];
  },
  async deliveryLogs(id: string): Promise<DeliveryLog[]> {
    void id;
    return [];
  },
  async audiencePreview(id: string): Promise<ApiAudiencePreview> {
    return apiClient.post<ApiAudiencePreview>(`/communications/${id}/audience-preview`);
  },
  async create(input: CreateNotificationInput): Promise<Notification> {
    const detail = await apiClient.post<ApiCommunicationDetail>("/communications", {
      communicationType: inferCommunicationType(input.category),
      priority: input.priority === "Emergency" ? "Critical" : input.priority,
      category: input.category,
      templateId: input.templateId ?? null,
      title: input.title,
      body: input.message,
      channelSelections: input.channels.map(mapChannelToApi),
      targets: buildTargetsFromNotification(input),
      workflowId: input.requireAck ? "11111111-1111-1111-1111-111111111111" : null,
      windowsAgentPresentation:
        input.priority === "Emergency" && input.channels.includes("DesktopAgent") ? "Modal" : null,
      deliveryStrategy: null,
    });

    return mapDetailToNotification(detail);
  },
  async cancel(id: string): Promise<void> {
    void id;
    throw new Error("Cancel communication belum tersedia di backend fase ini.");
  },
  async duplicate(id: string): Promise<Notification | undefined> {
    const detail = await apiClient.post<ApiCommunicationDetail>(`/communications/${id}/duplicate`);
    return mapDetailToNotification(detail);
  },
};

function mapSummaryToNotification(item: ApiCommunicationSummary): Notification {
  return {
    id: item.id,
    title: item.title,
    message: "",
    priority: mapPriorityFromApi(item.priority),
    category: "General",
    targetType: "Custom",
    channels: item.channelSelections.map(mapChannelFromApi),
    requireAck: false,
    scheduledAt: item.scheduledAt ?? null,
    status: mapStatusFromApi(item.status),
    createdBy: "System",
    createdAt: item.scheduledAt ?? new Date().toISOString(),
    recipientsCount: 0,
    ackCount: 0,
  };
}

function mapDetailToNotification(item: ApiCommunicationDetail): Notification {
  const primaryTarget = item.targets[0];
  return {
    id: item.id,
    title: item.title,
    message: item.body,
    priority: mapPriorityFromApi(item.priority),
    category: normalizeCategory(item.category),
    targetType: mapTargetTypeFromApi(primaryTarget?.targetType),
    targetSite: primaryTarget?.targetType === "Site" ? primaryTarget.targetValue : undefined,
    targetDepartment:
      primaryTarget?.targetType === "Department" ? primaryTarget.targetValue : undefined,
    targetSection: primaryTarget?.targetType === "Section" ? primaryTarget.targetValue : undefined,
    channels: item.channelSelections.map(mapChannelFromApi),
    requireAck: Boolean(item.requiresResponse || item.workflow?.id),
    scheduledAt: item.scheduledAt ?? null,
    instruction: item.workflow?.id ? "Response workflow configured by template or operator." : "",
    status: mapStatusFromApi(item.status),
    createdBy: "System",
    createdAt: item.createdAt ?? item.updatedAt ?? new Date().toISOString(),
    recipientsCount: 0,
    ackCount: 0,
  };
}

function mapPriorityFromApi(priority: ApiCommunicationSummary["priority"]): Notification["priority"] {
  return priority === "Critical" ? "Emergency" : priority;
}

function mapStatusFromApi(status: string): Notification["status"] {
  if (status === "Queued" || status === "Active" || status === "Completed") {
    return status;
  }

  return (status as Notification["status"]) ?? "Draft";
}

function mapChannelFromApi(
  channel: ApiCommunicationSummary["channelSelections"][number],
): Notification["channels"][number] {
  return channel === "WindowsAgent" ? "DesktopAgent" : channel;
}

function mapChannelToApi(channel: Notification["channels"][number]) {
  return channel === "DesktopAgent" ? "WindowsAgent" : channel;
}

function normalizeCategory(category?: string | null): Notification["category"] {
  const allowedCategories: Notification["category"][] = [
    "IT",
    "OHSE",
    "Security",
    "Operation",
    "HR",
    "General",
  ];

  return allowedCategories.includes(category as Notification["category"])
    ? (category as Notification["category"])
    : "General";
}

function mapTargetTypeFromApi(targetType?: string): Notification["targetType"] {
  switch (targetType) {
    case "All":
    case "Site":
    case "Department":
    case "Section":
      return targetType;
    case "Employee":
      return "Individual";
    default:
      return "Custom";
  }
}

function inferCommunicationType(category: Notification["category"]): ApiCommunicationDetail["communicationType"] {
  switch (category) {
    case "OHSE":
    case "Security":
      return "Alert";
    case "Operation":
      return "OperationalNotice";
    default:
      return "Reminder";
  }
}

function buildTargetsFromNotification(input: CreateNotificationInput) {
  switch (input.targetType) {
    case "All":
      return [{ targetType: "All", targetValue: "*" }];
    case "Site":
      return [{ targetType: "Site", targetValue: input.targetSite ?? "*" }];
    case "Department":
      return [{ targetType: "Department", targetValue: input.targetDepartment ?? "*" }];
    case "Section":
      return [{ targetType: "Section", targetValue: input.targetSection ?? "*" }];
    default:
      return [{ targetType: "Group", targetValue: "custom-selection" }];
  }
}
