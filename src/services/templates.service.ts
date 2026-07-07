import type { Template } from "@/types";
import { apiClient } from "@/services/api-client";

type ApiTemplate = {
  id: string;
  name: string;
  communicationType: "Alert" | "Reminder" | "OperationalNotice" | "News" | "Article" | "KnowledgeUpdate";
  defaultPriority: "Info" | "Warning" | "Critical";
  defaultChannels?: Array<"WindowsAgent" | "WhatsApp" | "Email" | "DigitalSignage">;
  mandatoryChannels: Array<"WindowsAgent" | "WhatsApp" | "Email" | "DigitalSignage">;
  optionalChannels: Array<"WindowsAgent" | "WhatsApp" | "Email" | "DigitalSignage">;
  defaultWorkflowId?: string | null;
  allowedTargetTypes?: Template["allowedTargetTypes"];
  lockedFields?: string[];
  editableFields?: string[];
  defaultTitle?: string | null;
  defaultBody?: string | null;
  defaultRequiresResponse?: boolean;
};

type TemplateListResponse = {
  items: ApiTemplate[];
};

export const templatesService = {
  async list(): Promise<Template[]> {
    const response = await apiClient.get<TemplateListResponse>("/templates");
    return response.items.map(mapTemplate);
  },
  async create() {
    throw new Error("Template authoring is not available in this phase.");
  },
  async update() {
    throw new Error("Template authoring is not available in this phase.");
  },
  async remove() {
    throw new Error("Template authoring is not available in this phase.");
  },
};

function mapTemplate(template: ApiTemplate): Template {
  const channels = dedupeChannels([
    ...(template.defaultChannels ?? []),
    ...template.mandatoryChannels,
    ...template.optionalChannels,
  ]);

  return {
    id: template.id,
    name: template.name,
    category: inferCategory(template.communicationType),
    priority: template.defaultPriority === "Critical" ? "Emergency" : template.defaultPriority,
    defaultMessage: template.defaultBody ?? template.defaultTitle ?? template.name,
    defaultInstruction: template.defaultWorkflowId ? "Follow the configured response workflow." : "",
    defaultChannels: channels.map(mapChannelFromApi),
    requireAck: Boolean(template.defaultRequiresResponse ?? template.defaultWorkflowId),
    defaultWorkflowId: template.defaultWorkflowId ?? null,
    allowedTargetTypes: template.allowedTargetTypes,
    lockedFields: template.lockedFields ?? [],
    editableFields: template.editableFields ?? [],
  };
}

function inferCategory(communicationType: ApiTemplate["communicationType"]): Template["category"] {
  switch (communicationType) {
    case "Alert":
      return "OHSE";
    case "Reminder":
    case "OperationalNotice":
      return "Operation";
    case "News":
    case "Article":
    case "KnowledgeUpdate":
      return "General";
    default:
      return "General";
  }
}

function mapChannelFromApi(
  channel: ApiTemplate["mandatoryChannels"][number],
): Template["defaultChannels"][number] {
  return channel === "WindowsAgent" ? "DesktopAgent" : channel;
}

function dedupeChannels<T extends string>(channels: T[]) {
  return [...new Set(channels)];
}
