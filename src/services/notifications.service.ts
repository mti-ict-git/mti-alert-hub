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

type ApiPageMeta = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

type ApiDeliveryRecord = {
  deliveryJobId: string;
  recipientId: string;
  recipientName: string;
  recipientType?: "Device" | "Employee" | "ContactEndpoint";
  employeeId?: string | null;
  employeeNumber?: string | null;
  departmentName?: string | null;
  sectionName?: string | null;
  siteName?: string | null;
  areaName?: string | null;
  channel: ApiCommunicationSummary["channelSelections"][number];
  deliveryStrategy?: string | null;
  jobStatus: string;
  lastUpdatedAt: string;
  lastEventType?: string | null;
  lastEventSource?: string | null;
  detail: string;
};

type ApiDeliveryRecipient = {
  recipientId: string;
  recipientType: "Device" | "Employee" | "ContactEndpoint";
  employeeId?: string | null;
  deviceId?: string | null;
  employeeNumber?: string | null;
  recipientName: string;
  departmentName?: string | null;
  sectionName?: string | null;
  siteName?: string | null;
  areaName?: string | null;
  ackState: string;
  responseState: "NotRequired" | "AwaitingResponse" | "Responded";
  channels: Array<ApiCommunicationSummary["channelSelections"][number]>;
  latestJobStatus: string;
  lastUpdatedAt?: string | null;
};

type ApiDeliveryEvent = {
  eventId: string;
  deliveryJobId: string;
  recipientId: string;
  recipientName: string;
  channel: ApiCommunicationSummary["channelSelections"][number];
  eventType: string;
  eventSource: string;
  occurredAt: string;
  detail: string;
};

type ApiDeliveryVisibilityResponse = {
  items: ApiDeliveryRecord[];
  recipients: ApiDeliveryRecipient[];
  events: ApiDeliveryEvent[];
  page: ApiPageMeta;
};

type DeliveryVisibility = {
  items: ApiDeliveryRecord[];
  recipients: Recipient[];
  logs: DeliveryLog[];
  page: ApiPageMeta;
};

type CreateNotificationInput = Omit<
  Notification,
  "id" | "createdAt" | "createdBy" | "recipientsCount" | "ackCount" | "status"
> & {
  scheduleLater?: boolean;
  templateId?: string;
  communicationType?: ApiCommunicationDetail["communicationType"];
};

type UpdateNotificationInput = Partial<CreateNotificationInput>;

type PublishNotificationInput =
  | {
      publishMode: "Now";
      confirmedPreview: boolean;
    }
  | {
      publishMode: "Scheduled";
      scheduledAt: string;
      timezone: string;
      confirmedPreview: boolean;
    };

export const notificationsService = {
  async list(): Promise<Notification[]> {
    const response = await apiClient.get<ApiListResponse>("/communications");
    return response.items.map(mapSummaryToNotification);
  },
  async get(id: string): Promise<Notification | undefined> {
    const detail = await apiClient.get<ApiCommunicationDetail>(`/communications/${id}`);
    return mapDetailToNotification(detail);
  },
  async deliveryVisibility(id: string): Promise<DeliveryVisibility> {
    const response = await apiClient.get<ApiDeliveryVisibilityResponse>(
      `/communications/${id}/deliveries?page=1&pageSize=200`,
    );

    return {
      items: response.items,
      recipients: response.recipients.map((recipient) => mapDeliveryRecipientToRecipient(id, recipient)),
      logs: response.events.map((event) => mapDeliveryEventToLog(id, event)),
      page: response.page,
    };
  },
  async recipients(id: string): Promise<Recipient[]> {
    return (await this.deliveryVisibility(id)).recipients;
  },
  async deliveryLogs(id: string): Promise<DeliveryLog[]> {
    return (await this.deliveryVisibility(id)).logs;
  },
  async audiencePreview(id: string): Promise<ApiAudiencePreview> {
    return apiClient.post<ApiAudiencePreview>(`/communications/${id}/audience-preview`);
  },
  async create(input: CreateNotificationInput): Promise<Notification> {
    const detail = await apiClient.post<ApiCommunicationDetail>("/communications", {
      ...buildCreatePayload(input),
      templateId: input.templateId ?? null,
    });

    return mapDetailToNotification(detail);
  },
  async update(id: string, input: UpdateNotificationInput): Promise<Notification> {
    const detail = await apiClient.patch<ApiCommunicationDetail>(
      `/communications/${id}`,
      buildUpdatePayload(input),
    );
    return mapDetailToNotification(detail);
  },
  async publish(id: string, input: PublishNotificationInput): Promise<Notification> {
    const detail = await apiClient.post<ApiCommunicationDetail>(`/communications/${id}/publish`, input);
    return mapDetailToNotification(detail);
  },
  async cancel(id: string): Promise<Notification> {
    const detail = await apiClient.post<ApiCommunicationDetail>(`/communications/${id}/cancel`);
    return mapDetailToNotification(detail);
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
    templateId: item.templateId ?? null,
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
    targetArea: primaryTarget?.targetType === "Area" ? primaryTarget.targetValue : undefined,
    targetDepartment:
      primaryTarget?.targetType === "Department" ? primaryTarget.targetValue : undefined,
    targetSection: primaryTarget?.targetType === "Section" ? primaryTarget.targetValue : undefined,
    targetEmployeeId:
      primaryTarget?.targetType === "Employee" ? primaryTarget.targetValue : undefined,
    channels: item.channelSelections.map(mapChannelFromApi),
    requireAck: Boolean(item.requiresResponse || item.workflow?.id),
    scheduledAt: item.scheduledAt ?? null,
    instruction: item.workflow?.id ? "Response workflow configured by template or operator." : "",
    status: mapStatusFromApi(item.status),
    templateId: item.templateId ?? null,
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
    case "Area":
    case "Department":
    case "Section":
    case "Employee":
      return targetType;
    default:
      return "Custom";
  }
}

function mapDeliveryRecipientToRecipient(
  notificationId: string,
  recipient: ApiDeliveryRecipient,
): Recipient {
  const channels = recipient.channels.map(mapChannelFromApi);

  return {
    id: recipient.recipientId,
    notificationId,
    employeeId: recipient.employeeNumber ?? recipient.employeeId ?? recipient.recipientId,
    name: recipient.recipientName,
    department: recipient.departmentName ?? "—",
    section: recipient.sectionName ?? "—",
    site: recipient.siteName ?? "—",
    area: recipient.areaName ?? "—",
    channel: channels[0] ?? "DesktopAgent",
    channels,
    recipientType: recipient.recipientType,
    deliveryStatus: mapDeliveryStatusFromApi(recipient.latestJobStatus),
    ackStatus: mapAckStatusFromApi(recipient.ackState),
    responseState: recipient.responseState,
    responseTime: recipient.lastUpdatedAt ?? undefined,
  };
}

function mapDeliveryEventToLog(notificationId: string, event: ApiDeliveryEvent): DeliveryLog {
  return {
    id: event.eventId,
    notificationId,
    time: event.occurredAt,
    channel: mapChannelFromApi(event.channel),
    target: event.recipientName,
    status: mapDeliveryStatusFromApi(event.eventType),
    detail: event.detail,
  };
}

function mapDeliveryStatusFromApi(status: string): DeliveryLog["status"] {
  switch (status) {
    case "Pending":
    case "Sent":
    case "Delivered":
    case "Displayed":
    case "Read":
    case "Responded":
    case "Failed":
      return status;
    default:
      return "Pending";
  }
}

function mapAckStatusFromApi(status: string): Recipient["ackStatus"] {
  switch (status) {
    case "Safe":
    case "NeedAssistance":
    case "NotInArea":
    case "Acknowledged":
      return status;
    case "Pending":
    default:
      return "NoResponse";
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

function buildCreatePayload(input: CreateNotificationInput) {
  return {
    communicationType: input.communicationType ?? inferCommunicationType(input.category),
    priority: input.priority === "Emergency" ? "Critical" : input.priority,
    category: input.category,
    title: input.title,
    body: input.message,
    channelSelections: input.channels.map(mapChannelToApi),
    targets: buildTargetsFromNotification(input),
    workflowId: input.requireAck ? "11111111-1111-1111-1111-111111111111" : null,
    windowsAgentPresentation:
      input.priority === "Emergency" && input.channels.includes("DesktopAgent") ? "Modal" : null,
    deliveryStrategy: null,
  };
}

function buildUpdatePayload(input: UpdateNotificationInput) {
  const payload: Record<string, unknown> = {};

  if (input.category) {
    payload.category = input.category;
  }

  if (input.title !== undefined) {
    payload.title = input.title;
  }

  if (input.message !== undefined) {
    payload.body = input.message;
  }

  if (input.channels) {
    payload.channelSelections = input.channels.map(mapChannelToApi);
    payload.windowsAgentPresentation =
      input.priority === "Emergency" && input.channels.includes("DesktopAgent") ? "Modal" : null;
  } else if (input.priority === "Emergency") {
    payload.windowsAgentPresentation = "Modal";
  }

  if (input.targetType) {
    payload.targets = buildTargetsFromNotification(input);
  }

  if (input.requireAck !== undefined) {
    payload.workflowId = input.requireAck ? "11111111-1111-1111-1111-111111111111" : null;
  }

  return payload;
}

function buildTargetsFromNotification(input: UpdateNotificationInput) {
  switch (input.targetType) {
    case "All":
      return [{ targetType: "All", targetValue: "*" }];
    case "Site":
      return [{ targetType: "Site", targetValue: input.targetSite ?? "*" }];
    case "Area":
      return [{ targetType: "Area", targetValue: input.targetArea ?? "*" }];
    case "Department":
      return [{ targetType: "Department", targetValue: input.targetDepartment ?? "*" }];
    case "Section":
      return [{ targetType: "Section", targetValue: input.targetSection ?? "*" }];
    case "Employee":
    case "Individual":
      return [{ targetType: "Employee", targetValue: input.targetEmployeeId ?? "*" }];
    default:
      return [{ targetType: "Group", targetValue: "custom-selection" }];
  }
}
