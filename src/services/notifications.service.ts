import type {
  AudiencePreview,
  DeliveryLog,
  Notification,
  Recipient,
  ReminderActivity,
  ResponseRecord,
  WellnessProgramReportDetail,
  WellnessProgramListItem,
  WellnessProgram,
} from "@/types";
import { apiClient } from "@/services/api-client";
import { buildWellnessMonitoringSummary } from "@/lib/wellness-monitoring";

type ApiCommunicationSummary = {
  id: string;
  communicationType: string;
  priority: "Info" | "Warning" | "Critical";
  title: string;
  status: string;
  category?: string | null;
  scheduledAt?: string | null;
  templateId?: string | null;
  templateVersion?: number | null;
  channelSelections: Array<"WindowsAgent" | "WhatsApp" | "Email" | "DigitalSignage">;
  createdAt?: string | null;
  recipientsCount?: number;
  ackCount?: number;
};

type ApiCommunicationDetail = ApiCommunicationSummary & {
  body: string;
  instruction?: string | null;
  windowsAgentPresentation?: "Toast" | "Modal" | "Fullscreen" | null;
  toastAutoDismissSeconds?: number | null;
  wellnessProgram?: ApiWellnessProgram | null;
  category?: string | null;
  requiresResponse?: boolean;
  workflow?: { id: string } | null;
  schedule?: {
    scheduleType: "Immediate" | "Scheduled" | "Recurring";
    scheduledAt?: string | null;
    recurrenceRule?: string | null;
    timezone?: string | null;
    executionMode?: "ServerGenerated" | "AgentLocalRoutine" | null;
    distributionMode?: "Synchronized" | "Staggered" | null;
    staggerWindowMinutes?: number | null;
    scheduleVersion: number;
    validFrom?: string | null;
    validUntil?: string | null;
    isActive: boolean;
  } | null;
  targets: Array<{
    targetType: string;
    targetValue: string;
  }>;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type ApiWellnessProgram = WellnessProgram;

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
  deviceId?: string | null;
  deviceIdentifier?: string | null;
  hostname?: string | null;
  channelEndpoint?: string | null;
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
  deviceIdentifier?: string | null;
  hostname?: string | null;
  channelEndpoint?: string | null;
  employeeNumber?: string | null;
  recipientName: string;
  departmentName?: string | null;
  sectionName?: string | null;
  siteName?: string | null;
  areaName?: string | null;
  ackState: string;
  responseState: "NotRequired" | "AwaitingResponse" | "Overdue" | "Responded";
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

type ApiRecipientResponse = {
  id: string;
  recipientId: string;
  channel: ApiCommunicationSummary["channelSelections"][number];
  responseOptionKey: string;
  actorUserIdentifier?: string | null;
  responseNote?: string | null;
  respondedAt: string;
};

type ApiResponseListResponse = {
  items: ApiRecipientResponse[];
  page: ApiPageMeta;
};

type ApiReminderPolicySummary = {
  policyId: string;
  deviceId: string;
  deviceIdentifier?: string | null;
  hostname?: string | null;
  scheduleVersion: number;
  recurrenceRule: string;
  timezone: string;
  validFrom?: string | null;
  validUntil?: string | null;
  isActive: boolean;
  lastSyncedAt?: string | null;
  updatedAt?: string | null;
};

type ApiReminderEventRecord = {
  eventId: string;
  policyId: string;
  deviceId: string;
  deviceIdentifier?: string | null;
  hostname?: string | null;
  eventType:
    | "Triggered"
    | "Displayed"
    | "Read"
    | "Dismissed"
    | "Snoozed"
    | "Responded"
    | "Started"
    | "StepAdvanced"
    | "Completed"
    | "TimedOut";
  occurredAt: string;
  reportedAt: string;
  activeUserIdentifier?: string | null;
  metadata?: Record<string, unknown> | null;
};

type ApiReminderActivityResponse = {
  policies: ApiReminderPolicySummary[];
  events: ApiReminderEventRecord[];
};

type ApiWellnessReportingResponse = WellnessProgramReportDetail;

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
    }
  | {
      publishMode: "Recurring";
      scheduledAt?: string | null;
      recurrenceRule: string;
      timezone: string;
      executionMode: "ServerGenerated" | "AgentLocalRoutine";
      distributionMode?: "Synchronized" | "Staggered";
      staggerWindowMinutes?: number | null;
      validUntil?: string | null;
      confirmedPreview: boolean;
    };

export const notificationsService = {
  async list(): Promise<Notification[]> {
    const response = await apiClient.get<ApiListResponse>("/communications");
    return response.items.map(mapSummaryToNotification);
  },
  async listNotificationCenterItems(): Promise<Notification[]> {
    const items = await notificationsService.list();
    const details = await Promise.all(items.map((item) => notificationsService.get(item.id)));
    return details.filter((item): item is Notification => Boolean(item && !item.wellnessProgram));
  },
  async listWellnessPrograms(): Promise<WellnessProgramListItem[]> {
    const items = await notificationsService.list();
    const reminderSummaries = items.filter((item) => item.communicationType === "Reminder");
    const details = await Promise.all(
      reminderSummaries.map((item) => notificationsService.get(item.id)),
    );
    const wellnessItems = details.filter((item): item is Notification =>
      Boolean(item?.wellnessProgram),
    );
    const monitoringItems = await Promise.all(
      wellnessItems.map(async (item) => {
        const reminderActivity =
          item.communicationType === "Reminder"
            ? await notificationsService.reminderActivity(item.id).catch(() => null)
            : null;

        return {
          notification: item,
          lastUpdatedAt: item.updatedAt ?? item.createdAt,
          monitoring: buildWellnessMonitoringSummary(reminderActivity),
        };
      }),
    );

    return monitoringItems.sort(
      (left, right) =>
        new Date(right.lastUpdatedAt).getTime() - new Date(left.lastUpdatedAt).getTime(),
    );
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
      recipients: response.recipients.map((recipient) =>
        mapDeliveryRecipientToRecipient(id, recipient),
      ),
      logs: response.events.map((event) => mapDeliveryEventToLog(id, event)),
      page: response.page,
    };
  },
  async recipients(id: string): Promise<Recipient[]> {
    return (await notificationsService.deliveryVisibility(id)).recipients;
  },
  async deliveryLogs(id: string): Promise<DeliveryLog[]> {
    return (await notificationsService.deliveryVisibility(id)).logs;
  },
  async responses(id: string): Promise<ResponseRecord[]> {
    const [response, deliveryVisibility] = await Promise.all([
      apiClient.get<ApiResponseListResponse>(`/communications/${id}/responses?page=1&pageSize=200`),
      notificationsService.deliveryVisibility(id),
    ]);
    const recipientNames = new Map(
      deliveryVisibility.recipients.map((recipient) => [recipient.id, recipient.name]),
    );

    return response.items.map((item) => ({
      id: item.id,
      notificationId: id,
      recipientId: item.recipientId,
      recipientName: recipientNames.get(item.recipientId) ?? item.recipientId,
      channel: mapChannelFromApi(item.channel),
      responseOptionKey: item.responseOptionKey,
      actorUserIdentifier: item.actorUserIdentifier ?? null,
      responseNote: item.responseNote ?? null,
      respondedAt: item.respondedAt,
    }));
  },
  async reminderActivity(id: string): Promise<ReminderActivity> {
    const response = await apiClient.get<ApiReminderActivityResponse>(
      `/communications/${id}/reminder-activity`,
    );

    return {
      policies: response.policies,
      events: response.events,
    };
  },
  async wellnessReporting(id: string): Promise<WellnessProgramReportDetail> {
    return apiClient.get<ApiWellnessReportingResponse>(`/communications/${id}/wellness-reporting`);
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
    const detail = await apiClient.post<ApiCommunicationDetail>(
      `/communications/${id}/publish`,
      input,
    );
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
    communicationType: item.communicationType as Notification["communicationType"],
    title: item.title,
    message: "",
    priority: mapPriorityFromApi(item.priority),
    category: normalizeCategory(item.category),
    targetType: "Custom",
    channels: item.channelSelections.map(mapChannelFromApi),
    requireAck: false,
    scheduledAt: item.scheduledAt ?? null,
    reminderSchedule: null,
    status: mapStatusFromApi(item.status),
    templateId: item.templateId ?? null,
    createdBy: "System",
    createdAt: item.createdAt ?? item.scheduledAt ?? new Date().toISOString(),
    updatedAt: item.createdAt ?? item.scheduledAt ?? new Date().toISOString(),
    recipientsCount: item.recipientsCount ?? 0,
    ackCount: item.ackCount ?? 0,
  };
}

function mapDetailToNotification(item: ApiCommunicationDetail): Notification {
  const primaryTarget = item.targets[0];
  const deviceTargets = item.targets
    .filter((target) => target.targetType === "Device")
    .map((target) => target.targetValue);

  return {
    id: item.id,
    communicationType: item.communicationType as Notification["communicationType"],
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
    targetDeviceId: primaryTarget?.targetType === "Device" ? primaryTarget.targetValue : undefined,
    targetDeviceIds: deviceTargets,
    workflowId: item.workflow?.id ?? null,
    requireAck: Boolean(item.requiresResponse || item.workflow?.id),
    windowsAgentPresentation: item.windowsAgentPresentation ?? null,
    toastAutoDismissSeconds: item.toastAutoDismissSeconds ?? null,
    wellnessProgram: item.wellnessProgram ?? null,
    scheduledAt: item.scheduledAt ?? null,
    reminderSchedule: item.schedule ?? null,
    instruction: item.instruction ?? "",
    status: mapStatusFromApi(item.status),
    templateId: item.templateId ?? null,
    createdBy: "System",
    createdAt: item.createdAt ?? item.updatedAt ?? new Date().toISOString(),
    updatedAt: item.updatedAt ?? item.createdAt ?? null,
    recipientsCount: 0,
    ackCount: 0,
  };
}

function mapPriorityFromApi(
  priority: ApiCommunicationSummary["priority"],
): Notification["priority"] {
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
    case "Device":
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
    deviceId: recipient.deviceId ?? null,
    deviceIdentifier: recipient.deviceIdentifier ?? null,
    hostname: recipient.hostname ?? null,
    channelEndpoint: recipient.channelEndpoint ?? null,
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
    case "Overdue":
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

function inferCommunicationType(
  category: Notification["category"],
): ApiCommunicationDetail["communicationType"] {
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
  const normalizedDesktopAgent = normalizeDesktopAgentAuthoringInput({
    priority: input.priority,
    channels: input.channels,
    instruction: input.instruction,
    windowsAgentPresentation: input.windowsAgentPresentation,
    toastAutoDismissSeconds: input.toastAutoDismissSeconds,
  });

  return {
    communicationType: input.communicationType ?? inferCommunicationType(input.category),
    priority: input.priority === "Emergency" ? "Critical" : input.priority,
    category: input.category,
    title: input.title,
    body: input.message,
    instruction: normalizedDesktopAgent.instruction,
    channelSelections: input.channels.map(mapChannelToApi),
    targets: buildTargetsFromNotification(input),
    workflowId: input.requireAck ? (input.workflowId ?? null) : null,
    windowsAgentPresentation: normalizedDesktopAgent.windowsAgentPresentation,
    toastAutoDismissSeconds: normalizedDesktopAgent.toastAutoDismissSeconds,
    wellnessProgram: mapWellnessProgramToApi(input.wellnessProgram),
    deliveryStrategy: null,
    reminderSchedule: mapReminderScheduleInputToApi(input.reminderSchedule),
  };
}

function buildUpdatePayload(input: UpdateNotificationInput) {
  const payload: Record<string, unknown> = {};
  const normalizedDesktopAgent = normalizeDesktopAgentAuthoringInput({
    priority: input.priority,
    channels: input.channels,
    instruction: input.instruction,
    windowsAgentPresentation: input.windowsAgentPresentation,
    toastAutoDismissSeconds: input.toastAutoDismissSeconds,
  });

  if (input.priority !== undefined) {
    payload.priority = input.priority === "Emergency" ? "Critical" : input.priority;
  }

  if (input.category) {
    payload.category = input.category;
  }

  if (input.title !== undefined) {
    payload.title = input.title;
  }

  if (input.message !== undefined) {
    payload.body = input.message;
  }

  if (input.instruction !== undefined) {
    payload.instruction = normalizedDesktopAgent.instruction;
  }

  if (input.channels) {
    payload.channelSelections = input.channels.map(mapChannelToApi);
    payload.windowsAgentPresentation = normalizedDesktopAgent.windowsAgentPresentation;
  } else if (input.windowsAgentPresentation !== undefined) {
    payload.windowsAgentPresentation = normalizedDesktopAgent.windowsAgentPresentation;
  }

  if (
    input.channels !== undefined ||
    input.windowsAgentPresentation !== undefined ||
    input.toastAutoDismissSeconds !== undefined
  ) {
    payload.toastAutoDismissSeconds = normalizedDesktopAgent.toastAutoDismissSeconds;
  }

  if (input.targetType) {
    payload.targets = buildTargetsFromNotification(input);
  }

  if (input.requireAck !== undefined) {
    payload.workflowId = input.requireAck ? (input.workflowId ?? null) : null;
  }

  if (input.reminderSchedule !== undefined) {
    payload.reminderSchedule = mapReminderScheduleInputToApi(input.reminderSchedule);
  }

  if (input.wellnessProgram !== undefined) {
    payload.wellnessProgram = mapWellnessProgramToApi(input.wellnessProgram);
  }

  return payload;
}

function normalizeDesktopAgentAuthoringInput(input: {
  priority?: Notification["priority"];
  channels?: Notification["channels"];
  instruction?: string | null;
  windowsAgentPresentation?: Notification["windowsAgentPresentation"];
  toastAutoDismissSeconds?: Notification["toastAutoDismissSeconds"];
}) {
  const hasDesktopAgentChannel = input.channels?.includes("DesktopAgent") ?? false;
  if (!hasDesktopAgentChannel) {
    return {
      instruction: input.instruction ?? null,
      windowsAgentPresentation: null,
      toastAutoDismissSeconds: null,
    };
  }

  if (input.priority === "Warning") {
    return {
      instruction: input.instruction ?? null,
      windowsAgentPresentation: "Modal" as const,
      toastAutoDismissSeconds: null,
    };
  }

  if (input.priority === "Info") {
    const presentation = input.windowsAgentPresentation ?? "Toast";
    return {
      instruction: presentation === "Toast" ? null : (input.instruction ?? null),
      windowsAgentPresentation: presentation,
      toastAutoDismissSeconds:
        presentation === "Toast" ? (input.toastAutoDismissSeconds ?? null) : null,
    };
  }

  const normalizedPresentation =
    input.windowsAgentPresentation ?? (hasDesktopAgentChannel ? "Toast" : null);
  return {
    instruction: input.instruction ?? null,
    windowsAgentPresentation: normalizedPresentation,
    toastAutoDismissSeconds:
      normalizedPresentation === "Toast" ? (input.toastAutoDismissSeconds ?? null) : null,
  };
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
    case "Device":
      if (input.targetDeviceIds?.length) {
        return input.targetDeviceIds.map((deviceId) => ({
          targetType: "Device" as const,
          targetValue: deviceId,
        }));
      }

      return [{ targetType: "Device", targetValue: input.targetDeviceId ?? "*" }];
    default:
      return [{ targetType: "Group", targetValue: "custom-selection" }];
  }
}

function mapReminderScheduleInputToApi(
  reminderSchedule: Notification["reminderSchedule"] | null | undefined,
) {
  if (!reminderSchedule || reminderSchedule.scheduleType !== "Recurring") {
    return null;
  }

  return {
    scheduledAt: reminderSchedule.scheduledAt ?? null,
    recurrenceRule: reminderSchedule.recurrenceRule ?? "",
    timezone: reminderSchedule.timezone ?? "",
    executionMode: reminderSchedule.executionMode ?? "ServerGenerated",
    distributionMode: reminderSchedule.distributionMode ?? "Synchronized",
    staggerWindowMinutes: reminderSchedule.staggerWindowMinutes ?? null,
    validUntil: reminderSchedule.validUntil ?? null,
  };
}

function mapWellnessProgramToApi(
  wellnessProgram: Notification["wellnessProgram"] | null | undefined,
) {
  if (!wellnessProgram) {
    return null;
  }

  return {
    ...wellnessProgram,
    variantKeys: (wellnessProgram.variantKeys ?? []).filter(
      (value): value is string => typeof value === "string" && value.length > 0,
    ),
    heroAssetUrl: wellnessProgram.heroAssetUrl ?? null,
    countdownSeconds: wellnessProgram.countdownSeconds ?? null,
    rotationMode: wellnessProgram.rotationMode ?? null,
    actions: wellnessProgram.actions.map((action) => ({
      ...action,
      style: action.style ?? null,
      snoozeMinutes: action.snoozeMinutes ?? null,
    })),
    steps: (wellnessProgram.steps ?? []).map((step) => ({
      ...step,
      description: step.description ?? null,
      assetUrl: step.assetUrl ?? null,
      durationSeconds: step.durationSeconds ?? null,
    })),
    localizations: (wellnessProgram.localizations ?? []).map((localization) => ({
      ...localization,
      title: localization.title ?? null,
      body: localization.body ?? null,
      instruction: localization.instruction ?? null,
    })),
  };
}
